import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { encryptForWorker, envelopeKeyId, logEvent } from "@buzon-sol/domain";
import { openEnvelope } from "./keyring.js";

export interface RotationTarget { publicKeyPem: string; keyId: string }

/** Rotates one account in a single transaction; returns the rewritten credential count, or null if already current. */
async function rotateAccount(db: DataSource, id: string, target: RotationTarget): Promise<number | null> {
  const reseal = (encrypted: Buffer) => encryptForWorker(openEnvelope(encrypted), target.publicKeyPem, target.keyId);
  const stale = (value: Buffer) => envelopeKeyId(value) !== target.keyId;
  return db.transaction(async (manager) => {
    const rows: { ruc_ciphertext: Buffer; sol_user_ciphertext: Buffer }[] = await manager.query(
      "SELECT ruc_ciphertext,sol_user_ciphertext FROM sunat_accounts WHERE id=? FOR UPDATE", [id]);
    const credentials: { id: string; ciphertext: Buffer }[] = await manager.query(
      "SELECT id,ciphertext FROM sunat_credentials WHERE account_id=? FOR UPDATE", [id]);
    const account = rows[0];
    const identity = stale(account.ruc_ciphertext) || stale(account.sol_user_ciphertext);
    const pending = credentials.filter((credential) => stale(credential.ciphertext));
    if (!identity && !pending.length) return null;
    if (identity) await manager.query("UPDATE sunat_accounts SET ruc_ciphertext=?,sol_user_ciphertext=? WHERE id=?",
      [reseal(account.ruc_ciphertext), reseal(account.sol_user_ciphertext), id]);
    for (const credential of pending) {
      const sealed = reseal(credential.ciphertext);
      const nonce = Buffer.from((JSON.parse(sealed.toString("utf8")) as { nonce: string }).nonce, "base64");
      await manager.query("UPDATE sunat_credentials SET ciphertext=?,nonce=?,key_id=? WHERE id=?",
        [sealed, nonce, target.keyId, credential.id]);
    }
    await manager.query(
      "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
      [randomUUID(), id, "rotate_key", "account", id, JSON.stringify({ keyId: target.keyId, credentials: pending.length })]);
    return pending.length;
  });
}

/**
 * Re-encrypts every account identifier and SOL credential version whose envelope names another key. Each account
 * is audited as "rotated" without values; re-running skips finished accounts. An unreadable envelope is reported
 * and skipped so the remaining accounts still rotate.
 */
export async function rotateSecrets(db: DataSource, target: RotationTarget): Promise<{ accounts: number; credentials: number; failed: number }> {
  if (!target.publicKeyPem || !target.keyId) throw new Error("Rotation target key is required");
  const accounts: { id: string }[] = await db.query("SELECT id FROM sunat_accounts ORDER BY id");
  let rotatedAccounts = 0, rotatedCredentials = 0, failed = 0;
  for (const { id } of accounts) {
    try {
      const rewritten = await rotateAccount(db, id, target);
      if (rewritten === null) continue;
      rotatedAccounts++;
      rotatedCredentials += rewritten;
    } catch {
      failed++;
      logEvent("error", "secret_rotation_account_failed", { accountId: id });
    }
  }
  logEvent("info", "secret_rotation_finished", { keyId: target.keyId, accounts: rotatedAccounts, credentials: rotatedCredentials, failed });
  return { accounts: rotatedAccounts, credentials: rotatedCredentials, failed };
}

async function cli(): Promise<void> {
  const { workerDataSource } = await import("./data-source.js");
  const publicKeyPem = process.env.SOL_PUBLIC_KEY_PEM?.replace(/\\n/g, "\n") ?? "";
  const db = await workerDataSource().initialize();
  try {
    const result = await rotateSecrets(db, { publicKeyPem, keyId: process.env.SOL_KEY_ID ?? "" });
    if (result.failed) process.exitCode = 1;
  }
  finally { await db.destroy(); }
}

if (process.argv[1]?.endsWith("rotate-keys.ts")) {
  cli().catch(() => {
    logEvent("error", "secret_rotation_failed");
    process.exitCode = 1;
  });
}
