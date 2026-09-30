import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import test from "node:test";
import { encryptForWorker } from "@buzon-sol/domain";
import { loadSolCredential } from "../src/credentials";
import { testDb } from "./db";

test("only worker private key opens account and current SOL credential", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKey = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
  process.env.SOL_PRIVATE_KEY_PEM = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const db = await testDb();
  const accountId = randomUUID();
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", encryptForWorker("99999999999", publicKey, "test-v1"),
        encryptForWorker("USUARIO_FICTICIO", publicKey, "test-v1")]);
    for (const [version, password] of [[1, "old-fictional"], [2, "new-fictional"]] as const) {
      const encrypted = encryptForWorker(password, publicKey, "test-v1");
      const envelope = JSON.parse(encrypted.toString());
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), accountId, version, encrypted, Buffer.from(envelope.nonce, "base64"), "test-v1", "valid"]);
    }
    const credential = await loadSolCredential(db, accountId);
    assert.deepEqual(credential, { ruc: "99999999999", solUser: "USUARIO_FICTICIO", password: "new-fictional", keyId: "test-v1" });
  } finally {
    delete process.env.SOL_PRIVATE_KEY_PEM;
    await db.destroy();
  }
});
