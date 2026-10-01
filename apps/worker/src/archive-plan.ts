import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { logEvent } from "@buzon-sol/domain";
import { filesGate, pendingWhere } from "./archive-store.js";

export type EnqueueArchive = (accountId: string, runId: string, delayMs?: number) => Promise<void>;

/**
 * Creates and queues one archive batch when the account opted in and something is pending. Returns the run id, or
 * null when nothing was queued. A batch already pending or running for the account is never doubled. MySQL and Redis
 * are not atomic: the `pending` run is committed first and a failed enqueue marks it `partial` (compensation).
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
