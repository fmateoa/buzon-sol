import { Queue, Worker } from "bullmq";
import { DataSource } from "typeorm";
import { AppError, FILE_QUEUE, INVENTORY_QUEUE, redisOptions, type FileJob, type InventoryJob, logEvent } from "@buzon-sol/domain";
import { type InventoryClient } from "@buzon-sol/sunat-adapter";
import { InventoryRunner, type RunOutcome } from "./inventory.js";
import { planReadAttachmentDownloads, type EnqueueFileFetch } from "./read-attachments.js";
import { planArchive, type EnqueueArchive } from "./archive-plan.js";
import { enqueueArchiveRun } from "./archive-queue.js";
import { INVENTORY_RETRY_MS, INVENTORY_YIELD_MS, MAX_INVENTORY_DEFERRALS, isBusy, postpone } from "./postpone.js";

async function enqueueFileFetch(accountId: string, fetchId: string): Promise<void> {
  const queue = new Queue<FileJob>(FILE_QUEUE, { connection: redisOptions() });
  try {
    await queue.add("file", { accountId, fetchId }, { jobId: fetchId, attempts: 1, removeOnComplete: true, removeOnFail: true });
  } finally {
    await queue.close();
  }
}

/**
 * Production must supply a transport validated by the SUNAT integration plan.
 *
 * The inventory is the long job of an account (minutes on a large mailbox), so it is the one that gives way: a busy
 * account postpones it instead of failing it, and between pages it yields to a waiting user command and resumes
 * from its checkpoint as the same queued job (same id, so orphan recovery keeps seeing it).
 */
export function startInventoryWorker(db: DataSource,
  clientForAccount: (accountId: string) => InventoryClient | Promise<InventoryClient>,
  enqueueFile: EnqueueFileFetch = enqueueFileFetch, enqueueArchive: EnqueueArchive = enqueueArchiveRun,
  timing: { yieldMs?: number; retryMs?: number } = {}): Worker<InventoryJob> {
  return new Worker<InventoryJob>(INVENTORY_QUEUE, async (job, token) => {
    const { accountId, runId } = job.data;
    let outcome: RunOutcome;
    try {
      // The runner opens (and closes) the session itself, once it holds the account lock.
      outcome = await new InventoryRunner(db, () => clientForAccount(accountId)).run(accountId, runId);
    } catch (error) {
      if (isBusy(error) && (job.data.deferrals ?? 0) < MAX_INVENTORY_DEFERRALS) {
        return postpone(job, token, timing.retryMs ?? INVENTORY_RETRY_MS);
      }
      await db.query("UPDATE sync_runs SET state='partial',error_code=? WHERE id=? AND account_id=? AND state='pending'",
        [error instanceof AppError ? error.code : "remote_unavailable", runId, accountId]);
      throw error;
    }
    if (outcome === "yielded") return postpone(job, token, timing.yieldMs ?? INVENTORY_YIELD_MS, { count: false });
    // Content and files use their own session; the inventory session is already closed.
    let archiveRunId: string | null = null;
    try { archiveRunId = await planArchive(db, accountId, "inventory", enqueueArchive, { syncRunId: runId }); }
    catch { logEvent("error", "archive_planning_failed", { accountId, runId }); }
    // An archive batch already stores the files of read items; P-03 downloads would only compete for the account lock.
    if (archiveRunId) return;
    try { await planReadAttachmentDownloads(db, accountId, runId, enqueueFile); }
    catch { logEvent("error", "read_attachment_planning_failed", { accountId, runId }); }
  }, { connection: redisOptions(), concurrency: 2 });
}
