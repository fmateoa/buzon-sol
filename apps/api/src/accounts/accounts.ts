import { createHmac, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError, encryptForWorker } from "@buzon-sol/domain";
import { RUN_STATUS_COLUMNS, RUN_STATUS_JOINS } from "../common/run-status";
import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { AuthService, type Principal } from "../auth/auth";
import { validId } from "../common/ids";

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

  async visibleAccounts(actor: Principal) {
    this.auth.requirePermission(actor, "view_mailbox");
    return this.db.query(
      `SELECT a.id,a.alias,a.active,a.ruc_masked AS rucMasked,
         COALESCE(s.state,'disabled') AS scheduleState,s.pause_reason AS pauseReason,s.next_run_at AS nextRunAt,
         ${RUN_STATUS_COLUMNS}
       FROM sunat_accounts a LEFT JOIN sync_schedules s ON s.account_id=a.id ${RUN_STATUS_JOINS}
       WHERE (?=true OR EXISTS
         (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=? AND ra.account_id=a.id))
       ORDER BY a.alias`,
      [actor.allAccounts, actor.roleId],
    );
  }

  async list(actor: Principal) {
    this.auth.requirePermission(actor, "manage_accounts");
    return this.db.query(`SELECT a.id,a.alias,a.ruc_masked AS rucMasked,
      a.sol_user_masked AS solUserMasked,a.active,a.created_at AS createdAt,
      (SELECT c.status FROM sunat_credentials c WHERE c.account_id=a.id ORDER BY c.version DESC LIMIT 1) AS credentialStatus,
      (SELECT c.replaced_at FROM sunat_credentials c WHERE c.account_id=a.id ORDER BY c.version DESC LIMIT 1) AS credentialSavedAt,
      COALESCE(s.state,'disabled') AS scheduleState,s.pause_reason AS pauseReason,s.next_run_at AS nextRunAt,
      ${RUN_STATUS_COLUMNS},
      (SELECT COUNT(*) FROM app_users u JOIN roles r ON r.id=u.role_id WHERE u.status<>'disabled' AND (r.all_accounts OR EXISTS
        (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=a.id))) AS userCount
      FROM sunat_accounts a LEFT JOIN sync_schedules s ON s.account_id=a.id ${RUN_STATUS_JOINS} ORDER BY a.alias`);
  }

  /** Users whose role reaches the account; the admin sees who is affected before changing it. */
  async users(actor: Principal, accountId: string) {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    return this.db.query(
      `SELECT u.id,u.email,u.name,u.status,u.role_id AS roleId,r.name AS roleName,
         (SELECT MAX(s.created_at) FROM app_sessions s WHERE s.user_id=u.id) AS lastLoginAt
       FROM app_users u JOIN roles r ON r.id=u.role_id
       WHERE r.all_accounts OR EXISTS
         (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=?)
       ORDER BY u.name`, [accountId]);
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
      await recordAudit(manager, { actorId: actor.id, accountId: id, action: "create", objectType: "account", objectId: id });
    });
    return { id };
  }

  async update(actor: Principal, accountId: string, input: UpdateInput): Promise<void> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    const alias = requiredText(input.alias, 160);
    // The SOL user is write-only: omitting it keeps the stored one.
    const solUser = input.solUser === undefined || input.solUser === "" ? null : requiredText(input.solUser, 100);
    const { pem, keyId } = publicKey();
    await this.db.transaction(async (manager) => {
      const result = solUser === null
        ? await manager.query("UPDATE sunat_accounts SET alias=? WHERE id=?", [alias, accountId])
        : await manager.query(
          "UPDATE sunat_accounts SET alias=?,sol_user_ciphertext=?,sol_user_masked=? WHERE id=?",
          [alias, encryptForWorker(solUser, pem, keyId), `${solUser.slice(0, 2)}***`, accountId],
        );
      if (!result.affectedRows) throw new AppError("not_found");
      await recordAudit(manager, { actorId: actor.id, accountId, action: "update", objectType: "account", objectId: accountId });
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
      await recordAudit(manager, { actorId: actor.id, accountId, action: "credential", objectType: "credential", objectId: accountId });
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
      await recordAudit(manager, { actorId: actor.id, accountId, action: active ? "enable" : "disable", objectType: "account", objectId: accountId });
    });
  }
}
