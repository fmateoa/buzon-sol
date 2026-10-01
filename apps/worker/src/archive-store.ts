import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { type ErrorCode } from "@buzon-sol/domain";
import { storeDetail, type DetailFile } from "./detail-store.js";
import { noticeAdmins } from "./notices.js";
import { type StorableAsset } from "./files.js";

/**
 * MySQL side of the per-account archive: candidate selection, read events, results and stop policy. Nothing here
 * calls SUNAT, Redis or S3, and every query carries `account_id`. `ArchiveProcessor` decides the order and holds
 * the account lock while these run.
 */
export const MAX_FAILURES = 3;
export const filesGate = () => process.env.SUNAT_FILE_CLIENT_READY === "true";

export interface Candidate { id: string; tipo_msj: number; cod_mensaje: string }
export interface Counters { itemsDone: number; itemsFailed: number; filesStored: number; filesFailed: number }
export interface ArchiveRun {
  state: string; active: number; archive_content: number; archive_files: number; archive_batch_size: number;
}
export interface ArchiveDetailRecord { body: string; indTexto?: string | null; updateLeido: boolean | null; files?: DetailFile[] }
export type AssetRow = StorableAsset & { cod_archivo: string | null; num_id: string | null };

export const fileRetryable = `f.state IN ('available','failed') AND (SELECT COUNT(*) FROM file_fetches x
  WHERE x.file_id=f.id AND x.status='failed' AND COALESCE(x.error_code,'')<>'storage_unavailable')<${MAX_FAILURES}`;

/**
 * Items SUNAT already lists as read (`indEstado<>0`) whose content, or files when requested, are not stored yet.
 * An unread item never matches: opening it would mark it read, which only an explicit user command may do.
 * Takes one parameter: the account id.
 */
export function pendingWhere(files: boolean): string {
  return `i.account_id=? AND i.ind_estado<>0
    AND (NOT EXISTS (SELECT 1 FROM mail_details d WHERE d.item_id=i.id AND d.account_id=i.account_id)
      ${files ? `OR EXISTS (SELECT 1 FROM file_assets f WHERE f.item_id=i.id AND f.account_id=i.account_id AND ${fileRetryable})` : ""})
    AND (SELECT COUNT(*) FROM mail_read_events e WHERE e.item_id=i.id AND e.account_id=i.account_id
      AND e.origin='archive' AND e.status IN ('failed','uncertain'))<${MAX_FAILURES}`;
}

export async function loadRun(db: DataSource, accountId: string, runId: string): Promise<ArchiveRun | undefined> {
  const runs: ArchiveRun[] = await db.query(
    `SELECT r.state,a.active,a.archive_content,a.archive_files,a.archive_batch_size
     FROM archive_runs r JOIN sunat_accounts a ON a.id=r.account_id WHERE r.id=? AND r.account_id=?`, [runId, accountId]);
  return runs[0];
}

/**
 * Marks the run `running` and closes the leftovers of a dead batch. The items were already read in SUNAT, so repeating
 * a request changes nothing there; their events become `uncertain` and count toward the per-item failure bound.
 */
export async function startRun(db: DataSource, accountId: string, runId: string): Promise<void> {
  await db.query(
    "UPDATE archive_runs SET state='running',error_code=NULL,started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?", [runId]);
  await db.query(
    `UPDATE mail_read_events SET status='uncertain',finished_at=UTC_TIMESTAMP(6)
     WHERE account_id=? AND origin='archive' AND status IN ('pending','calling')`, [accountId]);
  await db.query(
    `UPDATE file_fetches SET status='failed',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6)
     WHERE account_id=? AND origin='archive' AND status IN ('pending','fetching')`, [accountId]);
}

export async function selectCandidates(db: DataSource, accountId: string, files: boolean, batchSize: number): Promise<Candidate[]> {
  return db.query(
    `SELECT i.id,i.tipo_msj,i.cod_mensaje FROM mail_items i WHERE ${pendingWhere(files)}
     ORDER BY i.published_at IS NULL,i.published_at DESC,i.id LIMIT ?`,
    [accountId, Math.min(Math.max(Number(batchSize) || 200, 1), 2000)]);
}

/** Configuration and remote state rechecked before every detail request. */
export async function loadItemState(db: DataSource, accountId: string, itemId: string) {
  const rows: { active: number; archive_content: number; archive_files: number; ind_estado: number }[] = await db.query(
    `SELECT a.active,a.archive_content,a.archive_files,i.ind_estado FROM mail_items i JOIN sunat_accounts a ON a.id=i.account_id
     WHERE i.id=? AND i.account_id=?`, [itemId, accountId]);
  return rows[0];
}

/** Durable intent: committed before the request that could change remote state. One event per `readDetail` call. */
export async function openReadEvent(db: DataSource, accountId: string, itemId: string, remoteBefore: number): Promise<string> {
  const eventId = randomUUID();
  await db.query(
    `INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before,origin)
     VALUES (?,?,?,NULL,?,'calling',?,'archive')`,
    [eventId, itemId, accountId, `archive-${eventId}`, remoteBefore]);
  return eventId;
}

export async function closeReadEvent(db: DataSource, eventId: string, status: "failed" | "aborted" | "complete",
  updateLeido: boolean | null = null): Promise<void> {
  await db.query("UPDATE mail_read_events SET status=?,update_leido=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
    [status, updateLeido, eventId]);
}

export async function completeRead(db: DataSource, accountId: string, itemId: string, eventId: string,
  detail: ArchiveDetailRecord): Promise<void> {
  await db.transaction(async (manager) => {
    await storeDetail(manager, accountId, itemId, detail);
    await manager.query(
      "UPDATE mail_read_events SET status='complete',update_leido=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
      [detail.updateLeido, eventId]);
  });
}

export async function loadRetryableAssets(db: DataSource, accountId: string, itemId: string): Promise<AssetRow[]> {
  return db.query(
    `SELECT f.id,f.item_id,f.kind,f.cod_archivo,f.num_id FROM file_assets f
     WHERE f.item_id=? AND f.account_id=? AND ${fileRetryable} ORDER BY f.position_index`, [itemId, accountId]);
}

export async function openFileFetch(db: DataSource, accountId: string, fileId: string): Promise<string> {
  const fetchId = randomUUID();
  await db.query(
    "INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status,origin) VALUES (?,?,?,NULL,'fetching','archive')",
    [fetchId, fileId, accountId]);
  return fetchId;
}

export async function closeFileFetch(db: DataSource, fetchId: string, code: ErrorCode | null): Promise<void> {
  await db.query("UPDATE file_fetches SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
    [code ? "failed" : "complete", code, fetchId]);
}

export async function saveCounters(db: DataSource, runId: string, counters: Counters): Promise<void> {
  await db.query("UPDATE archive_runs SET items_done=?,items_failed=?,files_stored=?,files_failed=? WHERE id=?",
    [counters.itemsDone, counters.itemsFailed, counters.filesStored, counters.filesFailed, runId]);
}

export async function countRemaining(db: DataSource, accountId: string, files: boolean): Promise<number> {
  const pending: { n: number | string }[] = await db.query(
    `SELECT COUNT(*) AS n FROM mail_items i WHERE ${pendingWhere(files)}`, [accountId]);
  return Number(pending[0]?.n ?? 0);
}

/** Closes the run and writes its one audit record (counts only) in the same transaction. */
export async function finishRun(db: DataSource, accountId: string, runId: string, counters: Counters,
  errorCode: ErrorCode | null, remaining: number): Promise<"complete" | "partial"> {
  const state = errorCode ? "partial" : "complete";
  await db.transaction(async (manager) => {
    const result: { affectedRows?: number } = await manager.query(
      `UPDATE archive_runs SET state=?,error_code=?,items_done=?,items_failed=?,files_stored=?,files_failed=?,remaining=?,
         finished_at=UTC_TIMESTAMP(6) WHERE id=? AND account_id=? AND state IN ('pending','running')`,
      [state, errorCode, counters.itemsDone, counters.itemsFailed, counters.filesStored, counters.filesFailed,
        remaining, runId, accountId]);
    if (!result.affectedRows) return;
    await manager.query(
      "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
      [randomUUID(), accountId, "archive_result", "archive_run", runId,
        JSON.stringify({ status: state, code: errorCode, ...counters, remaining })]);
  });
  return state;
}

/** SUNAT reported that a request marked an item as read: the stored state was wrong. Switch the archive off and warn. */
export async function stopAfterUnexpectedRead(db: DataSource, accountId: string, runId: string, itemId: string): Promise<void> {
  await db.transaction(async (manager) => {
    await manager.query("UPDATE sunat_accounts SET archive_content=false,archive_files=false WHERE id=?", [accountId]);
    await manager.query(
      "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
      [randomUUID(), accountId, "archive_unexpected_read", "item", itemId, JSON.stringify({ archiveRunId: runId })]);
    await noticeAdmins(manager, accountId, "archive_stopped");
  });
}

/** Same policy as the inventory: a rejected credential pauses the account at once and is never retried. */
export async function rejectCredential(db: DataSource, accountId: string): Promise<void> {
  await db.transaction(async (manager) => {
    await manager.query("UPDATE sunat_credentials SET status='rejected' WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
    await manager.query(
      "UPDATE sync_schedules SET state='paused',pause_reason='invalid_credential',next_run_at=NULL WHERE account_id=?", [accountId]);
    await noticeAdmins(manager, accountId, "invalid_credential");
  });
}
