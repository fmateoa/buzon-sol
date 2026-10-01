import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError, setLogSink, type MailBox } from "@buzon-sol/domain";
import { ArchiveProcessor, planArchive, recoverOrphanArchiveRuns, type ArchiveClient } from "../src/archive";
import { testDb } from "./db";

type Db = Awaited<ReturnType<typeof testDb>>;
const pdf = { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };
const gates = ["SUNAT_READ_VALIDATED", "SUNAT_FILE_CLIENT_READY"] as const;

async function account(db: Db, settings: { content: boolean; files: boolean; batch?: number }): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext,archive_content,archive_files,archive_batch_size)
     VALUES (?,?,?,?,?,?,?)`,
    [id, "Fixture", Buffer.from("fictional"), Buffer.from("fictional"), settings.content, settings.files, settings.batch ?? 200]);
  return id;
}

async function item(db: Db, accountId: string, box: 1 | 2, code: string, state: number, published: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,published_at,row_json) VALUES (?,?,?,?,?,?,'{}')",
    [id, accountId, box, code, state, published]);
  return id;
}

function withGates<T>(values: Partial<Record<(typeof gates)[number], string>>, run: () => Promise<T>): Promise<T> {
  const previous = gates.map((name) => process.env[name]);
  for (const name of gates) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
  return run().finally(() => gates.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name];
    else process.env[name] = previous[index];
  }));
}

test("archive stores content and files of read items only, in bounded batches, one account at a time",
  { timeout: 20000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const lines: string[] = [];
  const previousSink = setLogSink((line) => lines.push(line));
  try {
    await withGates({ SUNAT_READ_VALIDATED: "true", SUNAT_FILE_CLIENT_READY: "true" }, async () => {
      const accountId = await account(db, { content: true, files: true, batch: 2 });
      const other = await account(db, { content: false, files: false });
      const newest = await item(db, accountId, 1, "9003", 1, "2026-09-03 10:00:00");
      const middle = await item(db, accountId, 2, "9002", 1, "2026-09-02 10:00:00");
      const oldest = await item(db, accountId, 1, "9001", 1, "2026-09-01 10:00:00");
      const unread = await item(db, accountId, 1, "9004", 0, "2026-09-04 10:00:00");
      await item(db, other, 1, "9003", 1, "2026-09-03 10:00:00");

      const calls: string[] = [];
      const stored = new Map<string, Buffer>();
      let sessions = 0;
      const client = (): ArchiveClient => {
        sessions++;
        return {
          async readDetail(box: MailBox, code: string) {
            calls.push(`detail:${box}:${code}`);
            if (code === "9003") return { body: "<p>Asunto ficticio</p><script>bad()</script>", indTexto: "1", updateLeido: false,
              generatedUrl: "https://ww1.sunat.gob.pe/cl-ti-iagenerador/gendocS01Alias?accion=genhtml",
              files: [{ kind: "attachment" as const, codArchivo: "0", name: "ficticio.pdf" },
                { kind: "generated_document" as const, codArchivo: null, numId: "55" },
                { kind: "attachment" as const, codArchivo: "777", name: "otro.pdf" }] };
            if (code === "9002") return { body: '{"texto":"ficticio"}', indTexto: "3", updateLeido: false, files: [] };
            return { body: "Texto ficticio", indTexto: "1", updateLeido: false,
              files: [{ kind: "attachment" as const, codArchivo: "0" }, { kind: "attachment" as const, codArchivo: "0" }] };
          },
          async downloadAttachment(code: string) {
            calls.push(`file:${code}`);
            return code === "777" ? { status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") } : pdf;
          },
          async downloadGeneratedDocument() {
            calls.push("generated");
            return { status: 200, contentType: "text/html", bytes: Buffer.from("<p>Documento ficticio</p>"), verifiedGeneratedDocument: true };
          },
          async close() { calls.push("close"); },
        };
      };
      const queued: [string, string, number | undefined][] = [];
      const enqueue = async (account: string, runId: string, delayMs?: number) => { queued.push([account, runId, delayMs]); };
      const processor = new ArchiveProcessor(db, client, { async put(key, bytes) { stored.set(key, bytes); } });

      // An account that did not opt in is never planned; an opted-in one gets exactly one open batch.
      assert.equal(await planArchive(db, other, "inventory", enqueue), null);
      const firstRun = await planArchive(db, accountId, "inventory", enqueue);
      assert.ok(firstRun);
      assert.equal(await planArchive(db, accountId, "inventory", enqueue), null);
      assert.deepEqual(queued, [[accountId, firstRun, undefined]]);

      // Batch 1 (size 2): newest first. The unread item is never opened.
      const first = await processor.process(accountId, firstRun);
      assert.deepEqual(first, { state: "complete", remaining: 2, progressed: true });
      assert.deepEqual(calls, ["detail:messages:9003", "file:0", "generated", "file:777", "detail:notifications:9002", "close"]);
      assert.equal(await processor.process(accountId, firstRun), null);

      const detail: { item_id: string; safe_body: string; ind_texto: string }[] = await db.query(
        "SELECT item_id,safe_body,ind_texto FROM mail_details WHERE account_id=? ORDER BY fetched_at", [accountId]);
      assert.deepEqual(detail.map((row) => row.item_id).sort(), [newest, middle].sort());
      assert.equal(detail.some((row) => row.safe_body.includes("<script>")), false);
      const files: { cod_archivo: string | null; kind: string; state: string; object_key: string | null }[] = await db.query(
        "SELECT cod_archivo,kind,state,object_key FROM file_assets WHERE item_id=? ORDER BY position_index", [newest]);
      assert.deepEqual(files.map((file) => [file.kind, file.cod_archivo, file.state]),
        [["attachment", "0", "stored"], ["generated_document", null, "stored"], ["attachment", "777", "failed"]]);
      assert.equal(files[0].object_key?.startsWith(`${accountId}/${newest}/`), true);
      assert.equal([...stored.keys()].every((key) => key.startsWith(`${accountId}/`)), true);
      const events: { status: string; origin: string; actor_user_id: string | null; update_leido: number }[] = await db.query(
        "SELECT status,origin,actor_user_id,update_leido FROM mail_read_events WHERE account_id=?", [accountId]);
      assert.deepEqual(events.map((event) => [event.status, event.origin, event.actor_user_id, event.update_leido]),
        [["complete", "archive", null, 0], ["complete", "archive", null, 0]]);

      // Batch 2: the remaining read item, plus one more attempt at the failed file of the first one.
      calls.length = 0;
      const secondRun = await planArchive(db, accountId, "continue", enqueue, { delayMs: 5 });
      assert.ok(secondRun);
      assert.equal(queued[1][2], 5);
      const second = await processor.process(accountId, secondRun);
      assert.equal(second?.state, "complete");
      // Two attachments share codArchivo=0 in the oldest item: neither is downloaded, since the code is ambiguous.
      assert.deepEqual(calls, ["detail:messages:9003", "file:777", "detail:messages:9001", "close"]);
      const ambiguous: { state: string }[] = await db.query("SELECT state FROM file_assets WHERE item_id=?", [oldest]);
      assert.deepEqual(ambiguous.map((file) => file.state), ["failed", "failed"]);

      // Files give up after three failed attempts; then nothing is pending and no session is opened.
      let retries = 0;
      for (let runId = await planArchive(db, accountId, "continue", enqueue); runId; runId = await planArchive(db, accountId, "continue", enqueue)) {
        assert.ok(++retries <= 2);
        await processor.process(accountId, runId);
      }
      assert.equal(retries, 2);
      const before = sessions;
      const idleRun = randomUUID();
      await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'manual','pending')", [idleRun, accountId]);
      assert.deepEqual(await processor.process(accountId, idleRun), { state: "complete", remaining: 0, progressed: false });
      assert.equal(sessions, before);

      assert.equal(calls.some((call) => call.includes("9004")), false);
      const untouched: { n: number }[] = await db.query(
        "SELECT (SELECT COUNT(*) FROM mail_details WHERE item_id=?)+(SELECT COUNT(*) FROM mail_read_events WHERE item_id=?) AS n",
        [unread, unread]);
      assert.equal(Number(untouched[0].n), 0);
      const crossed: { n: number }[] = await db.query(
        "SELECT (SELECT COUNT(*) FROM mail_details WHERE account_id=?)+(SELECT COUNT(*) FROM archive_runs WHERE account_id=?) AS n",
        [other, other]);
      assert.equal(Number(crossed[0].n), 0);
      const audits: { n: number }[] = await db.query(
        "SELECT COUNT(*) AS n FROM audit_events WHERE account_id=? AND action='archive_result'", [accountId]);
      assert.equal(Number(audits[0].n), 5);
      assert.equal(lines.some((line) => /ficticio|9003|gendoc/i.test(line)), false);
      assert.equal(lines.filter((line) => line.includes("archive_run_finished")).length, 5);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("archive respects its gates and switches itself off if a request marks an item as read",
  { timeout: 20000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    const accountId = await account(db, { content: true, files: true });
    const first = await item(db, accountId, 1, "8002", 1, "2026-09-02 10:00:00");
    const second = await item(db, accountId, 1, "8001", 1, "2026-09-01 10:00:00");
    const roleId = randomUUID(), adminId = randomUUID();
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Admin ${roleId}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,'manage_accounts')", [roleId]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [adminId, `admin-${adminId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
    const enqueue = async () => {};
    let details = 0, downloads = 0;
    const client = (): ArchiveClient => ({
      async readDetail() { details++; return { body: "x", updateLeido: details === 1, files: [{ kind: "attachment", codArchivo: "5" }] }; },
      async downloadAttachment() { downloads++; return pdf; },
      async downloadGeneratedDocument() { downloads++; return pdf; },
    });
    const processor = new ArchiveProcessor(db, client, { async put() {} });

    // Without the reading gate nothing is planned.
    await withGates({}, async () => assert.equal(await planArchive(db, accountId, "inventory", enqueue), null));

    await withGates({ SUNAT_READ_VALIDATED: "true" }, async () => {
      const runId = await planArchive(db, accountId, "inventory", enqueue);
      assert.ok(runId);
      // The file gate is closed, so files are not requested even though the account asks for them.
      const outcome = await processor.process(accountId, runId);
      assert.equal(outcome?.state, "partial");
      assert.equal(details, 1);
      assert.equal(downloads, 0);
      const run: { state: string; error_code: string; items_done: number }[] = await db.query(
        "SELECT state,error_code,items_done FROM archive_runs WHERE id=?", [runId]);
      assert.deepEqual([run[0].state, run[0].error_code, run[0].items_done], ["partial", "schema_changed", 1]);
      const settings: { archive_content: number; archive_files: number }[] = await db.query(
        "SELECT archive_content,archive_files FROM sunat_accounts WHERE id=?", [accountId]);
      assert.deepEqual([settings[0].archive_content, settings[0].archive_files], [0, 0]);
      const notices: { kind: string }[] = await db.query("SELECT kind FROM in_app_notices WHERE account_id=? AND user_id=?", [accountId, adminId]);
      assert.deepEqual(notices.map((notice) => notice.kind), ["archive_stopped"]);
      const event: { update_leido: number }[] = await db.query("SELECT update_leido FROM mail_read_events WHERE item_id=?", [first]);
      assert.equal(event[0].update_leido, 1);
      // Switched off: no further batch, and the second item was never requested.
      assert.equal(await planArchive(db, accountId, "inventory", enqueue), null);
      const untouched: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM mail_read_events WHERE item_id=?", [second]);
      assert.equal(Number(untouched[0].n), 0);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("archive failures are bounded, a rejected credential pauses the account and orphan batches are recovered",
  { timeout: 20000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    await withGates({ SUNAT_READ_VALIDATED: "true" }, async () => {
      const enqueue = async () => {};
      const accountId = await account(db, { content: true, files: false });
      const items = [];
      for (let index = 0; index < 5; index++) items.push(await item(db, accountId, 1, `70${index}`, 1, `2026-09-0${index + 1} 10:00:00`));

      // Three consecutive failures stop the batch; an expired session stops it at once and is not held against the item.
      let calls = 0;
      const failing = new ArchiveProcessor(db, () => ({
        async readDetail() { calls++; throw new AppError("remote_unavailable"); },
        async downloadAttachment() { return pdf; }, async downloadGeneratedDocument() { return pdf; },
      }));
      const run = await planArchive(db, accountId, "inventory", enqueue);
      assert.ok(run);
      assert.deepEqual(await failing.process(accountId, run), { state: "partial", remaining: 5, progressed: false });
      assert.equal(calls, 3);
      const expired = new ArchiveProcessor(db, () => ({
        async readDetail() { calls++; throw new AppError("remote_session_expired"); },
        async downloadAttachment() { return pdf; }, async downloadGeneratedDocument() { return pdf; },
      }));
      const expiredRun = await planArchive(db, accountId, "inventory", enqueue);
      assert.ok(expiredRun);
      assert.equal((await expired.process(accountId, expiredRun))?.state, "partial");
      assert.equal(calls, 4);
      const statuses: { status: string; n: number }[] = await db.query(
        "SELECT status,COUNT(*) AS n FROM mail_read_events WHERE account_id=? GROUP BY status ORDER BY status", [accountId]);
      assert.deepEqual(statuses.map((row) => [row.status, Number(row.n)]), [["aborted", 1], ["failed", 3]]);

      // A rejected credential at login pauses the account like the inventory does, and the job fails.
      const scheduleId = randomUUID();
      await db.query(
        `INSERT INTO sync_schedules (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state)
         VALUES (?,?,'daily','["mon"]','08:00:00','17:00:00','["messages"]','active')`, [scheduleId, accountId]);
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,1,?,?,?,'valid')",
        [randomUUID(), accountId, Buffer.from("fictional"), Buffer.alloc(12), "test"]);
      const rejected = new ArchiveProcessor(db, async () => { throw new AppError("invalid_credential"); });
      const rejectedRun = await planArchive(db, accountId, "inventory", enqueue);
      assert.ok(rejectedRun);
      await assert.rejects(rejected.process(accountId, rejectedRun), (error) => error instanceof AppError && error.code === "invalid_credential");
      const paused: { state: string; pause_reason: string; status: string }[] = await db.query(
        `SELECT s.state,s.pause_reason,c.status FROM sync_schedules s JOIN sunat_credentials c ON c.account_id=s.account_id
         WHERE s.account_id=?`, [accountId]);
      assert.deepEqual([paused[0].state, paused[0].pause_reason, paused[0].status], ["paused", "invalid_credential", "rejected"]);

      // A batch whose process died (running, lock free) and a pending one whose job was lost become partial.
      const dead = randomUUID(), lost = randomUUID(), queuedRun = randomUUID();
      const second = await account(db, { content: true, files: false }), third = await account(db, { content: true, files: false });
      await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'inventory','running')", [dead, accountId]);
      await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'inventory','pending')", [lost, second]);
      await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'inventory','pending')", [queuedRun, third]);
      assert.equal(await planArchive(db, accountId, "inventory", enqueue), null);
      await recoverOrphanArchiveRuns(db, async (runId) => runId === queuedRun);
      const recovered: { id: string; state: string }[] = await db.query(
        "SELECT id,state FROM archive_runs WHERE id IN (?,?,?)", [dead, lost, queuedRun]);
      assert.deepEqual(Object.fromEntries(recovered.map((row) => [row.id, row.state])),
        { [dead]: "partial", [lost]: "partial", [queuedRun]: "pending" });
      await db.query("UPDATE archive_runs SET state='partial' WHERE id=?", [queuedRun]);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("a complete inventory queues the account archive, which continues batch by batch until nothing is pending",
  { timeout: 30000, skip: process.env.BUZON_TEST_DB !== "1" || process.env.BUZON_TEST_REDIS !== "1" }, async () => {
  const { Queue, QueueEvents } = await import("bullmq");
  const { INVENTORY_QUEUE, redisOptions } = await import("@buzon-sol/domain");
  const { InventoryRunner } = await import("../src/inventory");
  const { startInventoryWorker } = await import("../src/queue");
  const { startArchiveWorker } = await import("../src/archive-queue");
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  const previousDelay = process.env.ARCHIVE_BATCH_DELAY_MS;
  process.env.ARCHIVE_BATCH_DELAY_MS = "0";
  const queue = new Queue(INVENTORY_QUEUE, { connection: redisOptions() });
  const events = new QueueEvents(INVENTORY_QUEUE, { connection: redisOptions() });
  const workers: { close(): Promise<void> }[] = [];
  try {
    await withGates({ SUNAT_READ_VALIDATED: "true" }, async () => {
      const accountId = await account(db, { content: true, files: false, batch: 1 });
      const rows = [1, 2, 3].map((code) => ({ codMensaje: 6100 + code, indEstado: code === 3 ? 0 : 1, indTipmsj: 1,
        fecPublica: `0${code}/09/2026 10:00:00` }));
      const inventory = { async listPage(box: MailBox, page: number) {
        return { contentType: "application/json", body: JSON.stringify({ rows: box === "messages" && page === 1 ? rows : [] }) };
      } };
      const opened: string[] = [];
      workers.push(startInventoryWorker(db, () => inventory));
      workers.push(startArchiveWorker(db, () => ({
        async readDetail(_box: MailBox, code: string) { opened.push(code); return { body: "<p>Ficticio</p>", updateLeido: false }; },
        async downloadAttachment() { return pdf; }, async downloadGeneratedDocument() { return pdf; },
      })));
      const runId = await new InventoryRunner(db, inventory).createRun(accountId, "manual");
      await events.waitUntilReady();
      const job = await queue.add("inventory", { accountId, runId }, { jobId: runId, removeOnComplete: true });
      await job.waitUntilFinished(events, 10_000);
      for (let waited = 0; waited < 15_000; waited += 100) {
        const done: { n: number }[] = await db.query(
          "SELECT COUNT(*) AS n FROM archive_runs WHERE account_id=? AND state='complete' AND remaining=0", [accountId]);
        if (Number(done[0].n)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const runs: { trigger_kind: string; state: string; items_done: number; sync_run_id: string | null }[] = await db.query(
        "SELECT trigger_kind,state,items_done,sync_run_id FROM archive_runs WHERE account_id=? ORDER BY created_at,id", [accountId]);
      assert.deepEqual(runs.map((run) => [run.trigger_kind, run.state, run.items_done]),
        [["inventory", "complete", 1], ["continue", "complete", 1]]);
      assert.equal(runs[0].sync_run_id, runId);
      // Newest read item first; the unread one (6103) is inventoried but never opened.
      assert.deepEqual(opened, ["6102", "6101"]);
    });
  } finally {
    if (previousDelay === undefined) delete process.env.ARCHIVE_BATCH_DELAY_MS;
    else process.env.ARCHIVE_BATCH_DELAY_MS = previousDelay;
    await Promise.all(workers.map((worker) => worker.close()));
    await events.close();
    await queue.close();
    setLogSink(previousSink);
    await db.destroy();
  }
});
