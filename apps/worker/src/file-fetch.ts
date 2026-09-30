import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { AppError, logEvent } from "@buzon-sol/domain";
import { S3Storage } from "@buzon-sol/storage";
import { FileProcessor, type FileClient, type ObjectStore } from "./files.js";

export type FileClientFactory = (accountId: string) => FileClient | Promise<FileClient>;

export class FileFetchProcessor {
  constructor(private readonly db: DataSource, private readonly clientFactory: FileClientFactory,
    private readonly store: ObjectStore = new S3Storage()) {}

  async process(accountId: string, fetchId: string): Promise<void> {
    const rows: { file_id: string; actor_user_id: string | null; status: string }[] = await this.db.query(
      "SELECT file_id,actor_user_id,status FROM file_fetches WHERE id=? AND account_id=?", [fetchId, accountId]);
    const request = rows[0];
    if (!request) throw new AppError("not_found");
    if (["complete", "failed", "denied"].includes(request.status)) return;
    const authorize = async () => {
      if (request.actor_user_id === null) return this.authorizeSystem(accountId, request.file_id);
      const permitted: { id: string }[] = await this.db.query(
        `SELECT u.id FROM app_users u JOIN roles r ON r.id=u.role_id
         JOIN role_permissions p ON p.role_id=r.id AND p.permission='download_file'
         JOIN sunat_accounts a ON a.id=? AND a.active=true
         WHERE u.id=? AND u.status='active' AND
           (r.all_accounts=true OR EXISTS
             (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=a.id))`,
        [accountId, request.actor_user_id]);
      if (!permitted.length) throw new AppError("forbidden");
      const reads: { id: string }[] = await this.db.query(
        `SELECT e.id FROM file_assets f JOIN mail_read_events e
           ON e.item_id=f.item_id AND e.account_id=f.account_id
         WHERE f.id=? AND f.account_id=? AND e.status='complete' LIMIT 1`, [request.file_id, accountId]);
      if (!reads.length) throw new AppError("forbidden");
    };
    let client: FileClient | undefined;
    try {
      await authorize();
      await this.db.query("UPDATE file_fetches SET status='fetching' WHERE id=? AND status IN ('pending','fetching')", [fetchId]);
      client = await this.clientFactory(accountId);
      await new FileProcessor(this.db, client, this.store).process(accountId, request.file_id, authorize);
      await this.finish(fetchId, accountId, request.actor_user_id, "complete", null);
    } catch (error) {
      const code = error instanceof AppError ? error.code : "remote_unavailable";
      await this.finish(fetchId, accountId, request.actor_user_id,
        code === "forbidden" || code === "paused" ? "denied" : "failed", code);
      throw error;
    } finally {
      try { await client?.close?.(); }
      catch { logEvent("warn", "sunat_session_cleanup_failed", { accountId }); }
    }
  }

  /** P-03 system fetch: still allowed only while the schedule opts in and the item stays read with stored detail. */
  private async authorizeSystem(accountId: string, fileId: string): Promise<void> {
    const rows: { ok: number }[] = await this.db.query(
      `SELECT 1 AS ok FROM file_assets f
       JOIN sunat_accounts a ON a.id=f.account_id AND a.active=true
       JOIN sync_schedules s ON s.account_id=f.account_id AND s.download_read_attachments=true
       JOIN mail_items i ON i.id=f.item_id AND i.account_id=f.account_id AND i.ind_estado<>0
       JOIN mail_details d ON d.item_id=f.item_id AND d.account_id=f.account_id
       WHERE f.id=? AND f.account_id=?`, [fileId, accountId]);
    if (!rows.length) throw new AppError("forbidden");
  }

  private async finish(fetchId: string, accountId: string, actorId: string | null,
    status: string, code: string | null): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query(
        "UPDATE file_fetches SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(6) WHERE id=? AND account_id=?",
        [status, code, fetchId, accountId]);
      await manager.query(
        `INSERT INTO audit_events
         (id,actor_user_id,account_id,action,object_type,object_id,change_json)
         VALUES (?,?,?,?,?,?,?)`,
        [randomUUID(), actorId, accountId, "fetch_file_result", "file_fetch", fetchId,
          JSON.stringify({ status, code })]);
    });
  }
}
