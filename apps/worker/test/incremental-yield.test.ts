import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Queue, QueueEvents } from "bullmq";
import { chooseScanKind, INVENTORY_QUEUE, redisOptions, type InventoryJob, type MailBox } from "@buzon-sol/domain";
import { tryAccountLock } from "../src/account-lock";
import { ConnectionProcessor } from "../src/connection";
import { hasUserDemand } from "../src/demand";
import { planInitialLoad } from "../src/initial-load";
import { InventoryRunner } from "../src/inventory";
import { startInventoryWorker } from "../src/queue";
import { testDb } from "./db";

const skipDb = process.env.BUZON_TEST_DB !== "1";
const skipQueue = skipDb || process.env.BUZON_TEST_REDIS !== "1";
const PAGE_SIZE = 2;

type Row = { codMensaje: number; indEstado: number };

/** A fixture listing, newest first like SUNAT: pages of two rows and an empty page at the end. */
function listing(state: { messages: Row[]; notifications: Row[] }, calls: string[] = []) {
  return {
    async listPage(box: MailBox, page: number) {
      calls.push(`${box}:${page}`);
      const rows = state[box].slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return { contentType: "application/json", body: JSON.stringify({ total: 1, records: 2, rows }) };
    },
  };
}
const rows = (...codes: number[]): Row[] => codes.map((codMensaje) => ({ codMensaje, indEstado: 1 }));

async function seedAccount(db: Awaited<ReturnType<typeof testDb>>): Promise<string> {
  const accountId = randomUUID();
  await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
    [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
  return accountId;
}
const seedCredential = (db: Awaited<ReturnType<typeof testDb>>, accountId: string, status: string) => db.query(
  "INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,1,?,?,?,?)",
  [randomUUID(), accountId, Buffer.from("fictional"), Buffer.from("fictional"), "fixture", status]);
const state = async (db: Awaited<ReturnType<typeof testDb>>, runId: string) => {
  const found: { state: string; scan_kind: string; yield_count: number; resume_box: number | null; resume_page: number | null }[] =
    await db.query("SELECT state,scan_kind,yield_count,resume_box,resume_page FROM sync_runs WHERE id=?", [runId]);
  return found[0];
};

test("scan kind: full until a recent complete full pass covers every box", { skip: skipDb }, async () => {
  const db = await testDb();
  const query = (sql: string, params?: unknown[]) => db.query(sql, params);
  try {
    const accountId = await seedAccount(db);
    const both: MailBox[] = ["messages", "notifications"];
    assert.equal(await chooseScanKind(query, accountId, both), "full");
    // A partial full pass leaves holes: it never counts.
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state,boxes_json,scan_kind,finished_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))",
      [randomUUID(), accountId, "manual", "partial", JSON.stringify(both), "full"]);
    assert.equal(await chooseScanKind(query, accountId, both), "full");
    // A complete full pass over messages only does not cover notifications.
    const messagesOnly = randomUUID();
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state,boxes_json,scan_kind,finished_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))",
      [messagesOnly, accountId, "scheduled", "complete", JSON.stringify(["messages"]), "full"]);
    assert.equal(await chooseScanKind(query, accountId, ["messages"]), "incremental");
    assert.equal(await chooseScanKind(query, accountId, both), "full");
    // An incremental pass is not a baseline either.
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state,boxes_json,scan_kind,finished_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))",
      [randomUUID(), accountId, "scheduled", "complete", JSON.stringify(both), "incremental"]);
    assert.equal(await chooseScanKind(query, accountId, both), "full");
    const fullBoth = randomUUID();
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state,boxes_json,scan_kind,finished_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6))",
      [fullBoth, accountId, "manual", "complete", JSON.stringify(both), "full"]);
    assert.equal(await chooseScanKind(query, accountId, both), "incremental");
    assert.equal(await chooseScanKind(query, accountId, both, { full: true }), "full");
    // Stale: older than the reconcile window.
    assert.equal(await chooseScanKind(query, accountId, both, { now: new Date(Date.now() + 8 * 86_400_000) }), "full");
  } finally { await db.destroy(); }
});

test("incremental run stops at the first page with nothing new and still sees new mail", { skip: skipDb, timeout: 20_000 }, async () => {
  const db = await testDb();
  try {
    const accountId = await seedAccount(db);
    const listed = { messages: rows(6, 5, 4, 3, 2, 1), notifications: rows(20, 10) };
    const first: string[] = [];
    const initial = new InventoryRunner(db, () => listing(listed, first));
    const fullRun = await initial.createRun(accountId, "manual");
    assert.equal((await state(db, fullRun)).scan_kind, "full");
    assert.equal(await initial.run(accountId, fullRun), "done");
    // Messages: pages 1-3 plus the empty page asked twice; notifications: page 1 plus the empty page asked twice.
    assert.deepEqual(first, ["messages:1", "messages:2", "messages:3", "messages:4", "messages:4",
      "notifications:1", "notifications:2", "notifications:2"]);

    // Nothing changed: one request per box, whatever the size of the mailbox.
    const quiet: string[] = [];
    const runner = new InventoryRunner(db, () => listing(listed, quiet));
    const nothingNew = await runner.createRun(accountId, "manual");
    assert.equal((await state(db, nothingNew)).scan_kind, "incremental");
    assert.equal(await runner.run(accountId, nothingNew), "done");
    assert.deepEqual(quiet, ["messages:1", "notifications:1"]);
    const finished = await state(db, nothingNew);
    assert.deepEqual([finished.state, finished.resume_box, finished.resume_page], ["complete", null, null]);

    // A new message lands on top: page 1 changes, page 2 is already known, so the walk ends there.
    listed.messages = rows(7, 6, 5, 4, 3, 2, 1);
    const withNew: string[] = [];
    const third = await runner.createRun(accountId, "manual");
    assert.equal(await new InventoryRunner(db, () => listing(listed, withNew)).run(accountId, third), "done");
    assert.deepEqual(withNew, ["messages:1", "messages:2", "notifications:1"]);
    const stored: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM mail_items WHERE account_id=? AND tipo_msj=1", [accountId]);
    assert.equal(Number(stored[0].n), 7);

    // An item whose remote state changed on a page we read keeps the walk going until a quiet page.
    await db.query("UPDATE mail_items SET ind_estado=0 WHERE account_id=? AND tipo_msj=1 AND cod_mensaje='6'", [accountId]);
    const drift: string[] = [];
    const fourth = await runner.createRun(accountId, "manual");
    assert.equal(await new InventoryRunner(db, () => listing(listed, drift)).run(accountId, fourth), "done");
    assert.deepEqual(drift, ["messages:1", "messages:2", "notifications:1"]);
    const refreshed: { ind_estado: number }[] = await db.query(
      "SELECT ind_estado FROM mail_items WHERE account_id=? AND cod_mensaje='6' AND tipo_msj=1", [accountId]);
    assert.equal(Number(refreshed[0].ind_estado), 1);

    // The known limit: a change deeper than the first quiet page is invisible to an incremental run and only a full pass
    // repairs it. This is why a full pass is forced after FULL_RECONCILE_DAYS.
    await db.query("UPDATE mail_items SET ind_estado=0 WHERE account_id=? AND tipo_msj=1 AND cod_mensaje='3'", [accountId]);
    const deep = await runner.createRun(accountId, "manual");
    await new InventoryRunner(db, () => listing(listed)).run(accountId, deep);
    const stale: { ind_estado: number }[] = await db.query(
      "SELECT ind_estado FROM mail_items WHERE account_id=? AND cod_mensaje='3' AND tipo_msj=1", [accountId]);
    assert.equal(Number(stale[0].ind_estado), 0, "incremental does not look that deep");

    // `full: true` walks everything again.
    const everything: string[] = [];
    const fifth = await runner.createRun(accountId, "manual", ["messages", "notifications"], { full: true });
    assert.equal((await state(db, fifth)).scan_kind, "full");
    await new InventoryRunner(db, () => listing(listed, everything)).run(accountId, fifth);
    assert.ok(everything.includes("messages:5"), "the empty page confirms the end of a full walk");
    const repaired: { ind_estado: number }[] = await db.query(
      "SELECT ind_estado FROM mail_items WHERE account_id=? AND cod_mensaje='3' AND tipo_msj=1", [accountId]);
    assert.equal(Number(repaired[0].ind_estado), 1, "the full pass repairs what the incremental one could not see");
  } finally { await db.destroy(); }
});

test("an interrupted incremental run resumes at the next box, not from the start", { skip: skipDb, timeout: 20_000 }, async () => {
  const db = await testDb();
  try {
    const accountId = await seedAccount(db);
    const listed = { messages: rows(4, 3, 2, 1), notifications: rows(9, 8) };
    const runner = new InventoryRunner(db, () => listing(listed));
    await runner.run(accountId, await runner.createRun(accountId, "manual"));
    listed.messages = rows(5, 4, 3, 2, 1);
    let fail = true;
    const flaky = new InventoryRunner(db, () => ({ async listPage(box: MailBox, page: number) {
      if (box === "notifications" && fail) { fail = false; throw new Error("boom"); }
      return listing(listed).listPage(box, page);
    } }));
    const runId = await flaky.createRun(accountId, "manual");
    await assert.rejects(flaky.run(accountId, runId));
    // Messages ended early (page 2 known), so the checkpoint already points at notifications.
    const interrupted = await state(db, runId);
    assert.deepEqual([interrupted.state, interrupted.resume_box, interrupted.resume_page], ["partial", 2, 1]);
    assert.equal(await flaky.run(accountId, runId), "done");
    assert.equal((await state(db, runId)).state, "complete");
  } finally { await db.destroy(); }
});

test("a run yields the account to a waiting user and resumes from its checkpoint", { skip: skipDb, timeout: 20_000 }, async () => {
  const db = await testDb();
  try {
    const accountId = await seedAccount(db);
    const listed = { messages: rows(6, 5, 4, 3, 2, 1), notifications: rows(9) };
    const seed = new InventoryRunner(db, () => listing(listed));
    await seed.run(accountId, await seed.createRun(accountId, "manual"));
    const item: { id: string }[] = await db.query("SELECT id FROM mail_items WHERE account_id=? AND tipo_msj=1 LIMIT 1", [accountId]);
    const eventId = randomUUID();
    const insertEvent = (origin: string, status: string) => db.query(
      "INSERT INTO mail_read_events (id,item_id,account_id,idempotency_key,status,origin) VALUES (?,?,?,?,?,?)",
      [eventId, item[0].id, accountId, randomUUID(), status, origin]);

    // System work is nobody waiting: the run never yields.
    await insertEvent("archive", "pending");
    assert.equal(await hasUserDemand(db, accountId), false);
    const calmCalls: string[] = [];
    const calm = new InventoryRunner(db, () => listing(listed, calmCalls));
    assert.equal(await calm.run(accountId, await calm.createRun(accountId, "manual", ["messages", "notifications"], { full: true })), "done");
    await db.query("DELETE FROM mail_read_events WHERE id=?", [eventId]);

    // A user waiting: the run stops after the page it was on and goes back to pending with its checkpoint.
    await insertEvent("user", "pending");
    assert.equal(await hasUserDemand(db, accountId), true);
    const calls: string[] = [];
    const runner = new InventoryRunner(db, () => listing(listed, calls));
    const runId = await runner.createRun(accountId, "manual", ["messages", "notifications"], { full: true });
    assert.equal(await runner.run(accountId, runId), "yielded");
    assert.deepEqual(calls, ["messages:1"]);
    const paused = await state(db, runId);
    assert.deepEqual([paused.state, paused.yield_count, paused.resume_box, paused.resume_page], ["pending", 1, 1, 2]);
    // The account is free for the user's command while the run waits.
    const lock = await tryAccountLock(db, accountId);
    assert.ok(lock, "the yielded run no longer holds the account lock");
    await lock!.release();

    // Once nobody waits, the same run continues at page 2 and completes without repeating page 1.
    await db.query("UPDATE mail_read_events SET status='complete' WHERE id=?", [eventId]);
    assert.equal(await hasUserDemand(db, accountId), false);
    assert.equal(await runner.run(accountId, runId), "done");
    assert.deepEqual(calls.filter((call) => call === "messages:1"), ["messages:1"]);
    assert.equal((await state(db, runId)).state, "complete");
    const pages: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM sync_pages WHERE run_id=? AND tipo_msj=1 AND page_number=1", [runId]);
    assert.equal(Number(pages[0].n), 1);
    // A stale leftover (older than the window) is not demand.
    await db.query("UPDATE mail_read_events SET status='pending',created_at=UTC_TIMESTAMP(6) - INTERVAL 30 MINUTE WHERE id=?", [eventId]);
    assert.equal(await hasUserDemand(db, accountId), false);
  } finally { await db.destroy(); }
});

test("initial load starts once, resumes an unfinished full run and respects its gates", { skip: skipDb, timeout: 20_000 }, async () => {
  const db = await testDb();
  const previous = process.env.SUNAT_TRANSPORT_VALIDATED;
  try {
    const accountId = await seedAccount(db);
    await seedCredential(db, accountId, "valid");
    const enqueued: string[] = [];
    const enqueue = async (_account: string, runId: string) => { enqueued.push(runId); };

    delete process.env.SUNAT_TRANSPORT_VALIDATED;
    assert.equal(await planInitialLoad(db, accountId, enqueue), null, "gate closed: nothing is planned");
    process.env.SUNAT_TRANSPORT_VALIDATED = "true";

    const runId = await planInitialLoad(db, accountId, enqueue);
    assert.ok(runId);
    const created = await state(db, runId!);
    assert.deepEqual([created.state, created.scan_kind], ["pending", "full"]);
    const mode: { mode: string }[] = await db.query("SELECT mode FROM sync_runs WHERE id=?", [runId]);
    assert.equal(mode[0].mode, "initial");
    assert.equal(await planInitialLoad(db, accountId, enqueue), null, "a pending run already exists");

    // An unfinished full run is resumed, not duplicated.
    await db.query("UPDATE sync_runs SET state='partial',error_code='remote_unavailable',resume_page=7 WHERE id=?", [runId]);
    assert.equal(await planInitialLoad(db, accountId, enqueue), runId);
    const resumed = await state(db, runId!);
    assert.deepEqual([resumed.state, resumed.resume_page], ["pending", 7]);
    assert.equal(enqueued.length, 2);

    // A completed full pass ends the initial load for good.
    await db.query("UPDATE sync_runs SET state='complete',finished_at=UTC_TIMESTAMP(6) WHERE id=?", [runId]);
    assert.equal(await planInitialLoad(db, accountId, enqueue), null);

    // A rejected credential never starts a load.
    const other = await seedAccount(db);
    await seedCredential(db, other, "rejected");
    assert.equal(await planInitialLoad(db, other, enqueue), null);
    // A failed enqueue leaves the run resumable instead of pending forever.
    const third = await seedAccount(db);
    await seedCredential(db, third, "valid");
    assert.equal(await planInitialLoad(db, third, async () => { throw new Error("redis down"); }), null);
    const left: { state: string; error_code: string }[] = await db.query("SELECT state,error_code FROM sync_runs WHERE account_id=?", [third]);
    assert.deepEqual(left[0], { state: "partial", error_code: "remote_unavailable" });
  } finally {
    if (previous === undefined) delete process.env.SUNAT_TRANSPORT_VALIDATED; else process.env.SUNAT_TRANSPORT_VALIDATED = previous;
    await db.destroy();
  }
});

test("queued inventory waits for a busy account and yields to a user, as the same job", { skip: skipQueue, timeout: 40_000 }, async () => {
  const db = await testDb();
  const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const events = new QueueEvents(INVENTORY_QUEUE, { connection: redisOptions() });
  const listed = { messages: rows(6, 5, 4, 3, 2, 1), notifications: rows(9) };
  const worker = startInventoryWorker(db, () => listing(listed), undefined, undefined, { yieldMs: 150, retryMs: 150 });
  try {
    const accountId = await seedAccount(db);
    const seed = new InventoryRunner(db, () => listing(listed));
    await seed.run(accountId, await seed.createRun(accountId, "manual"));
    await events.waitUntilReady();

    // Busy account: postponed, not failed; runs once the account is free.
    const held = await tryAccountLock(db, accountId);
    assert.ok(held);
    const busyRun = await seed.createRun(accountId, "manual");
    const busyJob = await queue.add("inventory", { accountId, runId: busyRun }, { jobId: busyRun, attempts: 1, removeOnComplete: true });
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal((await state(db, busyRun)).state, "pending", "postponed, not partial");
    await held!.release();
    await busyJob.waitUntilFinished(events, 10_000);
    assert.equal((await state(db, busyRun)).state, "complete");

    // A user waiting: the run yields, the same job is delayed, and it resumes once the command is done.
    const item: { id: string }[] = await db.query("SELECT id FROM mail_items WHERE account_id=? AND tipo_msj=1 LIMIT 1", [accountId]);
    const eventId = randomUUID();
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,idempotency_key,status) VALUES (?,?,?,?,?)",
      [eventId, item[0].id, accountId, randomUUID(), "pending"]);
    const yielding = await seed.createRun(accountId, "manual", ["messages", "notifications"], { full: true });
    const job = await queue.add("inventory", { accountId, runId: yielding }, { jobId: yielding, attempts: 1, removeOnComplete: true });
    const deadline = Date.now() + 10_000;
    while ((await state(db, yielding)).yield_count < 1 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok((await state(db, yielding)).yield_count >= 1, "the run yielded to the waiting user");
    assert.ok(await queue.getJob(yielding), "the same job stays queued, so orphan recovery still sees it");
    await db.query("UPDATE mail_read_events SET status='complete' WHERE id=?", [eventId]);
    await job.waitUntilFinished(events, 15_000);
    assert.equal((await state(db, yielding)).state, "complete");
  } finally {
    await worker.close();
    await events.close();
    await queue.close();
    await db.destroy();
  }
});

test("a connection test on a busy account stays pending until its last attempt, which closes it as failed", { skip: skipDb, timeout: 20_000 }, async () => {
  const db = await testDb();
  try {
    const accountId = await seedAccount(db);
    const credentialId = randomUUID(), roleId = randomUUID(), userId = randomUUID(), testId = randomUUID();
    await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,1,?,?,?,?)",
      [credentialId, accountId, Buffer.from("fictional"), Buffer.from("fictional"), "fixture", "untested"]);
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Conn ${roleId}`]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [userId, `conn-${userId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
    await db.query("INSERT INTO connection_tests (id,account_id,credential_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
      [testId, accountId, credentialId, userId]);
    const status = async () => ((await db.query("SELECT status,error_code FROM connection_tests WHERE id=?", [testId])) as { status: string; error_code: string | null }[])[0];
    const processor = new ConnectionProcessor(db, () => { throw new Error("must not open a session"); });
    const held = await tryAccountLock(db, accountId);
    assert.ok(held);
    await assert.rejects(processor.process(accountId, testId, false), (error: { code?: string }) => error.code === "conflict_running");
    assert.deepEqual(await status(), { status: "pending", error_code: null }, "a retryable attempt leaves it pending (and visible as demand)");
    assert.equal(await hasUserDemand(db, accountId), true);
    await assert.rejects(processor.process(accountId, testId, true), (error: { code?: string }) => error.code === "conflict_running");
    assert.deepEqual(await status(), { status: "failed", error_code: "conflict_running" });
    await held!.release();
  } finally { await db.destroy(); }
});
