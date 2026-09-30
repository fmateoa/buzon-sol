import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Injectable, Inject } from "@nestjs/common";
import argon2 from "argon2";
import { DataSource } from "typeorm";
import { AppError, requireAccountAccess, type Permission } from "@buzon-sol/domain";

export const DB = "DATABASE";
const SESSION_HOURS = 12;

type UserRow = { id: string; email: string; name: string; status: string; role_id: string; password_hash: string; all_accounts: number };
type SessionRow = UserRow & { session_id: string };
type PermissionRow = { permission: Permission };
type AccountRow = { account_id: string };

export interface Principal {
  id: string;
  email: string;
  name: string;
  roleId: string;
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
  constructor(@Inject(DB) private readonly db: DataSource) {}

  async login(emailInput: unknown, password: unknown): Promise<{ token: string; expiresAt: string }> {
    const email = normalizeEmail(emailInput);
    if (typeof password !== "string" || !password || password.length > 1024) throw new AppError("validation");
    const rows: UserRow[] = await this.db.query(
      "SELECT u.*, r.all_accounts FROM app_users u JOIN roles r ON r.id=u.role_id WHERE u.email=? LIMIT 1",
      [email],
    );
    const user = rows[0];
    if (!user || user.status !== "active" || !(await argon2.verify(user.password_hash, password))) {
      throw new AppError("unauthenticated");
    }
    const token = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
    await this.db.transaction(async (manager) => {
      await manager.query(
        "INSERT INTO app_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)",
        [sessionId, user.id, tokenHash(token), expiresAt],
      );
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,action,object_type,object_id) VALUES (?,?,?,?,?)",
        [randomUUID(), user.id, "login", "user", user.id],
      );
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async authenticate(header: unknown): Promise<Principal> {
    if (typeof header !== "string" || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) {
      throw new AppError("unauthenticated");
    }
    const token = header.slice(7);
    const rows: SessionRow[] = await this.db.query(
      `SELECT s.id AS session_id, u.*, r.all_accounts
       FROM app_sessions s JOIN app_users u ON u.id=s.user_id
       JOIN roles r ON r.id=u.role_id
       WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6)
         AND u.status='active' LIMIT 1`,
      [tokenHash(token)],
    );
    const user = rows[0];
    if (!user) throw new AppError("unauthenticated");
    const [permissions, accounts]: [PermissionRow[], AccountRow[]] = await Promise.all([
      this.db.query("SELECT permission FROM role_permissions WHERE role_id=?", [user.role_id]),
      this.db.query("SELECT account_id FROM role_sunat_accounts WHERE role_id=?", [user.role_id]),
    ]);
    return {
      id: user.id, email: user.email, name: user.name, roleId: user.role_id,
      allAccounts: Boolean(user.all_accounts), permissions: permissions.map((p) => p.permission),
      accountIds: accounts.map((a) => a.account_id), sessionId: user.session_id,
    };
  }

  requirePermission(user: Principal, permission: Permission): void {
    if (!user.permissions.includes(permission)) throw new AppError("forbidden");
  }

  requireAccount(user: Principal, permission: Permission, accountId: string): void {
    requireAccountAccess(user.permissions, permission, user.allAccounts, user.accountIds, accountId);
  }

  async logout(user: Principal): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query("UPDATE app_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE id=?", [user.sessionId]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,action,object_type,object_id) VALUES (?,?,?,?,?)",
        [randomUUID(), user.id, "logout", "user", user.id],
      );
    });
  }
}
