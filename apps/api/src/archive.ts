import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { DataSource } from "typeorm";
import { AppError, ARCHIVE_QUEUE, redisApiOptions, type ArchiveJob } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

type Input = Record<string, unknown>;
type SettingsRow = { archive_content: number; archive_files: number; archive_batch_size: number };

const settingsDto = (accountId: string, row: SettingsRow) => ({ accountId, archiveContent: Boolean(row.archive_content),
  archiveFiles: Boolean(row.archive_files), archiveBatchSize: Number(row.archive_batch_size) });

/**
 * Per-account mailbox archive. The worker stores content and files only for items SUNAT already lists as read;
 * an unread item is opened solely by the explicit read command. Nothing here contacts SUNAT.
 */
@Injectable()
export class ArchiveService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async settings(actor: Principal, accountId: string) {
    this.auth.requirePermission(actor, "manage_accounts");
    const rows: SettingsRow[] = await this.db.query(
      "SELECT archive_content,archive_files,archive_batch_size FROM sunat_accounts WHERE id=?", [validId(accountId)]);
    if (!rows.length) throw new AppError("not_found");
    return settingsDto(accountId, rows[0]);
  }

  async saveSettings(actor: Principal, accountId: string, input: Input): Promise<void> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    const { archiveContent, archiveFiles, archiveBatchSize } = input ?? {};
    if (typeof archiveContent !== "boolean" || typeof archiveFiles !== "boolean" ||
        !Number.isInteger(archiveBatchSize) || Number(archiveBatchSize) < 1 || Number(archiveBatchSize) > 2000 ||
        // Files are reached through the stored detail of their item.
        (archiveFiles && !archiveContent)) throw new AppError("validation");
    await this.db.transaction(async (manager) => {
      const result: { affectedRows?: number } = await manager.query(
        "UPDATE sunat_accounts SET archive_content=?,archive_files=?,archive_batch_size=? WHERE id=?",
        [archiveContent, archiveFiles, archiveBatchSize, accountId]);
      if (!result.affectedRows) throw new AppError("not_found");
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "update", "mailbox_settings", accountId,
          JSON.stringify({ archiveContent, archiveFiles, archiveBatchSize })]);
    });
  }

  /** Queues one archive batch. `retryFailed` gives items and files that exhausted their attempts a new round. */
  async start(actor: Principal, accountId: string, input: Input): Promise<{ id: string; state: string }> {
    this.auth.requireAccount(actor, "run_inventory", validId(accountId));
    this.auth.requireAccount(actor, "read_content", accountId);
    if (process.env.SUNAT_READ_VALIDATED !== "true") throw new AppError("remote_unavailable");
    const retryFailed = input?.retryFailed ?? false;
    if (typeof retryFailed !== "boolean") throw new AppError("validation");
    const run = await this.db.transaction(async (manager) => {
      const accounts: { active: number; archive_content: number }[] = await manager.query(
        "SELECT active,archive_content FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active || !accounts[0].archive_content) throw new AppError("paused");
      const credentials: { status: string }[] = await manager.query(
        "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      if (!credentials.length) throw new AppError("needs_credential");
      if (credentials[0].status !== "valid") throw new AppError("invalid_credential");
      const open: { id: string; state: string }[] = await manager.query(
        "SELECT id,state FROM archive_runs WHERE account_id=? AND state IN ('pending','running') ORDER BY created_at DESC LIMIT 1",
        [accountId]);
      if (open.length) return { ...open[0], created: false };
      if (retryFailed) {
        await manager.query(
          "UPDATE mail_read_events SET status='superseded' WHERE account_id=? AND origin='archive' AND status IN ('failed','uncertain')",
          [accountId]);
        await manager.query(
          "UPDATE file_fetches SET status='superseded' WHERE account_id=? AND origin='archive' AND status='failed'", [accountId]);
      }
      const id = randomUUID();
      await manager.query(
        "INSERT INTO archive_runs (id,account_id,trigger_kind,actor_user_id,state) VALUES (?,?,'manual',?,'pending')",
        [id, accountId, actor.id]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "start", "archive_run", id, JSON.stringify({ retryFailed })]);
      return { id, state: "pending", created: true };
    });
    if (run.created) {
      const queue = new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection: redisApiOptions() });
      try {
        await queue.add("archive", { accountId, runId: run.id },
          { jobId: run.id, attempts: 1, removeOnComplete: true, removeOnFail: true });
      } catch {
        await this.db.query(
          "UPDATE archive_runs SET state='partial',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6) WHERE id=? AND state='pending'",
          [run.id]);
        throw new AppError("remote_unavailable");
      } finally {
        await queue.close();
      }
    }
    return { id: run.id, state: run.state };
  }

  /** How much of the persisted mailbox has stored content and files; counts only. */
  async status(actor: Principal, accountId: string) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const accounts: SettingsRow[] = await this.db.query(
      "SELECT archive_content,archive_files,archive_batch_size FROM sunat_accounts WHERE id=?", [accountId]);
    if (!accounts.length) throw new AppError("not_found");
    const items: { total: number; readInSunat: number | null; withContent: number | null; pendingContent: number | null }[] =
      await this.db.query(
        `SELECT COUNT(*) AS total,SUM(i.ind_estado<>0) AS readInSunat,SUM(d.item_id IS NOT NULL) AS withContent,
           SUM(i.ind_estado<>0 AND d.item_id IS NULL) AS pendingContent
         FROM mail_items i LEFT JOIN mail_details d ON d.item_id=i.id AND d.account_id=i.account_id
         WHERE i.account_id=?`, [accountId]);
    const files: { state: string; n: number }[] = await this.db.query(
      "SELECT state,COUNT(*) AS n FROM file_assets WHERE account_id=? GROUP BY state", [accountId]);
    const fileCount = (state: string) => Number(files.find((row) => row.state === state)?.n ?? 0);
    const runs = await this.db.query(
      `SELECT id,trigger_kind AS \`trigger\`,state,error_code AS errorCode,items_done AS itemsDone,items_failed AS itemsFailed,
         files_stored AS filesStored,files_failed AS filesFailed,remaining,created_at AS createdAt,
         started_at AS startedAt,finished_at AS finishedAt
       FROM archive_runs WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 10`, [accountId]);
    const total = Number(items[0]?.total ?? 0), readInSunat = Number(items[0]?.readInSunat ?? 0);
    return {
      settings: settingsDto(accountId, accounts[0]),
      items: { total, readInSunat, unreadInSunat: total - readInSunat,
        withContent: Number(items[0]?.withContent ?? 0), pendingContent: Number(items[0]?.pendingContent ?? 0) },
      files: { stored: fileCount("stored"), pending: fileCount("available"), failed: fileCount("failed") },
      current: runs[0] ?? null, history: runs,
    };
  }
}
