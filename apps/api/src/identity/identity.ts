import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import argon2 from "argon2";
import { DataSource, EntityManager } from "typeorm";
import { AppError, PERMISSIONS, type Permission } from "@buzon-sol/domain";
import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { validId } from "../common/ids";
import { AuthService, normalizeEmail, type Principal } from "../auth/auth";
import { SettingsService } from "../settings/settings";

type RoleInput = { name?: unknown; permissions?: unknown; allAccounts?: unknown; accountIds?: unknown };
type UserInput = { name?: unknown; email?: unknown; password?: unknown; roleId?: unknown };

function validName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160) throw new AppError("validation");
  return value.trim();
}

function validRoleInput(input: RoleInput): { name: string; permissions: Permission[]; allAccounts: boolean; accountIds: string[] } {
  const name = validName(input.name);
  if (name.length > 100) throw new AppError("validation");
  if (!Array.isArray(input.permissions) || !input.permissions.every((p) => PERMISSIONS.includes(p))) throw new AppError("validation");
  if (typeof input.allAccounts !== "boolean" || !Array.isArray(input.accountIds)) throw new AppError("validation");
  const accountIds = input.accountIds.map(validId);
  return { name, permissions: [...new Set(input.permissions)], allAccounts: input.allAccounts, accountIds: [...new Set(accountIds)] };
}

@Injectable()
export class IdentityService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SettingsService) private readonly settings: SettingsService) {}

  /** Alias only: lets whoever assigns accounts to roles pick them without seeing account data. */
  async accountOptions(actor: Principal): Promise<{ id: string; alias: string }[]> {
    if (!actor.permissions.includes("manage_users_roles") && !actor.permissions.includes("manage_accounts")) throw new AppError("forbidden");
    return this.db.query("SELECT id,alias FROM sunat_accounts ORDER BY alias");
  }

  async setReadWarning(actor: Principal, enabled: unknown): Promise<void> {
    if (typeof enabled !== "boolean") throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      await manager.query("UPDATE app_users SET read_warning_enabled=? WHERE id=?", [enabled, actor.id]);
      await recordAudit(manager, { actorId: actor.id, action: "preference", objectType: "preference", objectId: actor.id, change: { readWarningEnabled: enabled } });
    });
  }

  async createRole(actor: Principal, input: RoleInput): Promise<{ id: string }> {
    this.auth.requirePermission(actor, "manage_users_roles");
    const role = validRoleInput(input);
    const id = randomUUID();
    await this.db.transaction(async (manager) => {
      await this.requireAccountsExist(manager, role.accountIds);
      await manager.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,?)", [id, role.name, role.allAccounts]);
      await this.setRoleRelations(manager, id, role);
      await recordAudit(manager, { actorId: actor.id, action: "create", objectType: "role", objectId: id });
    });
    return { id };
  }

  async updateRole(actor: Principal, roleId: string, input: RoleInput): Promise<void> {
    this.auth.requirePermission(actor, "manage_users_roles");
    validId(roleId);
    const role = validRoleInput(input);
    if (actor.roleId === roleId && !role.permissions.includes("manage_users_roles")) throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      await this.requireAccountsExist(manager, role.accountIds);
      const result = await manager.query("UPDATE roles SET name=?,all_accounts=? WHERE id=?", [role.name, role.allAccounts, roleId]);
      if (!result.affectedRows) throw new AppError("not_found");
      await manager.query("DELETE FROM role_permissions WHERE role_id=?", [roleId]);
      await manager.query("DELETE FROM role_sunat_accounts WHERE role_id=?", [roleId]);
      await this.setRoleRelations(manager, roleId, role);
      await recordAudit(manager, { actorId: actor.id, action: "update", objectType: "role", objectId: roleId });
    });
  }

  private async setRoleRelations(manager: EntityManager, id: string, role: ReturnType<typeof validRoleInput>): Promise<void> {
    for (const permission of role.permissions) {
      await manager.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [id, permission]);
    }
    for (const accountId of role.accountIds) {
      await manager.query("INSERT INTO role_sunat_accounts (role_id,account_id) VALUES (?,?)", [id, accountId]);
    }
  }

  private async requireAccountsExist(manager: EntityManager, ids: string[]): Promise<void> {
    for (const id of ids) {
      const rows: { id: string }[] = await manager.query("SELECT id FROM sunat_accounts WHERE id=?", [id]);
      if (!rows.length) throw new AppError("not_found");
    }
  }

  private async requireRoleExists(manager: EntityManager, id: string): Promise<void> {
    const rows: { id: string }[] = await manager.query("SELECT id FROM roles WHERE id=?", [id]);
    if (!rows.length) throw new AppError("not_found");
  }

  async createUser(actor: Principal, input: UserInput): Promise<{ id: string }> {
    this.auth.requirePermission(actor, "manage_users_roles");
    const name = validName(input.name);
    const email = normalizeEmail(input.email);
    const roleId = validId(input.roleId);
    const minLength = await this.settings.get("security.passwordMinLength");
    if (typeof input.password !== "string" || input.password.length < minLength || input.password.length > 1024) throw new AppError("validation");
    const hash = await argon2.hash(input.password, { type: argon2.argon2id });
    const id = randomUUID();
    await this.db.transaction(async (manager) => {
      await this.requireRoleExists(manager, roleId);
      await manager.query(
        "INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [id, email, name, hash, "active", roleId],
      );
      await recordAudit(manager, { actorId: actor.id, action: "create", objectType: "user", objectId: id });
    });
    return { id };
  }

  async setUserStatus(actor: Principal, userId: string, status: unknown): Promise<void> {
    this.auth.requirePermission(actor, "manage_users_roles");
    validId(userId);
    if (status !== "active" && status !== "disabled") throw new AppError("validation");
    if (actor.id === userId && status === "disabled") throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      const result = await manager.query("UPDATE app_users SET status=? WHERE id=?", [status, userId]);
      if (!result.affectedRows) throw new AppError("not_found");
      if (status === "disabled") await manager.query("UPDATE app_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL", [userId]);
      await recordAudit(manager, { actorId: actor.id, action: status === "disabled" ? "disable" : "enable", objectType: "user", objectId: userId });
    });
  }

  async updateUser(actor: Principal, userId: string, input: UserInput): Promise<void> {
    this.auth.requirePermission(actor, "manage_users_roles");
    validId(userId);
    const name = validName(input.name);
    const email = normalizeEmail(input.email);
    const roleId = validId(input.roleId);
    await this.db.transaction(async (manager) => {
      await this.requireRoleExists(manager, roleId);
      const result = await manager.query("UPDATE app_users SET name=?,email=?,role_id=? WHERE id=?", [name, email, roleId, userId]);
      if (!result.affectedRows) throw new AppError("not_found");
      await recordAudit(manager, { actorId: actor.id, action: "update", objectType: "user", objectId: userId });
    });
  }

  async listUsers(actor: Principal) {
    this.auth.requirePermission(actor, "manage_users_roles");
    return this.db.query(
      `SELECT u.id,u.email,u.name,u.status,u.role_id AS roleId,r.name AS roleName,
         (SELECT MAX(s.created_at) FROM app_sessions s WHERE s.user_id=u.id) AS lastLoginAt
       FROM app_users u JOIN roles r ON r.id=u.role_id ORDER BY u.name`);
  }

  async listRoles(actor: Principal): Promise<{ id: string; name: string; allAccounts: boolean; permissions: Permission[]; accountIds: string[]; userCount: number }[]> {
    this.auth.requirePermission(actor, "manage_users_roles");
    const roles: { id: string; name: string; allAccounts: number; userCount: number }[] = await this.db.query(
      `SELECT r.id,r.name,r.all_accounts AS allAccounts,
         (SELECT COUNT(*) FROM app_users u WHERE u.role_id=r.id AND u.status<>'disabled') AS userCount
       FROM roles r ORDER BY r.name`);
    return Promise.all(roles.map(async (role) => {
      const [permissions, accounts]: [{ permission: Permission }[], { account_id: string }[]] = await Promise.all([
        this.db.query("SELECT permission FROM role_permissions WHERE role_id=?", [role.id]),
        this.db.query("SELECT account_id FROM role_sunat_accounts WHERE role_id=?", [role.id]),
      ]);
      return { id: role.id, name: role.name, allAccounts: Boolean(role.allAccounts), userCount: Number(role.userCount),
        permissions: permissions.map((p) => p.permission), accountIds: accounts.map((a) => a.account_id) };
    }));
  }
}
