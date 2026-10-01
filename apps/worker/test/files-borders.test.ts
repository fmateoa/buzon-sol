import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { FileFetchProcessor } from "../src/file-fetch";
import { FileProcessor, type FileResponse } from "../src/files";
import { ReadProcessor } from "../src/reading";
import { testDb } from "./db";

const skip = process.env.BUZON_TEST_DB !== "1";
type Db = Awaited<ReturnType<typeof testDb>>;
const pdf: FileResponse = { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };

async function fixture(db: Db, options: { kind?: "attachment" | "generated_document"; schedule?: boolean; actor?: boolean } = {}) {
  const accountId = randomUUID(), itemId = randomUUID(), fileId = randomUUID(), fetchId = randomUUID();
  const roleId = randomUUID(), actorId = randomUUID();
  await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
    [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
  await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Role ${roleId}`]);
  await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?),(?,?)", [roleId, "download_file", roleId, "read_content"]);
  await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
    [actorId, `u-${actorId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
  await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
    [itemId, accountId, 1, "888", 1, JSON.stringify({ codMensaje: "888" })]);
  await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status) VALUES (?,?,?,?,?,'complete')",
    [randomUUID(), itemId, accountId, actorId, `k-${fetchId}`]);
  await db.query("INSERT INTO mail_details (item_id,account_id,original_body,safe_body) VALUES (?,?,?,?)", [itemId, accountId, "x", "x"]);
  const kind = options.kind ?? "attachment";
  await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,num_id,state) VALUES (?,?,?,?,?,?,?,?)",
    [fileId, itemId, accountId, kind, 0, kind === "attachment" ? "5" : null, kind === "attachment" ? null : "doc-1", "available"]);
  await db.query("INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status,origin) VALUES (?,?,?,?,'pending',?)",
    [fetchId, fileId, accountId, options.actor === false ? null : actorId, options.actor === false ? "schedule" : "user"]);
  if (options.schedule !== undefined) {
    await db.query("INSERT INTO sync_schedules (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state,download_read_attachments) VALUES (?,?,?,?,?,?,?,?,?)",
      [randomUUID(), accountId, "daily", JSON.stringify(["mon"]), "08:00:00", "17:00:00", JSON.stringify(["messages"]), "paused", options.schedule]);
  }
  return { accountId, itemId, fileId, fetchId, actorId, roleId };
}

function sessionSpy(response: FileResponse = pdf) {
  const state = { opened: 0, closed: 0, fetches: 0 };
  return { state, factory: () => { state.opened++; return {
    async fetch() { state.fetches++; return response; },
    async close() { state.closed++; },
  }; } };
}
const memoryStore = () => { const objects = new Map<string, Buffer>(); return { objects, put: async (key: string, bytes: Buffer) => { objects.set(key, bytes); } }; };
const status = async (db: Db, fetchId: string) => (await db.query("SELECT status,error_code FROM file_fetches WHERE id=?", [fetchId]))[0];

test("downloads never open a session for a deactivated account, a revoked actor or a disabled P-03 option",
  { skip }, async () => {
  const db = await testDb();
  try {
    const spy = sessionSpy(), store = memoryStore();
    const run = (accountId: string, fetchId: string) => new FileFetchProcessor(db, spy.factory, store).process(accountId, fetchId);

    const inactive = await fixture(db);
    await db.query("UPDATE sunat_accounts SET active=false WHERE id=?", [inactive.accountId]);
    await assert.rejects(run(inactive.accountId, inactive.fetchId), (e) => e instanceof AppError && e.code === "forbidden");
    assert.equal((await status(db, inactive.fetchId)).status, "denied");

    const revoked = await fixture(db);
    await db.query("DELETE FROM role_permissions WHERE role_id=? AND permission='download_file'", [revoked.roleId]);
    await assert.rejects(run(revoked.accountId, revoked.fetchId), (e) => e instanceof AppError && e.code === "forbidden");

    const unreadNow = await fixture(db, { actor: false, schedule: true });
    await db.query("UPDATE mail_items SET ind_estado=0 WHERE id=?", [unreadNow.itemId]);
    await assert.rejects(run(unreadNow.accountId, unreadNow.fetchId), (e) => e instanceof AppError && e.code === "forbidden");

    const optedOut = await fixture(db, { actor: false, schedule: false });
    await assert.rejects(run(optedOut.accountId, optedOut.fetchId), (e) => e instanceof AppError && e.code === "forbidden");
    const noSchedule = await fixture(db, { actor: false });
    await assert.rejects(run(noSchedule.accountId, noSchedule.fetchId), (e) => e instanceof AppError && e.code === "forbidden");

    assert.equal(spy.state.opened, 0);
    assert.equal(store.objects.size, 0);

    const allowed = await fixture(db, { actor: false, schedule: true });
    await run(allowed.accountId, allowed.fetchId);
    assert.deepEqual([spy.state.opened, spy.state.closed, store.objects.size], [1, 1, 1]);
    assert.equal((await status(db, allowed.fetchId)).status, "complete");
  } finally {
    await db.destroy();
  }
});

test("a fake PDF, an HTML login page or an unreachable bucket never leave an asset stored and always close the session",
  { skip }, async () => {
  const db = await testDb();
  try {
    const cases: [string, FileResponse, string][] = [
      ["html where a pdf is expected", { status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") }, "schema_changed"],
      ["pdf content type with other bytes", { status: 200, contentType: "application/pdf", bytes: Buffer.from("<html>login</html>") }, "schema_changed"],
      ["error status", { status: 500, contentType: "application/pdf", bytes: pdf.bytes }, "schema_changed"],
    ];
    for (const [label, response, code] of cases) {
      const spy = sessionSpy(response), store = memoryStore();
      const f = await fixture(db);
      await assert.rejects(new FileFetchProcessor(db, spy.factory, store).process(f.accountId, f.fetchId),
        (e) => e instanceof AppError && e.code === code, label);
      assert.equal(store.objects.size, 0, label);
      assert.equal((await db.query("SELECT state FROM file_assets WHERE id=?", [f.fileId]))[0].state, "failed", label);
      assert.deepEqual([spy.state.opened, spy.state.closed], [1, 1], label);
    }

    const down = sessionSpy();
    const f = await fixture(db);
    await assert.rejects(new FileFetchProcessor(db, down.factory, { put: async () => { throw new Error("s3 down"); } }).process(f.accountId, f.fetchId),
      (e) => e instanceof AppError && e.code === "storage_unavailable");
    assert.equal((await db.query("SELECT state FROM file_assets WHERE id=?", [f.fileId]))[0].state, "failed");
    assert.deepEqual([down.state.opened, down.state.closed], [1, 1]);
  } finally {
    await db.destroy();
  }
});

test("S3 written but MySQL down leaves a failed asset and a deterministic, overwritable object; a retry stores it",
  { skip }, async () => {
  const db = await testDb();
  try {
    const f = await fixture(db);
    const store = memoryStore();
    const spy = sessionSpy();
    const processor = new FileProcessor(db, spy.factory, store);
    const query = db.query.bind(db) as (...args: unknown[]) => Promise<unknown>;
    (db as { query: unknown }).query = async (sql: string, params?: unknown[]) => {
      if (/state='stored'/.test(sql)) throw new Error("mysql went away");
      return query(sql, params);
    };
    try { await assert.rejects(processor.process(f.accountId, f.fileId), /mysql went away/); }
    finally { (db as { query: unknown }).query = query; }

    const key = `${f.accountId}/${f.itemId}/${f.fileId}`;
    assert.deepEqual([...store.objects.keys()], [key], "the object exists under the key derived from the asset row");
    const row = (await db.query("SELECT state,object_key FROM file_assets WHERE id=?", [f.fileId]))[0];
    assert.deepEqual([row.state, row.object_key], ["failed", null], "no reference to the object was recorded");
    assert.equal(spy.state.closed, 1);

    await processor.process(f.accountId, f.fileId);
    assert.deepEqual([...store.objects.keys()], [key], "the retry overwrites the same key: no second object");
    assert.equal((await db.query("SELECT state FROM file_assets WHERE id=?", [f.fileId]))[0].state, "stored");
  } finally {
    await db.destroy();
  }
});

test("a generated document whose sanitized copy fails keeps only the original under its own suffix and is not stored",
  { skip }, async () => {
  const db = await testDb();
  try {
    const f = await fixture(db, { kind: "generated_document" });
    const objects = new Map<string, Buffer>();
    const store = { put: async (key: string, bytes: Buffer) => {
      if (!key.endsWith(".original")) throw new Error("s3 down");
      objects.set(key, bytes);
    } };
    const spy = sessionSpy({ status: 200, contentType: "text/html", bytes: Buffer.from("<p>Ficticio</p>"), verifiedGeneratedDocument: true });
    await assert.rejects(new FileProcessor(db, spy.factory, store).process(f.accountId, f.fileId),
      (e) => e instanceof AppError && e.code === "storage_unavailable");
    assert.deepEqual([...objects.keys()], [`${f.accountId}/${f.itemId}/${f.fileId}.original`]);
    assert.equal((await db.query("SELECT state FROM file_assets WHERE id=?", [f.fileId]))[0].state, "failed");
    assert.equal(spy.state.closed, 1);
  } finally {
    await db.destroy();
  }
});

test("an explicit read is denied for a deactivated account and never opens a session",
  { skip }, async () => {
  const db = await testDb();
  try {
    const f = await fixture(db);
    const eventId = randomUUID();
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,'pending',1)",
      [eventId, f.itemId, f.accountId, f.actorId, `key-${eventId}`]);
    await db.query("UPDATE sunat_accounts SET active=false WHERE id=?", [f.accountId]);
    let opened = 0;
    await assert.rejects(new ReadProcessor(db, () => { opened++; throw new Error("unreachable"); }).process(f.accountId, eventId),
      (e) => e instanceof AppError && e.code === "forbidden");
    assert.equal(opened, 0);
    assert.equal((await db.query("SELECT status FROM mail_read_events WHERE id=?", [eventId]))[0].status, "denied");
  } finally {
    await db.destroy();
  }
});
