import { createCipheriv, createDecipheriv, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";

export interface SecretEnvelope {
  version: 1;
  keyId: string;
  nonce: string;
  tag: string;
  wrappedKey: string;
  ciphertext: string;
}

/** The API needs only the worker's public key. The private key stays in the worker. */
export function encryptForWorker(plaintext: string, publicKeyPem: string, keyId: string): Buffer {
  if (!plaintext || !keyId) throw new Error("Secret and key ID are required");
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const envelope: SecretEnvelope = {
    version: 1,
    keyId,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    wrappedKey: publicEncrypt({ key: publicKeyPem, oaepHash: "sha256" }, key).toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  key.fill(0);
  return Buffer.from(JSON.stringify(envelope));
}

export function decryptInWorker(encrypted: Buffer, privateKeyPem: string): string {
  const envelope = JSON.parse(encrypted.toString("utf8")) as SecretEnvelope;
  if (envelope.version !== 1) throw new Error("Unsupported secret envelope");
  const key = privateDecrypt({ key: privateKeyPem, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final(),
    ]).toString("utf8");
  } finally {
    key.fill(0);
  }
}
