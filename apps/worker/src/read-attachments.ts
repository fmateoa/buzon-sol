import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { logEvent } from "@buzon-sol/domain";

export type EnqueueFileFetch = (accountId: string, fetchId: string) => Promise<void>;

/**
 * P-03: after a complete scheduled run, queue downloads only for items already read in SUNAT whose detail (and so
 * the file reference) is stored. An unread item is never opened by an automatic download.
 */
export async function planReadAttachmentDownloads(
  db: DataSource, accountId: string, runId: string, enqueue: EnqueueFileFetch, limit = 100, maxFailures = 3,
): Promise<number> {
  if (process.env.SUNAT_FILE_CLIENT_READY !== "true") return 0;
  const eligible: { ok: number }[] = await db.query(
    `SELECT 1 AS ok FROM sync_runs r JOIN sunat_accounts a ON a.id=r.account_id
     JOIN sync_schedules s ON s.account_id=r.account_id
     WHERE r.id=? AND r.account_id=? AND r.state='complete' AND r.mode='scheduled'
       AND a.active=true AND s.download_read_attachments=true`, [runId, accountId]);
  if (!eligible.length) return 0;
  const files: { id: string }[] = await db.query(
    `SELECT f.id FROM file_assets f
     JOIN mail_items i ON i.id=f.item_id AND i.account_id=f.account_id
     JOIN mail_details d ON d.item_id=f.item_id AND d.account_id=f.account_id
     WHERE f.account_id=? AND f.state IN ('available','failed') AND i.ind_estado<>0
       AND NOT EXISTS (SELECT 1 FROM file_fetches p WHERE p.file_id=f.id AND p.status IN ('pending','fetching'))
       AND (SELECT COUNT(*) FROM file_fetches x WHERE x.file_id=f.id AND x.status='failed')<?
     ORDER BY f.item_id,f.kind,f.position_index LIMIT ?`, [accountId, maxFailures, limit]);
  let queued = 0;
  for (const file of files) {
    const fetchId = randomUUID();
    await db.query(
      "INSERT INTO file_fetches (id,file_id,account_id,actor_user_id,status,origin) VALUES (?,?,?,NULL,'pending','schedule')",
      [fetchId, file.id, accountId]);
    try {
      await enqueue(accountId, fetchId);
      queued++;
    } catch {
      await db.query(
        "UPDATE file_fetches SET status='failed',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6) WHERE id=?", [fetchId]);
      logEvent("error", "read_attachment_enqueue_failed", { accountId, runId });
      break;
    }
  }
  if (queued) logEvent("info", "read_attachments_queued", { accountId, runId, queued });
  return queued;
}
