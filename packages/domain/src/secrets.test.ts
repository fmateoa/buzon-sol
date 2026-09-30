import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { decryptInWorker, encryptForWorker } from "./secrets.js";

test("only the matching worker private key opens an authenticated envelope", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKey = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
  const privateKey = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const encrypted = encryptForWorker("fictional-password", publicKey, "test-v1");
  assert.equal(encrypted.includes(Buffer.from("fictional-password")), false);
  assert.equal(decryptInWorker(encrypted, privateKey), "fictional-password");
  const otherKey = other.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  assert.throws(() => decryptInWorker(encrypted, otherKey));
  const changed = JSON.parse(encrypted.toString());
  changed.ciphertext = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptInWorker(Buffer.from(JSON.stringify(changed)), privateKey));
});
