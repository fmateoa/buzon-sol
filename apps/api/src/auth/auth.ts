import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Injectable, Inject } from "@nestjs/common";
import argon2 from "argon2";
import { DataSource } from "typeorm";
import { AppError, requireAccountAccess, type Permission } from "@buzon-sol/domain";

import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { SettingsService } from "../settings/settings";

/** Evita una escritura por aviso de actividad: la última actividad solo se refresca pasado este intervalo. */
const TOUCH_MS = 60_000;

type UserRow = { id: string; email: string; name: string; status: string; role_id: string; password_hash: string;
  all_accounts: number; role_name: string; read_warning_enabled: number; failed_logins: number; locked_until: Date | null };
type SessionRow = UserRow & { session_id: string };
type PermissionRow = { permission: Permission };
type AccountRow = { account_id: string };

export interface Principal {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  readWarningEnabled: boolean;
  allAccounts: boolean;
  permissions: Permission[];
  accountIds: string[];
  sessionId: string;
}

function tokenHash(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AppError("validation");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("validation");
  return email;
}

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(SettingsService) private readonly settings: SettingsService) {}

  /** Cuenta un intento fallido y, al llegar al máximo, bloquea el login un tiempo. Nunca revela si el correo existe. */
  private async recordFailedLogin(user: UserRow): Promise<void> {
    const [max, lockoutMinutes] = await Promise.all([
      this.settings.get("security.maxFailedLogins"), this.settings.get("security.lockoutMinutes")]);
    // Un bloqueo vencido empieza una cuenta nueva en vez de re-bloquear con el primer error.
    await this.db.query("UPDATE app_users SET failed_logins=0,locked_until=NULL WHERE id=? AND locked_until<=UTC_TIMESTAMP(6)", [user.id]);
    await this.db.query(
      `UPDATE app_users SET failed_logins=failed_logins+1,
         locked_until=IF(failed_logins>=?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? MINUTE),locked_until) WHERE id=?`,
      [max, lockoutMinutes, user.id]);
    const rows: { failed_logins: number }[] = await this.db.query("SELECT failed_logins FROM app_users WHERE id=?", [user.id]);
    if (rows[0]?.failed_logins === max) {
      await recordAudit(this.db, { actorId: user.id, action: "failure", objectType: "user", objectId: user.id, change: { lockedMinutes: lockoutMinutes } });
    }
  }

  async login(emailInput: unknown, password: unknown): Promise<{ token: string; expiresAt: string }> {
    const email = normalizeEmail(emailInput);
    if (typeof password !== "string" || !password || password.length > 1024) throw new AppError("validation");
    const rows: UserRow[] = await this.db.query(
      "SELECT u.*, r.all_accounts FROM app_users u JOIN roles r ON r.id=u.role_id WHERE u.email=? LIMIT 1",
      [email],
    );
    const user = rows[0];
    if (!user || user.status !== "active") throw new AppError("unauthenticated");
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) throw new AppError("unauthenticated");
    if (!(await argon2.verify(user.password_hash, password))) {
      await this.recordFailedLogin(user);
      throw new AppError("unauthenticated");
    }
    const token = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + await this.settings.get("session.absoluteMinutes") * 60_000);
    await this.db.transaction(async (manager) => {
      if (user.failed_logins || user.locked_until) {
        await manager.query("UPDATE app_users SET failed_logins=0,locked_until=NULL WHERE id=?", [user.id]);
      }
      await manager.query(
        "INSERT INTO app_sessions (id,user_id,token_hash,expires_at,last_seen_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6))",
        [sessionId, user.id, tokenHash(token), expiresAt],
      );
      await recordAudit(manager, { actorId: user.id, action: "login", objectType: "user", objectId: user.id });
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async authenticate(header: unknown): Promise<Principal> {
    if (typeof header !== "string" || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) {
      throw new AppError("unauthenticated");
    }
    const token = header.slice(7);
    const rows: SessionRow[] = await this.db.query(
      `SELECT s.id AS session_id, u.*, r.all_accounts, r.name AS role_name
       FROM app_sessions s JOIN app_users u ON u.id=s.user_id
       JOIN roles r ON r.id=u.role_id
       WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6)
         AND s.last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL ? SECOND)
         AND u.status='active' LIMIT 1`,
      [tokenHash(token), await this.settings.get("session.idleMinutes") * 60],
    );
    const user = rows[0];
    if (!user) throw new AppError("unauthenticated");
    const [permissions, accounts]: [PermissionRow[], AccountRow[]] = await Promise.all([
      this.db.query("SELECT permission FROM role_permissions WHERE role_id=?", [user.role_id]),
      this.db.query("SELECT account_id FROM role_sunat_accounts WHERE role_id=?", [user.role_id]),
    ]);
    return {
      id: user.id, email: user.email, name: user.name, roleId: user.role_id, roleName: user.role_name,
      readWarningEnabled: Boolean(user.read_warning_enabled), allAccounts: Boolean(user.all_accounts), permissions: permissions.map((p) => p.permission),
      accountIds: accounts.map((a) => a.account_id), sessionId: user.session_id,
    };
  }

  requirePermission(user: Principal, permission: Permission): void {
    if (!user.permissions.includes(permission)) throw new AppError("forbidden");
  }

  requireAccount(user: Principal, permission: Permission, accountId: string): void {
    requireAccountAccess(user.permissions, permission, user.allAccounts, user.accountIds, accountId);
  }

  /**
   * Renueva la ventana de inactividad. Solo lo llama la web ante uso real (teclado, clic): las
   * consultas en segundo plano (sondeos) autentican igual pero no deben mantener viva la sesión.
   */
  async touch(user: Principal): Promise<void> {
    await this.db.query(
      "UPDATE app_sessions SET last_seen_at=UTC_TIMESTAMP(6) WHERE id=? AND last_seen_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL ? SECOND)",
      [user.sessionId, TOUCH_MS / 1000]);
  }

  async logout(user: Principal): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query("UPDATE app_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE id=?", [user.sessionId]);
      await recordAudit(manager, { actorId: user.id, action: "logout", objectType: "user", objectId: user.id });
    });
  }
}
