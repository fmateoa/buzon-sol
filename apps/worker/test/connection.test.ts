import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import test from "node:test";
import { encryptForWorker } from "@buzon-sol/domain";
import { ConnectionProcessor } from "../src/connection";
import { testDb } from "./db";

test("connection test rejects invalid credential and rechecks actor and credential version",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
    const db = await testDb();
    const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicKey = key.publicKey.export({ type: "spki", format: "pem" }).toString();
    process.env.SOL_PRIVATE_KEY_PEM = key.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const accountId = randomUUID(), roleId = randomUUID(), actorId = randomUUID(), credentialId = randomUUID();
    const envelope = (plain: string) => encryptForWorker(plain, publicKey, "test-key");
    let calls = 0;
    try {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [accountId, "Ficticia", envelope("99999999999"), envelope("USUARIO_FICTICIO")]);
      await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Test role ${roleId}`]);
      await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "manage_accounts"]);
      await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [actorId, `connection-${actorId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
      const ciphertext = envelope("CLAVE_FICTICIA");
      const nonce = Buffer.from((JSON.parse(ciphertext.toString()) as { nonce: string }).nonce, "base64");
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [credentialId, accountId, 1, ciphertext, nonce, "test-key", "untested"]);
      await db.query(
        `INSERT INTO sync_schedules (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state)
         VALUES (?,?,?,?,?,?,?,'active')`,
        [randomUUID(), accountId, "daily", JSON.stringify(["mon"]), "08:00:00", "17:00:00", JSON.stringify(["messages"])]);
      const invalidId = randomUUID();
      await db.query("INSERT INTO connection_tests (id,account_id,credential_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [invalidId, accountId, credentialId, actorId]);
      await new ConnectionProcessor(db, (credential) => {
        assert.equal(credential.password, "CLAVE_FICTICIA");
        return { async testConnection() { calls++; return "invalid"; } };
      }).process(accountId, invalidId);
      assert.equal(calls, 1);
      const invalid: { status: string; error_code: string }[] = await db.query(
        "SELECT status,error_code FROM connection_tests WHERE id=?", [invalidId]);
      assert.deepEqual([invalid[0].status, invalid[0].error_code], ["invalid", "invalid_credential"]);
      const rejected: { status: string }[] = await db.query("SELECT status FROM sunat_credentials WHERE id=?", [credentialId]);
      assert.equal(rejected[0].status, "rejected");
      const schedule: { state: string }[] = await db.query("SELECT state FROM sync_schedules WHERE account_id=?", [accountId]);
      assert.equal(schedule[0].state, "paused");
      const notices: { n: number }[] = await db.query(
        "SELECT COUNT(*) AS n FROM in_app_notices WHERE account_id=? AND user_id=? AND kind='invalid_credential'",
        [accountId, actorId]);
      assert.equal(Number(notices[0].n), 1);
      const newCredentialId = randomUUID(), staleId = randomUUID(), deniedId = randomUUID();
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [newCredentialId, accountId, 2, ciphertext, nonce, "test-key", "untested"]);
      await db.query("INSERT INTO connection_tests (id,account_id,credential_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [staleId, accountId, credentialId, actorId]);
      await new ConnectionProcessor(db, () => { throw new Error("Must not contact SUNAT"); }).process(accountId, staleId);
      const stale: { status: string }[] = await db.query("SELECT status FROM connection_tests WHERE id=?", [staleId]);
      assert.equal(stale[0].status, "superseded");
      await db.query("UPDATE app_users SET status='disabled' WHERE id=?", [actorId]);
      await db.query("INSERT INTO connection_tests (id,account_id,credential_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [deniedId, accountId, newCredentialId, actorId]);
      await new ConnectionProcessor(db, () => { throw new Error("Must not contact SUNAT"); }).process(accountId, deniedId);
      const denied: { status: string }[] = await db.query("SELECT status FROM connection_tests WHERE id=?", [deniedId]);
      assert.equal(denied[0].status, "denied");
    } finally {
      delete process.env.SOL_PRIVATE_KEY_PEM;
      await db.destroy();
    }
  });
