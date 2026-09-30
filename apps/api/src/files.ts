import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Queue } from "bullmq";
import { AppError, FILE_QUEUE, redisApiOptions, type FileJob } from "@buzon-sol/domain";
import { S3Storage } from "@buzon-sol/storage";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

const extensions: Record<string, string> = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "application/zip": "zip",
  "text/html": "html",
};

@Injectable()
export class FilesService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async requestFetch(actor: Principal, accountId: string, fileId: string): Promise<{ id: string; status: string }> {
    this.auth.requireAccount(actor, "download_file", validId(accountId));
    validId(fileId);
    if (process.env.SUNAT_FILE_CLIENT_READY !== "true") throw new AppError("remote_unavailable");
    const fetch = await this.db.transaction(async (manager) => {
      const assets: { state: string; item_id: string; active: number }[] = await manager.query(
        `SELECT f.state,f.item_id,a.active FROM file_assets f
         JOIN sunat_accounts a ON a.id=f.account_id
         WHERE f.id=? AND f.account_id=? FOR UPDATE`, [fileId, accountId]);
      const asset = assets[0];
      if (!asset) throw new AppError("not_found");
      if (!asset.active) throw new AppError("paused");
      if (asset.state === "stored") return { id: fileId, status: "stored" };
      if (asset.state !== "available" && asset.state !== "failed") throw new AppError("conflict_running");
      const reads: { id: string }[] = await manager.query(
        `SELECT id FROM mail_read_events WHERE item_id=? AND account_id=? AND status='complete' LIMIT 1`,
        [asset.item_id, accountId]);
      if (!reads.length) throw new AppError("forbidden");
      const previous: { id: string; status: string }[] = await manager.query(
        "SELECT id,status FROM file_fetches WHERE file_id=? AND status IN ('pending','fetching') ORDER BY created_at DESC LIMIT 1",
        [fileId]);
      if (previous.length) return previous[0];
      const id = randomUUID();
      await manager.query(
        "INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [id, fileId, accountId, actor.id]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "fetch_file", "file", fileId]);
      return { id, status: "pending" };
    });
    if (fetch.status === "stored") return fetch;
    const queue = new Queue<FileJob>(FILE_QUEUE, { connection: redisApiOptions() });
    try {
      await queue.add("file", { accountId, fetchId: fetch.id },
        { jobId: fetch.id, attempts: 1, removeOnComplete: true, removeOnFail: true });
    } catch {
      await this.db.query(
        "UPDATE file_fetches SET status='failed',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6) WHERE id=? AND status='pending'",
        [fetch.id]);
      throw new AppError("remote_unavailable");
    } finally {
      await queue.close();
    }
    return fetch;
  }

  async fetchStatus(actor: Principal, accountId: string, fileId: string, fetchId: string) {
    this.auth.requireAccount(actor, "download_file", validId(accountId));
    validId(fileId);
    validId(fetchId);
    const rows: { id: string; status: string; errorCode: string | null; createdAt: Date; finishedAt: Date | null }[] =
      await this.db.query(
        `SELECT id,status,error_code AS errorCode,created_at AS createdAt,finished_at AS finishedAt
         FROM file_fetches WHERE id=? AND file_id=? AND account_id=?`, [fetchId, fileId, accountId]);
    if (!rows.length) throw new AppError("not_found");
    return rows[0];
  }

  async download(actor: Principal, accountId: string, fileId: string): Promise<{ stream: Readable; mime: string; filename: string }> {
    this.auth.requireAccount(actor, "download_file", validId(accountId));
    validId(fileId);
    const rows: { object_key: string | null; mime_type: string | null; state: string }[] = await this.db.query(
      "SELECT object_key,mime_type,state FROM file_assets WHERE id=? AND account_id=?", [fileId, accountId]);
    const asset = rows[0];
    if (!asset || asset.state !== "stored" || !asset.object_key || !asset.mime_type) throw new AppError("not_found");
    const extension = extensions[asset.mime_type];
    if (!extension) throw new AppError("schema_changed");
    let stream: Readable;
    try { stream = await new S3Storage().get(asset.object_key); }
    catch { throw new AppError("storage_unavailable"); }
    try {
      await this.db.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "download", "file", fileId],
      );
    } catch (error) {
      stream.destroy();
      throw error;
    }
    return { stream, mime: asset.mime_type, filename: `archivo-${fileId}.${extension}` };
  }
}
