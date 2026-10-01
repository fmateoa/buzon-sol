import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { AppError, logEvent, type ErrorCode, type MailBox } from "@buzon-sol/domain";
import { S3Storage } from "@buzon-sol/storage";
import { storeDetail, type DetailFile } from "./detail-store.js";
import { storeFile, type FileResponse, type ObjectStore, type StorableAsset } from "./files.js";
import { noticeAdmins } from "./notices.js";

export interface ArchiveDetail {
  body: string;
  indTexto?: string | null;
  updateLeido: boolean | null;
  generatedUrl?: string | null;
  files?: DetailFile[];
}
/** One SUNAT session of one account. Downloads follow the detail they belong to, in the same session. */
export interface ArchiveClient {
  readDetail(box: MailBox, codMensaje: string): Promise<ArchiveDetail>;
  downloadAttachment(codArchivo: string): Promise<FileResponse>;
  downloadGeneratedDocument(generatedUrl: string): Promise<FileResponse>;
  close?(): Promise<void>;
}
export type ArchiveClientFactory = (accountId: string) => ArchiveClient | Promise<ArchiveClient>;
export type EnqueueArchive = (accountId: string, runId: string, delayMs?: number) => Promise<void>;
export interface ArchiveOutcome { state: "complete" | "partial"; remaining: number; progressed: boolean }

const MAX_FAILURES = 3;
const filesGate = () => process.env.SUNAT_FILE_CLIENT_READY === "true";
const codeOf = (error: unknown): ErrorCode => error instanceof AppError ? error.code : "remote_unavailable";

const fileRetryable = `f.state IN ('available','failed') AND (SELECT COUNT(*) FROM file_fetches x
  WHERE x.file_id=f.id AND x.status='failed' AND COALESCE(x.error_code,'')<>'storage_unavailable')<${MAX_FAILURES}`;

/**
 * Items SUNAT already lists as read (`indEstado<>0`) whose content, or files when requested, are not stored yet.
 * An unread item never matches: opening it would mark it read, which only an explicit user command may do.
 * Takes one parameter: the account id.
 */
function pendingWhere(files: boolean): string {
  return `i.account_id=? AND i.ind_estado<>0
    AND (NOT EXISTS (SELECT 1 FROM mail_details d WHERE d.item_id=i.id AND d.account_id=i.account_id)
      ${files ? `OR EXISTS (SELECT 1 FROM file_assets f WHERE f.item_id=i.id AND f.account_id=i.account_id AND ${fileRetryable})` : ""})
    AND (SELECT COUNT(*) FROM mail_read_events e WHERE e.item_id=i.id AND e.account_id=i.account_id
      AND e.origin='archive' AND e.status IN ('failed','uncertain'))<${MAX_FAILURES}`;
}

/**
 * Creates and queues one archive batch when the account opted in and something is pending. Returns the run id, or
 * null when nothing was queued. A batch already pending or running for the account is never doubled.
 */
export async function planArchive(db: DataSource, accountId: string, trigger: "inventory" | "continue",
  enqueue: EnqueueArchive, options: { syncRunId?: string; delayMs?: number } = {}): Promise<string | null> {
  if (process.env.SUNAT_READ_VALIDATED !== "true") return null;
  const runId = await db.transaction(async (manager) => {
    const accounts: { active: number; archive_content: number; archive_files: number }[] = await manager.query(
      "SELECT active,archive_content,archive_files FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
    const account = accounts[0];
    if (!account || !account.active || !account.archive_content) return null;
    const open: { id: string }[] = await manager.query(
      "SELECT id FROM archive_runs WHERE account_id=? AND state IN ('pending','running') LIMIT 1", [accountId]);
    if (open.length) return null;
    const pending: { id: string }[] = await manager.query(
      `SELECT i.id FROM mail_items i WHERE ${pendingWhere(Boolean(account.archive_files) && filesGate())} LIMIT 1`, [accountId]);
    if (!pending.length) return null;
    const id = randomUUID();
    await manager.query(
      "INSERT INTO archive_runs (id,account_id,trigger_kind,sync_run_id,state) VALUES (?,?,?,?,'pending')",
      [id, accountId, trigger, options.syncRunId ?? null]);
    return id;
  });
  if (!runId) return null;
  try { await enqueue(accountId, runId, options.delayMs); }
  catch {
    await db.query(
      "UPDATE archive_runs SET state='partial',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6) WHERE id=? AND state='pending'",
      [runId]);
    logEvent("error", "archive_enqueue_failed", { accountId, runId });
    return null;
  }
  return runId;
}

/**
 * Archive runs left behind by a dead process or a lost job become `partial`; the next inventory or a manual start
 * queues a new batch. A live batch holds the account lock, so taking it proves none is running.
 */
export async function recoverOrphanArchiveRuns(db: DataSource, jobExists: (runId: string) => Promise<boolean>): Promise<number> {
  const candidates: { id: string; account_id: string; state: string }[] = await db.query(
    "SELECT id,account_id,state FROM archive_runs WHERE state IN ('pending','running') ORDER BY account_id,id");
  let recovered = 0;
  for (const run of candidates) {
    if (run.state === "pending" && await jobExists(run.id)) continue;
    const lease = db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${run.account_id}`;
    let locked = false;
    try {
      const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) continue;
      locked = true;
      if (run.state === "pending" && await jobExists(run.id)) continue;
      const result: { affectedRows?: number } = await db.query(
        `UPDATE archive_runs SET state='partial',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6)
         WHERE id=? AND account_id=? AND state=?`, [run.id, run.account_id, run.state]);
      if (result.affectedRows) recovered++;
    } finally {
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }
  return recovered;
}

type Candidate = { id: string; tipo_msj: number; cod_mensaje: string };
type Counters = { itemsDone: number; itemsFailed: number; filesStored: number; filesFailed: number };

/**
 * Stores the content and files of items already read in SUNAT, one bounded batch per run and one session per
 * batch. Every detail request is preceded by a durable `mail_read_events` row with `origin='archive'`.
 */
export class ArchiveProcessor {
  constructor(private readonly db: DataSource, private readonly clientFactory: ArchiveClientFactory,
    private store?: ObjectStore) {}

  async process(accountId: string, runId: string): Promise<ArchiveOutcome | null> {
    const lease = this.db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${accountId}`;
    const startedAt = Date.now();
    const counters: Counters = { itemsDone: 0, itemsFailed: 0, filesStored: 0, filesFailed: 0 };
    let locked = false;
    let client: ArchiveClient | undefined;
    try {
      const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) {
        await this.finish(accountId, runId, counters, startedAt, "conflict_running", false);
        throw new AppError("conflict_running");
      }
      locked = true;
      const runs: { state: string; active: number; archive_content: number; archive_files: number; archive_batch_size: number }[] =
        await this.db.query(`SELECT r.state,a.active,a.archive_content,a.archive_files,a.archive_batch_size
          FROM archive_runs r JOIN sunat_accounts a ON a.id=r.account_id WHERE r.id=? AND r.account_id=?`, [runId, accountId]);
      const run = runs[0];
      if (!run) throw new AppError("not_found");
      // `running` with the lock free is a batch whose process died: it continues, since every step is idempotent.
      if (run.state !== "pending" && run.state !== "running") return null;
      try {
        if (process.env.SUNAT_READ_VALIDATED !== "true") throw new AppError("remote_unavailable");
        if (!run.active || !run.archive_content) throw new AppError("paused");
        const files = Boolean(run.archive_files) && filesGate();
        await this.db.query(
          "UPDATE archive_runs SET state='running',error_code=NULL,started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?", [runId]);
        // Leftovers of a dead batch. The items were already read in SUNAT, so repeating the request changes nothing there.
        await this.db.query(
          `UPDATE mail_read_events SET status='uncertain',finished_at=UTC_TIMESTAMP(6)
           WHERE account_id=? AND origin='archive' AND status IN ('pending','calling')`, [accountId]);
        await this.db.query(
          `UPDATE file_fetches SET status='failed',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6)
           WHERE account_id=? AND origin='archive' AND status IN ('pending','fetching')`, [accountId]);
        const candidates: Candidate[] = await this.db.query(
          `SELECT i.id,i.tipo_msj,i.cod_mensaje FROM mail_items i WHERE ${pendingWhere(files)}
           ORDER BY i.published_at IS NULL,i.published_at DESC,i.id LIMIT ?`,
          [accountId, Math.min(Math.max(Number(run.archive_batch_size) || 200, 1), 2000)]);
        let abort: ErrorCode | null = null;
        if (candidates.length) {
          client = await this.clientFactory(accountId);
          abort = await this.archiveItems(accountId, runId, candidates, client, files, counters);
        }
        return await this.finish(accountId, runId, counters, startedAt, abort, files);
      } catch (error) {
        const code = codeOf(error);
        if (code === "invalid_credential") await this.rejectCredential(accountId);
        await this.finish(accountId, runId, counters, startedAt, code, false);
        throw error;
      }
    } finally {
      try { await client?.close?.(); }
      catch { logEvent("warn", "sunat_session_cleanup_failed", { accountId }); }
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }

  /** Returns the error that stopped the batch, or null when every candidate was attempted. */
  private async archiveItems(accountId: string, runId: string, candidates: Candidate[], client: ArchiveClient,
    files: boolean, counters: Counters): Promise<ErrorCode | null> {
    let consecutive = 0;
    for (const item of candidates) {
      // The account may be disabled or opt out while the batch runs, and the stored state is rechecked per item.
      const current: { active: number; archive_content: number; ind_estado: number }[] = await this.db.query(
        `SELECT a.active,a.archive_content,i.ind_estado FROM mail_items i JOIN sunat_accounts a ON a.id=i.account_id
         WHERE i.id=? AND i.account_id=?`, [item.id, accountId]);
      if (!current.length || !current[0].active || !current[0].archive_content) return "paused";
      if (Number(current[0].ind_estado) === 0) continue;
      const box: MailBox = Number(item.tipo_msj) === 1 ? "messages" : "notifications";
      const eventId = randomUUID();
      await this.db.query(
        `INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before,origin)
         VALUES (?,?,?,NULL,?,'calling',?,'archive')`,
        [eventId, item.id, accountId, `archive-${eventId}`, current[0].ind_estado]);
      let detail: ArchiveDetail;
      try { detail = await client.readDetail(box, item.cod_mensaje); }
      catch (error) {
        const code = codeOf(error);
        // An expired session says nothing about the item; any other failure counts against it.
        await this.db.query("UPDATE mail_read_events SET status=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
          [code === "remote_session_expired" ? "aborted" : "failed", eventId]);
        if (code === "remote_session_expired" || code === "invalid_credential") return code;
        counters.itemsFailed++;
        if (++consecutive >= MAX_FAILURES) return code;
        await this.saveCounters(runId, counters);
        continue;
      }
      consecutive = 0;
      await this.db.transaction(async (manager) => {
        await storeDetail(manager, accountId, item.id, detail);
        await manager.query(
          "UPDATE mail_read_events SET status='complete',update_leido=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
          [detail.updateLeido, eventId]);
      });
      counters.itemsDone++;
      if (detail.updateLeido === true) {
        // SUNAT reports this request marked the item as read: the stored state was wrong. Stop and switch the archive off.
        await this.stopAfterUnexpectedRead(accountId, runId, item.id);
        return "schema_changed";
      }
      if (files) {
        const stopped = await this.archiveFiles(accountId, item, box, detail, client, counters);
        if (stopped) return stopped;
      }
      await this.saveCounters(runId, counters);
    }
    return null;
  }

  private async archiveFiles(accountId: string, item: Candidate, box: MailBox, detail: ArchiveDetail,
    client: ArchiveClient, counters: Counters): Promise<ErrorCode | null> {
    const assets: (StorableAsset & { cod_archivo: string | null; num_id: string | null })[] = await this.db.query(
      `SELECT f.id,f.item_id,f.kind,f.cod_archivo,f.num_id FROM file_assets f
       WHERE f.item_id=? AND f.account_id=? AND ${fileRetryable} ORDER BY f.position_index`, [item.id, accountId]);
    const announced = detail.files ?? [];
    const store = this.store ??= new S3Storage();
    // `codArchivo=0` is resolved by SUNAT from the detail just opened, so that download directly follows its detail.
    let detailIsLatest = true;
    for (const asset of assets) {
      const fetchId = randomUUID();
      await this.db.query(
        "INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status,origin) VALUES (?,?,?,NULL,'fetching','archive')",
        [fetchId, asset.id, accountId]);
      let code: ErrorCode | null = null;
      try {
        await storeFile(this.db, store, accountId, asset, async () => {
          if (asset.kind === "generated_document") {
            const matches = announced.filter((file) => file.kind === "generated_document" && (file.numId ?? null) === asset.num_id);
            if (!detail.generatedUrl || matches.length !== 1) throw new AppError("schema_changed");
            detailIsLatest = false;
            return client.downloadGeneratedDocument(detail.generatedUrl);
          }
          const fileCode = asset.cod_archivo;
          const matches = announced.filter((file) => file.kind === "attachment" && String(file.codArchivo) === fileCode);
          if (!fileCode || matches.length !== 1) throw new AppError("schema_changed");
          if (fileCode === "0" && !detailIsLatest && (await client.readDetail(box, item.cod_mensaje)).updateLeido === true) {
            throw new AppError("schema_changed");
          }
          detailIsLatest = false;
          return client.downloadAttachment(fileCode);
        });
        counters.filesStored++;
      } catch (error) {
        code = codeOf(error);
        counters.filesFailed++;
      }
      await this.db.query("UPDATE file_fetches SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
        [code ? "failed" : "complete", code, fetchId]);
      if (code === "storage_unavailable" || code === "remote_session_expired") return code;
    }
    return null;
  }

  private async saveCounters(runId: string, counters: Counters): Promise<void> {
    await this.db.query("UPDATE archive_runs SET items_done=?,items_failed=?,files_stored=?,files_failed=? WHERE id=?",
      [counters.itemsDone, counters.itemsFailed, counters.filesStored, counters.filesFailed, runId]);
  }

  private async finish(accountId: string, runId: string, counters: Counters, startedAt: number,
    errorCode: ErrorCode | null, files: boolean): Promise<ArchiveOutcome> {
    const pending: { n: number | string }[] = await this.db.query(
      `SELECT COUNT(*) AS n FROM mail_items i WHERE ${pendingWhere(files)}`, [accountId]);
    const remaining = Number(pending[0]?.n ?? 0);
    const state = errorCode ? "partial" : "complete";
    await this.db.transaction(async (manager) => {
      const result: { affectedRows?: number } = await manager.query(
        `UPDATE archive_runs SET state=?,error_code=?,items_done=?,items_failed=?,files_stored=?,files_failed=?,remaining=?,
           finished_at=UTC_TIMESTAMP(6) WHERE id=? AND account_id=? AND state IN ('pending','running')`,
        [state, errorCode, counters.itemsDone, counters.itemsFailed, counters.filesStored, counters.filesFailed,
          remaining, runId, accountId]);
      if (!result.affectedRows) return;
      // One audit record per batch, with counts only.
      await manager.query(
        "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
        [randomUUID(), accountId, "archive_result", "archive_run", runId,
          JSON.stringify({ status: state, code: errorCode, ...counters, remaining })]);
    });
    logEvent(errorCode ? "warn" : "info", "archive_run_finished", { accountId, runId, runState: state, errorCode,
      durationMs: Date.now() - startedAt, ...counters, remaining });
    return { state, remaining, progressed: counters.itemsDone + counters.filesStored > 0 };
  }

  private async stopAfterUnexpectedRead(accountId: string, runId: string, itemId: string): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query("UPDATE sunat_accounts SET archive_content=false,archive_files=false WHERE id=?", [accountId]);
      await manager.query(
        "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
        [randomUUID(), accountId, "archive_unexpected_read", "item", itemId, JSON.stringify({ archiveRunId: runId })]);
      await noticeAdmins(manager, accountId, "archive_stopped");
    });
    logEvent("error", "archive_unexpected_read", { accountId, runId });
  }

  /** Same policy as the inventory: a rejected credential pauses the account at once and is never retried. */
  private async rejectCredential(accountId: string): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query("UPDATE sunat_credentials SET status='rejected' WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      await manager.query(
        "UPDATE sync_schedules SET state='paused',pause_reason='invalid_credential',next_run_at=NULL WHERE account_id=?", [accountId]);
      await noticeAdmins(manager, accountId, "invalid_credential");
    });
  }
}
