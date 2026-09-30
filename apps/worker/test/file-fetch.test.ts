import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { FileFetchProcessor } from "../src/file-fetch";
import { testDb } from "./db";

test("revoked download permission denies queued file fetch before remote call",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
    const db = await testDb();
    const accountId = randomUUID(), itemId = randomUUID(), fileId = randomUUID();
    const roleId = randomUUID(), actorId = randomUUID(), readId = randomUUID(), fetchId = randomUUID();
    let remoteCalls = 0;
    try {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
      await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,false)", [roleId, `File role ${roleId}`]);
      await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "download_file"]);
      await db.query("INSERT INTO role_sunat_accounts (role_id,account_id) VALUES (?,?)", [roleId, accountId]);
      await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [actorId, `file-${actorId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
      await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
        [itemId, accountId, 1, "999001", 1, JSON.stringify({ codMensaje: "999001" })]);
      await db.query(
        "INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status) VALUES (?,?,?,?,?,'complete')",
        [readId, itemId, accountId, actorId, "fictional-read-key"]);
      await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
        [fileId, itemId, accountId, "attachment", 0, "0", "available"]);
      await db.query("INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [fetchId, fileId, accountId, actorId]);
      await db.query("DELETE FROM role_permissions WHERE role_id=? AND permission='download_file'", [roleId]);
      const processor = new FileFetchProcessor(db, () => ({ async fetch() {
        remoteCalls++;
        return { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };
      } }), { async put() { throw new Error("Must not store"); } });
      await assert.rejects(processor.process(accountId, fetchId),
        (error) => error instanceof AppError && error.code === "forbidden");
      assert.equal(remoteCalls, 0);
      const event: { status: string; error_code: string }[] = await db.query(
        "SELECT status,error_code FROM file_fetches WHERE id=?", [fetchId]);
      assert.deepEqual([event[0].status, event[0].error_code], ["denied", "forbidden"]);
      const asset: { state: string }[] = await db.query("SELECT state FROM file_assets WHERE id=?", [fileId]);
      assert.equal(asset[0].state, "available");
    } finally {
      await db.destroy();
    }
  });
