import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { tryAccountLock } from "../src/account-lock";
import { FileFetchProcessor } from "../src/file-fetch";
import { InventoryRunner } from "../src/inventory";
import { ReadProcessor } from "../src/reading";
import { testDb } from "./db";

const skip = process.env.BUZON_TEST_DB !== "1";
const jsonEmpty = { contentType: "application/json", body: '{"rows":[]}' };
type Db = Awaited<ReturnType<typeof testDb>>;

/** Counts how often a job opened a session; no factory here ever reaches the network. */
function spy<T extends object>(client: T) {
  const state = { opened: 0, closed: 0 };
  return { state, factory: () => { state.opened++; return { ...client, close: async () => { state.closed++; } }; } };
}

async function newAccount(db: Db): Promise<string> {
  const accountId = randomUUID();
  await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
    [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
  return accountId;
}

test("inventory opens no session when the lock is busy, the account is paused or the run is terminal",
  { skip }, async () => {
  const db = await testDb();
  try {
    const accountId = await newAccount(db);
    const probe = spy({ async listPage() { return jsonEmpty; } });
    const runner = new InventoryRunner(db, probe.factory);
    const runId = await runner.createRun(accountId, "test");

    const lock = await tryAccountLock(db, accountId);
    assert.ok(lock);
    await assert.rejects(runner.run(accountId, runId), (e) => e instanceof AppError && e.code === "conflict_running");
    await lock.release();

    await db.query("UPDATE sunat_accounts SET active=false WHERE id=?", [accountId]);
    await assert.rejects(runner.run(accountId, runId), (e) => e instanceof AppError && e.code === "paused");
    await assert.rejects(runner.run(randomUUID(), runId), (e) => e instanceof AppError && e.code === "not_found");
    await db.query("UPDATE sunat_accounts SET active=true WHERE id=?", [accountId]);
    assert.equal(probe.state.opened, 0);

    await runner.run(accountId, runId);
    assert.deepEqual([probe.state.opened, probe.state.closed], [1, 1]);
    await runner.run(accountId, runId); // terminal run: neither session nor remote call
    assert.deepEqual([probe.state.opened, probe.state.closed], [1, 1]);
  } finally {
    await db.destroy();
  }
});

test("inventory closes the session when SUNAT fails and keeps a failed login out of the failure streak",
  { skip }, async () => {
  const db = await testDb();
  try {
    const accountId = await newAccount(db);
    const failing = spy({ async listPage() { throw new AppError("remote_unavailable"); } });
    const runner = new InventoryRunner(db, failing.factory);
    await assert.rejects(runner.run(accountId, await runner.createRun(accountId, "test")));
    assert.deepEqual([failing.state.opened, failing.state.closed], [1, 1]);
    const streak = async () => Number((await db.query("SELECT sync_failure_streak AS n FROM sunat_accounts WHERE id=?", [accountId]))[0].n);
    assert.equal(await streak(), 1);

    const noLogin = new InventoryRunner(db, async () => { throw new AppError("invalid_credential"); });
    const runId = await noLogin.createRun(accountId, "test");
    await assert.rejects(noLogin.run(accountId, runId), (e) => e instanceof AppError && e.code === "invalid_credential");
    const run = (await db.query("SELECT state,error_code FROM sync_runs WHERE id=?", [runId]))[0];
    assert.deepEqual([run.state, run.error_code], ["partial", "invalid_credential"]);
    assert.equal(await streak(), 1);
  } finally {
    await db.destroy();
  }
});

async function readFixture(db: Db, permission: boolean, status = "pending") {
  const accountId = await newAccount(db);
  const itemId = randomUUID(), eventId = randomUUID(), roleId = randomUUID(), userId = randomUUID();
  await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Reader ${roleId}`]);
  if (permission) await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "read_content"]);
  await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
    [userId, `reader-${userId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
  await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
    [itemId, accountId, 1, "321", 0, JSON.stringify({ codMensaje: 321 })]);
  await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,?,?)",
    [eventId, itemId, accountId, userId, `key-${eventId}`, status, 0]);
  return { accountId, eventId };
}
const detailClient = { async readDetail() { return { body: "<p>x</p>", updateLeido: false }; }, async observeState() { return 0; } };

test("read opens no session for a revoked actor, a terminal event or a busy lock, and closes it after use",
  { skip }, async () => {
  const db = await testDb();
  try {
    const probe = spy(detailClient);
    const revoked = await readFixture(db, false);
    await assert.rejects(new ReadProcessor(db, probe.factory).process(revoked.accountId, revoked.eventId),
      (e) => e instanceof AppError && e.code === "forbidden");
    const done = await readFixture(db, true, "complete");
    await new ReadProcessor(db, probe.factory).process(done.accountId, done.eventId);
    const calling = await readFixture(db, true, "calling");
    await new ReadProcessor(db, probe.factory).process(calling.accountId, calling.eventId);
    const busy = await readFixture(db, true);
    const lock = await tryAccountLock(db, busy.accountId);
    assert.ok(lock);
    await assert.rejects(new ReadProcessor(db, probe.factory).process(busy.accountId, busy.eventId),
      (e) => e instanceof AppError && e.code === "conflict_running");
    await lock.release();
    assert.equal(probe.state.opened, 0);
    assert.equal((await db.query("SELECT status FROM mail_read_events WHERE id=?", [calling.eventId]))[0].status, "uncertain");

    await new ReadProcessor(db, probe.factory).process(busy.accountId, busy.eventId);
    assert.deepEqual([probe.state.opened, probe.state.closed], [1, 1]);

    // A failed login happens before any detail request: the event stays retryable, not `uncertain`.
    const login = await readFixture(db, true);
    await assert.rejects(new ReadProcessor(db, async () => { throw new AppError("remote_unavailable"); }).process(login.accountId, login.eventId));
    assert.equal((await db.query("SELECT status FROM mail_read_events WHERE id=?", [login.eventId]))[0].status, "pending");
  } finally {
    await db.destroy();
  }
});

test("file fetch opens no session when the lock is busy or the asset is already stored; it closes after a failure",
  { skip }, async () => {
  const db = await testDb();
  try {
    const accountId = await newAccount(db);
    const itemId = randomUUID(), readId = randomUUID(), roleId = randomUUID(), actorId = randomUUID();
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `File role ${roleId}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "download_file"]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [actorId, `file-${actorId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [itemId, accountId, 1, "777", 1, JSON.stringify({ codMensaje: "777" })]);
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status) VALUES (?,?,?,?,?,'complete')",
      [readId, itemId, accountId, actorId, `k-${readId}`]);
    let position = 0;
    const newFetch = async (state: string) => {
      const fileId = randomUUID(), fetchId = randomUUID();
      await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
        [fileId, itemId, accountId, "attachment", position++, "5", state]);
      await db.query("INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status) VALUES (?,?,?,?,'pending')", [fetchId, fileId, accountId, actorId]);
      return fetchId;
    };
    const probe = spy({ async fetch() { return { status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") }; } });
    const store = { async put() { throw new Error("Must not store"); } };

    const busy = await newFetch("available");
    const lock = await tryAccountLock(db, accountId);
    assert.ok(lock);
    await assert.rejects(new FileFetchProcessor(db, probe.factory, store).process(accountId, busy),
      (e) => e instanceof AppError && e.code === "conflict_running");
    await lock.release();
    const stored = await newFetch("stored");
    await new FileFetchProcessor(db, probe.factory, store).process(accountId, stored);
    assert.equal(probe.state.opened, 0);

    // HTML where a file is expected: invalid, never stored, and the session is closed.
    const invalid = await newFetch("available");
    await assert.rejects(new FileFetchProcessor(db, probe.factory, store).process(accountId, invalid),
      (e) => e instanceof AppError && e.code === "schema_changed");
    assert.deepEqual([probe.state.opened, probe.state.closed], [1, 1]);
  } finally {
    await db.destroy();
  }
});
