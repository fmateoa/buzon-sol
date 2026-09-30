import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ReadProcessor } from "../src/reading";
import { testDb } from "./db";

test("explicit read persists safe content and does not repeat a remote call", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID(), itemId = randomUUID(), eventId = randomUUID();
  const roleId = randomUUID(), userId = randomUUID();
  let calls = 0;
  const processor = new ReadProcessor(db, {
    async readDetail() {
      calls++;
      return { body: '<p>Ficticio</p><script>bad()</script><a href="javascript:bad()">link</a>', updateLeido: true,
        files: [{ kind: "generated_document" as const, codArchivo: null, numId: "fixture-document" },
          { kind: "attachment" as const, codArchivo: 0, name: "ficticio.pdf" }] };
    },
    async observeState() { return 1; },
  });
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Reader ${roleId}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "read_content"]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [userId, `reader-${userId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [itemId, accountId, 1, "123", 0, JSON.stringify({ codMensaje: 123 })]);
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,?,?)",
      [eventId, itemId, accountId, userId, "test-read-one", "pending", 0]);
    await processor.process(accountId, eventId);
    await processor.process(accountId, eventId);
    assert.equal(calls, 1);
    const rows: { safe_body: string; ind_estado: number; status: string; update_leido: number }[] = await db.query(
      "SELECT d.safe_body,i.ind_estado,e.status,e.update_leido FROM mail_read_events e JOIN mail_items i ON i.id=e.item_id JOIN mail_details d ON d.item_id=i.id WHERE e.id=?", [eventId]);
    assert.equal(rows[0].safe_body.includes("<script>"), false);
    assert.equal(rows[0].safe_body.includes("javascript:"), false);
    assert.equal(rows[0].ind_estado, 1);
    assert.equal(rows[0].status, "complete");
    assert.equal(rows[0].update_leido, 1);
    const assets: { kind: string; cod_archivo: string | null }[] = await db.query(
      "SELECT kind,cod_archivo FROM file_assets WHERE item_id=? ORDER BY kind", [itemId]);
    assert.deepEqual(assets.map((asset) => [asset.kind, asset.cod_archivo]),
      [["attachment", "0"], ["generated_document", null]]);

    const failedId = randomUUID();
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,?,?)",
      [failedId, itemId, accountId, userId, "test-read-two", "pending", 1]);
    let failedCalls = 0;
    const failing = new ReadProcessor(db, { async readDetail() { failedCalls++; throw new Error("remote failed after opening"); },
      async observeState() { return null; } });
    await assert.rejects(failing.process(accountId, failedId));
    await failing.process(accountId, failedId);
    assert.equal(failedCalls, 1);
    const failed: { status: string }[] = await db.query("SELECT status FROM mail_read_events WHERE id=?", [failedId]);
    assert.equal(failed[0].status, "uncertain");
    const revokedId = randomUUID();
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,?,?)",
      [revokedId, itemId, accountId, userId, "test-read-three", "pending", 1]);
    await db.query("DELETE FROM role_permissions WHERE role_id=?", [roleId]);
    await assert.rejects(processor.process(accountId, revokedId), (error) => error instanceof Error && error.message === "forbidden");
    assert.equal(calls, 1);
    const revoked: { status: string }[] = await db.query("SELECT status FROM mail_read_events WHERE id=?", [revokedId]);
    assert.equal(revoked[0].status, "denied");
    const uncertainId = randomUUID();
    await db.query("INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before) VALUES (?,?,?,?,?,?,?)",
      [uncertainId, itemId, accountId, userId, "test-read-four", "calling", 1]);
    await processor.process(accountId, uncertainId);
    const uncertain: { status: string }[] = await db.query("SELECT status FROM mail_read_events WHERE id=?", [uncertainId]);
    assert.equal(uncertain[0].status, "uncertain");
    assert.equal(calls, 1);
  } finally {
    await db.destroy();
  }
});
