import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import test from "node:test";
import { encryptForWorker, envelopeKeyId } from "@buzon-sol/domain";
import { loadSolCredential } from "../src/credentials";
import { rotateSecrets } from "../src/rotate-keys";
import { testDb } from "./db";

const pair = () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { publicKey: keys.publicKey.export({ format: "pem", type: "spki" }).toString(),
    privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString() };
};

test("master key rotation re-encrypts identifiers and every credential version, then the old key can go",
  { timeout: 20000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const oldKey = pair(), newKey = pair();
  const saved = ["SOL_PRIVATE_KEY_PEM", "SOL_PREVIOUS_KEY_ID", "SOL_PREVIOUS_PRIVATE_KEY_PEM"].map((name) => [name, process.env[name]] as const);
  const db = await testDb();
  const accountId = randomUUID();
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Rotation fixture", encryptForWorker("99999999999", oldKey.publicKey, "rot-v1"),
        encryptForWorker("USUARIO_FICTICIO", oldKey.publicKey, "rot-v1")]);
    for (const [version, password] of [[1, "old-fictional"], [2, "new-fictional"]] as const) {
      const encrypted = encryptForWorker(password, oldKey.publicKey, "rot-v1");
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), accountId, version, encrypted, Buffer.from(JSON.parse(encrypted.toString()).nonce, "base64"), "rot-v1", "valid"]);
    }
    // During rotation the worker holds the new key as current and the old one as previous.
    process.env.SOL_PRIVATE_KEY_PEM = newKey.privateKey;
    process.env.SOL_PREVIOUS_KEY_ID = "rot-v1";
    process.env.SOL_PREVIOUS_PRIVATE_KEY_PEM = oldKey.privateKey;
    assert.equal((await loadSolCredential(db, accountId)).password, "new-fictional");
    const first = await rotateSecrets(db, { publicKeyPem: newKey.publicKey, keyId: "rot-v2" });
    assert.ok(first.accounts >= 1 && first.credentials >= 2);
    const again = await rotateSecrets(db, { publicKeyPem: newKey.publicKey, keyId: "rot-v2" });
    assert.equal(again.accounts, 0);

    const account: { ruc_ciphertext: Buffer }[] = await db.query("SELECT ruc_ciphertext FROM sunat_accounts WHERE id=?", [accountId]);
    assert.equal(envelopeKeyId(account[0].ruc_ciphertext), "rot-v2");
    const keyIds: { key_id: string }[] = await db.query("SELECT key_id FROM sunat_credentials WHERE account_id=?", [accountId]);
    assert.deepEqual(keyIds.map((row) => row.key_id), ["rot-v2", "rot-v2"]);
    const audit: { change_json: unknown }[] = await db.query(
      "SELECT change_json FROM audit_events WHERE account_id=? AND action='rotate_key'", [accountId]);
    assert.equal(audit.length, 1);
    assert.equal(JSON.stringify(audit).includes("fictional"), false);

    // The previous key is removed; everything still opens with the new key only.
    delete process.env.SOL_PREVIOUS_KEY_ID;
    delete process.env.SOL_PREVIOUS_PRIVATE_KEY_PEM;
    assert.deepEqual(await loadSolCredential(db, accountId),
      { ruc: "99999999999", solUser: "USUARIO_FICTICIO", password: "new-fictional", keyId: "rot-v2" });
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await db.destroy();
  }
});
