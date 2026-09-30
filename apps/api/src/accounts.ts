import { createHmac, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError, encryptForWorker } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

type AccountInput = { alias?: unknown; ruc?: unknown; solUser?: unknown };
type UpdateInput = { alias?: unknown; solUser?: unknown };

function requiredText(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new AppError("validation");
  return value.trim();
}

function publicKey(): { pem: string; keyId: string } {
  const pem = process.env.SOL_PUBLIC_KEY_PEM?.replace(/\\n/g, "\n");
  const keyId = process.env.SOL_KEY_ID;
  if (!pem || !keyId) throw new Error("SOL public encryption key is not configured");
  return { pem, keyId };
}

function rucFingerprint(ruc: string): Buffer {
  const encoded = process.env.ACCOUNT_FINGERPRINT_KEY_B64;
  if (!encoded) throw new Error("Account fingerprint key is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length < 32) throw new Error("Account fingerprint key is too short");
  return createHmac("sha256", key).update(ruc).digest();
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async list(actor: Principal) {
    this.auth.requirePermission(actor, "manage_accounts");
    return this.db.query(`SELECT a.id,a.alias,a.ruc_masked AS rucMasked,
      a.sol_user_masked AS solUserMasked,a.active,
      (SELECT c.status FROM sunat_credentials c WHERE c.account_id=a.id ORDER BY c.version DESC LIMIT 1) AS credentialStatus
      FROM sunat_accounts a ORDER BY a.alias`);
  }

  async create(actor: Principal, input: AccountInput): Promise<{ id: string }> {
    this.auth.requirePermission(actor, "manage_accounts");
    const alias = requiredText(input.alias, 160);
    const ruc = requiredText(input.ruc, 11);
    const solUser = requiredText(input.solUser, 100);
    if (!/^\d{11}$/.test(ruc)) throw new AppError("validation");
    const { pem, keyId } = publicKey();
    const id = randomUUID();
    const fingerprint = rucFingerprint(ruc);
    const rucEncrypted = encryptForWorker(ruc, pem, keyId);
    const userEncrypted = encryptForWorker(solUser, pem, keyId);
    await this.db.transaction(async (manager) => {
      const existing: { id: string }[] = await manager.query("SELECT id FROM sunat_accounts WHERE ruc_fingerprint=?", [fingerprint]);
      if (existing.length) throw new AppError("validation");
      await manager.query(
        `INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext,ruc_fingerprint,ruc_masked,sol_user_masked)
         VALUES (?,?,?,?,?,?,?)`,
        [id, alias, rucEncrypted, userEncrypted, fingerprint, `*******${ruc.slice(-4)}`, `${solUser.slice(0, 2)}***`],
      );
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, id, "create", "account", id],
      );
    });
    return { id };
  }

  async update(actor: Principal, accountId: string, input: UpdateInput): Promise<void> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    const alias = requiredText(input.alias, 160);
    const solUser = requiredText(input.solUser, 100);
    const { pem, keyId } = publicKey();
    await this.db.transaction(async (manager) => {
      const result = await manager.query(
        "UPDATE sunat_accounts SET alias=?,sol_user_ciphertext=?,sol_user_masked=? WHERE id=?",
        [alias, encryptForWorker(solUser, pem, keyId), `${solUser.slice(0, 2)}***`, accountId],
      );
      if (!result.affectedRows) throw new AppError("not_found");
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "update", "account", accountId],
      );
    });
  }

  async replaceCredential(actor: Principal, accountId: string, secret: unknown): Promise<void> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    if (typeof secret !== "string" || !secret || secret.length > 1024) throw new AppError("validation");
    const { pem, keyId } = publicKey();
    const encrypted = encryptForWorker(secret, pem, keyId);
    const envelope = JSON.parse(encrypted.toString("utf8")) as { nonce: string };
    await this.db.transaction(async (manager) => {
      const accounts: { id: string; active: number }[] = await manager.query("SELECT id,active FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active) throw new AppError("paused");
      const rows: { next_version: number }[] = await manager.query(
        "SELECT COALESCE(MAX(version),0)+1 AS next_version FROM sunat_credentials WHERE account_id=?", [accountId]);
      await manager.query(
        "INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), accountId, Number(rows[0].next_version), encrypted, Buffer.from(envelope.nonce, "base64"), keyId, "untested"],
      );
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "credential", "credential", accountId],
      );
    });
  }

  async setActive(actor: Principal, accountId: string, active: unknown): Promise<void> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    if (typeof active !== "boolean") throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      const result = await manager.query(
        "UPDATE sunat_accounts SET active=?,disabled_at=IF(?,NULL,UTC_TIMESTAMP(6)) WHERE id=?",
        [active, active, accountId],
      );
      if (!result.affectedRows) throw new AppError("not_found");
      if (!active) await manager.query("UPDATE sync_schedules SET state='disabled',next_run_at=NULL WHERE account_id=?", [accountId]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, active ? "enable" : "disable", "account", accountId],
      );
    });
  }
}
