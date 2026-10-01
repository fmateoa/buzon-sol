import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import { DB } from "../common/tokens";
import { AuthService, type Principal } from "../auth/auth";
import { validId } from "../common/ids";

@Injectable()
export class OperationsService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async activity(actor: Principal, accountId: string) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const runs = await this.db.query(
      `SELECT id,mode,state,scan_kind AS scanKind,yield_count AS yieldCount,started_at AS startedAt,finished_at AS finishedAt,
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
    const seen = current?.startedAt ? await this.db.query(
      "SELECT tipo_msj AS tipoMsj,COUNT(*) AS seen FROM mail_items WHERE account_id=? AND last_seen_at>=? GROUP BY tipo_msj",
      [accountId, current.startedAt]) : [];
    return { accountId, current, pages, seen, history: runs };
  }

  /** Recent runs of every account, for the administration view; persisted state only. */
  async runs(actor: Principal) {
    this.auth.requirePermission(actor, "manage_accounts");
    return this.db.query(
      `SELECT r.id,r.account_id AS accountId,a.alias AS accountAlias,r.mode,r.state,r.scan_kind AS scanKind,r.started_at AS startedAt,
         r.finished_at AS finishedAt,r.resume_box AS resumeBox,r.resume_page AS resumePage,r.error_code AS errorCode,
         r.boxes_json AS boxes,r.new_messages AS newMessages,r.new_notifications AS newNotifications,
         (SELECT COALESCE(SUM(p.rows_received),0) FROM sync_pages p WHERE p.run_id=r.id) AS received
       FROM sync_runs r JOIN sunat_accounts a ON a.id=r.account_id
       ORDER BY COALESCE(r.started_at,'9999-12-31') DESC,r.id DESC LIMIT 200`);
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
    const reviewBacklog: { tipo_msj: number; n: number }[] = await this.db.query(
      `SELECT i.tipo_msj,COUNT(*) AS n FROM mail_items i
       JOIN mail_details d ON d.item_id=i.id AND d.account_id=i.account_id
       LEFT JOIN mail_reviews v ON v.item_id=i.id AND v.user_id=?
       WHERE i.account_id=? AND i.ind_estado<>0 AND COALESCE(v.reviewed,false)=false GROUP BY i.tipo_msj`, [actor.id, accountId]);
    const failedFiles: { n: number }[] = await this.db.query(
      "SELECT COUNT(*) AS n FROM file_assets WHERE account_id=? AND state='failed'", [accountId]);
    // Items first seen after the complete run before the latest one are the "new" ones of the last check.
    const previous: { finished_at: Date }[] = await this.db.query(
      "SELECT finished_at FROM sync_runs WHERE account_id=? AND state='complete' ORDER BY finished_at DESC LIMIT 1 OFFSET 1", [accountId]);
    const pendingReview = (code: number) => Number(reviewBacklog.find((row) => Number(row.tipo_msj) === code)?.n ?? 0);
    // Initial load: the account has never completed a full pass. While a run is queued or going, the mailbox shows what is
    // already stored and says the rest is still arriving; once a full pass completes it never comes back.
    const fullPass: unknown[] = await this.db.query(
      "SELECT 1 AS ok FROM sync_runs WHERE account_id=? AND state='complete' AND scan_kind='full' LIMIT 1", [accountId]);
    const initialLoad = { done: fullPass.length > 0,
      active: !fullPass.length && ["pending", "running"].includes(latest[0]?.state ?? "") };
    return { accountId, state: latest[0]?.state ?? null, verified, initialLoad,
      pendingReview: { messages: pendingReview(1), notifications: pendingReview(2) },
      failedFiles: Number(failedFiles[0]?.n ?? 0), newSince: previous[0]?.finished_at ?? null,
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
        e.object_type AS objectType,e.object_id AS objectId,e.created_at AS at,
        u.name AS actorName,a.alias AS accountAlias,COALESCE(ou.name,orl.name) AS objectName
       FROM audit_events e LEFT JOIN app_users u ON u.id=e.actor_user_id
       LEFT JOIN sunat_accounts a ON a.id=e.account_id
       LEFT JOIN app_users ou ON e.object_type='user' AND ou.id=e.object_id
       LEFT JOIN roles orl ON e.object_type='role' AND orl.id=e.object_id WHERE (?=true OR
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
