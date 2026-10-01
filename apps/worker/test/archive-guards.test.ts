import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { setLogSink } from "@buzon-sol/domain";
import { ArchiveProcessor, type ArchiveClient } from "../src/archive";
import { planArchive } from "../src/archive-plan";
import { testDb } from "./db";

type Db = Awaited<ReturnType<typeof testDb>>;
const skip = process.env.BUZON_TEST_DB !== "1";
const pdf = { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };

async function account(db: Db, files = true): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext,archive_content,archive_files)
     VALUES (?,?,?,?,true,?)`, [id, "Fixture", Buffer.from("fictional"), Buffer.from("fictional"), files]);
  return id;
}
async function item(db: Db, accountId: string, code: string, published: string): Promise<string> {
  const id = randomUUID();
  await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,published_at,row_json) VALUES (?,?,1,?,1,?,'{}')",
    [id, accountId, code, published]);
  return id;
}
async function withGates<T>(run: () => Promise<T>): Promise<T> {
  const previous = [process.env.SUNAT_READ_VALIDATED, process.env.SUNAT_FILE_CLIENT_READY];
  process.env.SUNAT_READ_VALIDATED = "true";
  process.env.SUNAT_FILE_CLIENT_READY = "true";
  try { return await run(); }
  finally {
    for (const [name, value] of [["SUNAT_READ_VALIDATED", previous[0]], ["SUNAT_FILE_CLIENT_READY", previous[1]]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
const newRun = async (db: Db, accountId: string) => {
  const id = randomUUID();
  await db.query("INSERT INTO archive_runs (id,account_id,trigger_kind,state) VALUES (?,?,'manual','pending')", [id, accountId]);
  return id;
};

test("a reopening before a codArchivo=0 download is recorded and, if SUNAT marks it read, stops and switches the archive off",
  { skip, timeout: 20000 }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    const accountId = await account(db);
    const first = await item(db, accountId, "9101", "2026-09-02 10:00:00");
    const second = await item(db, accountId, "9102", "2026-09-01 10:00:00");
    let details = 0, downloads = 0;
    const client = (): ArchiveClient => ({
      async readDetail() {
        details++;
        return { body: "x", updateLeido: details === 2,
          files: [{ kind: "attachment", codArchivo: "5" }, { kind: "attachment", codArchivo: "0" }] };
      },
      async downloadAttachment() { downloads++; return pdf; },
      async downloadGeneratedDocument() { downloads++; return pdf; },
    });
    await withGates(async () => {
      const runId = await newRun(db, accountId);
      const outcome = await new ArchiveProcessor(db, client, { async put() {} }).process(accountId, runId);
      assert.equal(outcome?.state, "partial");
      assert.equal(details, 2, "the item's own detail plus one reopening, and nothing for the next item");
      assert.equal(downloads, 1, "the codArchivo=0 download after the unexpected read never happens");
      const run = (await db.query("SELECT state,error_code FROM archive_runs WHERE id=?", [runId]))[0];
      assert.deepEqual([run.state, run.error_code], ["partial", "schema_changed"]);
      const events = await db.query("SELECT status,update_leido,origin FROM mail_read_events WHERE item_id=?", [first]);
      assert.equal(events.length, 2, "one durable event per readDetail call");
      assert.ok(events.every((event: { origin: string }) => event.origin === "archive"));
      assert.equal(events.filter((event: { update_leido: number | null }) => event.update_leido === 1).length, 1);
      const settings = (await db.query("SELECT archive_content,archive_files FROM sunat_accounts WHERE id=?", [accountId]))[0];
      assert.deepEqual([settings.archive_content, settings.archive_files], [0, 0]);
      const audit = await db.query("SELECT COUNT(*) AS n FROM audit_events WHERE account_id=? AND action='archive_unexpected_read'", [accountId]);
      assert.equal(Number(audit[0].n), 1);
      assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM mail_read_events WHERE item_id=?", [second]))[0].n), 0);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("switching archive_files off during a batch stops further downloads but not the content",
  { skip, timeout: 20000 }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    const accountId = await account(db);
    await item(db, accountId, "9201", "2026-09-02 10:00:00");
    await item(db, accountId, "9202", "2026-09-01 10:00:00");
    let details = 0, downloads = 0;
    const client = (): ArchiveClient => ({
      async readDetail() { details++; return { body: "x", updateLeido: false, files: [{ kind: "attachment", codArchivo: "7" }] }; },
      async downloadAttachment() {
        downloads++;
        await db.query("UPDATE sunat_accounts SET archive_files=false WHERE id=?", [accountId]);
        return pdf;
      },
      async downloadGeneratedDocument() { downloads++; return pdf; },
    });
    await withGates(async () => {
      const runId = await newRun(db, accountId);
      await new ArchiveProcessor(db, client, { async put() {} }).process(accountId, runId);
      assert.equal(details, 2);
      assert.equal(downloads, 1);
      const stored = await db.query("SELECT state FROM file_assets WHERE account_id=? ORDER BY state", [accountId]);
      assert.deepEqual(stored.map((row: { state: string }) => row.state), ["available", "stored"]);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("a failed enqueue leaves no pending archive run behind",
  { skip }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    const accountId = await account(db, false);
    await item(db, accountId, "9301", "2026-09-02 10:00:00");
    await withGates(async () => {
      const planned = await planArchive(db, accountId, "continue", async () => { throw new Error("redis down"); });
      assert.equal(planned, null);
      const runs = await db.query("SELECT state,error_code FROM archive_runs WHERE account_id=?", [accountId]);
      assert.deepEqual(runs.map((run: { state: string; error_code: string }) => [run.state, run.error_code]), [["partial", "remote_unavailable"]]);
    });
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("a batch killed after its intent leaves calling events that the next batch closes as uncertain before reopening",
  { skip, timeout: 20000 }, async () => {
  const db = await testDb();
  const previousSink = setLogSink(() => {});
  try {
    const accountId = await account(db, false);
    const id = await item(db, accountId, "9401", "2026-09-02 10:00:00");
    await db.query(
      "INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before,origin) VALUES (?,?,?,NULL,?,'calling',1,'archive')",
      [randomUUID(), id, accountId, `archive-dead-${id}`]);
    const runId = await newRun(db, accountId);
    await db.query("UPDATE archive_runs SET state='running' WHERE id=?", [runId]); // process died mid-batch
    let details = 0;
    await withGates(async () => {
      await new ArchiveProcessor(db, () => ({
        async readDetail() { details++; return { body: "x", updateLeido: false }; },
        async downloadAttachment() { return pdf; }, async downloadGeneratedDocument() { return pdf; },
      })).process(accountId, runId);
    });
    const statuses = (await db.query("SELECT status FROM mail_read_events WHERE item_id=? ORDER BY status", [id]))
      .map((row: { status: string }) => row.status);
    assert.deepEqual(statuses, ["complete", "uncertain"]);
    assert.equal(details, 1);
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});
