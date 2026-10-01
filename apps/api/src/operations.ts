import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

@Injectable()
export class OperationsService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async activity(actor: Principal, accountId: string) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const runs = await this.db.query(
      `SELECT id,mode,state,started_at AS startedAt,finished_at AS finishedAt,
       resume_box AS resumeBox,resume_page AS resumePage,
       pause_reason AS pauseReason,error_code AS errorCode,boxes_json AS boxes,
       folders_state AS foldersState,labels_state AS labelsState,alerts_state AS alertsState,
       JSON_LENGTH(alerts_json) AS alertCount,reauth_count AS reauthCount,
       new_messages AS newMessages,new_notifications AS newNotifications
       FROM sync_runs WHERE account_id=?
       ORDER BY CASE WHEN state='pending' THEN 0 ELSE 1 END,started_at DESC,id DESC LIMIT 20`, [accountId]);
    const current = runs[0] ?? null;
    const pages = current ? await this.db.query(
      `SELECT tipo_msj AS tipoMsj,COUNT(*) AS pagesScanned,SUM(rows_received) AS received,
       SUM(unique_rows) AS uniqueRows,MAX(declared_records) AS declaredRecords,
       MAX(declared_pages) AS declaredPages
       FROM sync_pages WHERE run_id=? GROUP BY tipo_msj`, [current.id]) : [];
    return { accountId, current, pages, history: runs };
  }

  async summary(actor: Principal, accountId: string) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const accounts: { id: string }[] = await this.db.query("SELECT id FROM sunat_accounts WHERE id=?", [accountId]);
    if (!accounts.length) throw new AppError("not_found");
    const latest: { state: string; finished_at: Date | null }[] = await this.db.query(
      `SELECT state,finished_at FROM sync_runs WHERE account_id=?
       ORDER BY CASE WHEN state='pending' THEN 0 ELSE 1 END,started_at DESC,id DESC LIMIT 1`, [accountId]);
    const baseline: { finished_at: Date }[] = await this.db.query(
      "SELECT finished_at FROM sync_runs WHERE account_id=? AND state='complete' ORDER BY finished_at DESC LIMIT 1", [accountId]);
    const counts: { tipo_msj: number; unique_count: number; unread_count: number }[] = await this.db.query(
      `SELECT tipo_msj,COUNT(*) AS unique_count,SUM(ind_estado=0) AS unread_count
       FROM mail_items WHERE account_id=? GROUP BY tipo_msj`, [accountId]);
    const verified = latest[0]?.state === "complete";
    const baselineCounts: { tipo_msj: number; total: number }[] = baseline.length ? await this.db.query(
      "SELECT tipo_msj,COUNT(*) AS total FROM mail_items WHERE account_id=? AND first_seen_at<=? GROUP BY tipo_msj",
      [accountId, baseline[0].finished_at]) : [];
    return { accountId, state: latest[0]?.state ?? null, verified,
      boxes: { messages: { ...this.boxCount(counts, 1), lastVerifiedCount: baseline.length ? this.baselineCount(baselineCounts, 1) : null },
        notifications: { ...this.boxCount(counts, 2), lastVerifiedCount: baseline.length ? this.baselineCount(baselineCounts, 2) : null } } };
  }

  private baselineCount(counts: { tipo_msj: number; total: number }[], code: number): number {
    return Number(counts.find((entry) => entry.tipo_msj === code)?.total ?? 0);
  }

  private boxCount(counts: { tipo_msj: number; unique_count: number; unread_count: number }[], code: number) {
    const row = counts.find((entry) => entry.tipo_msj === code);
    return { uniqueCount: Number(row?.unique_count ?? 0), unreadInSunat: Number(row?.unread_count ?? 0) };
  }

  async audit(actor: Principal, limit = 100) {
    this.auth.requirePermission(actor, "view_audit");
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new AppError("validation");
    return this.db.query(
      `SELECT e.id,e.actor_user_id AS actorId,e.account_id AS accountId,e.action,
        e.object_type AS objectType,e.object_id AS objectId,e.created_at AS at
       FROM audit_events e WHERE (?=true OR
         (e.account_id IS NOT NULL AND EXISTS
           (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=? AND ra.account_id=e.account_id)))
       ORDER BY e.created_at DESC LIMIT ?`, [actor.allAccounts, actor.roleId, limit]);
  }

  async auditCsv(actor: Principal): Promise<string> {
    const rows: { id: string; actorId: string | null; accountId: string | null; action: string;
      objectType: string; objectId: string | null; at: Date }[] = await this.audit(actor, 10_000);
    const values = (row: typeof rows[number]) => [row.id, row.at.toISOString(), row.actorId ?? "", row.accountId ?? "",
      row.action, row.objectType, row.objectId ?? ""];
    return ["id,at,actor_id,account_id,action,object_type,object_id",
      ...rows.map((row) => values(row).map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\r\n");
  }

  async notices(actor: Principal) {
    if (!actor.permissions.includes("view_mailbox") && !actor.permissions.includes("manage_accounts")) throw new AppError("forbidden");
    return this.db.query(
      `SELECT n.id,n.account_id AS accountId,n.kind,n.payload_json AS counts,n.created_at AS at,n.read_at AS readAt
       FROM in_app_notices n WHERE n.user_id=? AND (?=true OR EXISTS
         (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=? AND ra.account_id=n.account_id))
       ORDER BY n.created_at DESC LIMIT 100`, [actor.id, actor.allAccounts, actor.roleId]);
  }

  async markNoticeRead(actor: Principal, noticeId: string): Promise<void> {
    validId(noticeId);
    const visible: { id: string; account_id: string }[] = await this.db.query(
      "SELECT id,account_id FROM in_app_notices WHERE id=? AND user_id=?", [noticeId, actor.id]);
    if (!visible.length) throw new AppError("not_found");
    if (!actor.allAccounts && !actor.accountIds.includes(visible[0].account_id)) throw new AppError("forbidden");
    if (!actor.permissions.includes("view_mailbox") && !actor.permissions.includes("manage_accounts")) throw new AppError("forbidden");
    await this.db.query("UPDATE in_app_notices SET read_at=UTC_TIMESTAMP(6) WHERE id=? AND user_id=?", [noticeId, actor.id]);
  }
}
