import { randomUUID } from "node:crypto";
import { EntityManager } from "typeorm";

/** Active users whose role grants `permission` and who can see the account when the notice is created. */
async function recipients(manager: EntityManager, accountId: string, permission: string): Promise<string[]> {
  const rows: { id: string }[] = await manager.query(
    `SELECT DISTINCT u.id FROM app_users u JOIN roles r ON r.id=u.role_id
     JOIN role_permissions p ON p.role_id=r.id AND p.permission=?
     WHERE u.status='active' AND (r.all_accounts=true OR EXISTS
       (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=?))`,
    [permission, accountId]);
  return rows.map((row) => row.id);
}

/** Notices carry a kind and counts only: never subjects, bodies, RUC or remote values. */
async function notify(manager: EntityManager, accountId: string, users: string[], kind: string,
  payload?: Record<string, number | string>): Promise<void> {
  for (const userId of users) await manager.query(
    "INSERT INTO in_app_notices (id,account_id,user_id,kind,payload_json) VALUES (?,?,?,?,?)",
    [randomUUID(), accountId, userId, kind, payload ? JSON.stringify(payload) : null]);
}

export async function noticeAdmins(manager: EntityManager, accountId: string, kind: string): Promise<void> {
  await notify(manager, accountId, await recipients(manager, accountId, "manage_accounts"), kind);
}

export async function noticeMailboxViewers(manager: EntityManager, accountId: string, kind: string,
  payload: Record<string, number | string>): Promise<void> {
  await notify(manager, accountId, await recipients(manager, accountId, "view_mailbox"), kind, payload);
}
