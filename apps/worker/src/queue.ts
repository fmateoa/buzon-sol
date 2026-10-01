import { Queue, Worker } from "bullmq";
import { DataSource } from "typeorm";
<<<<<<< HEAD
import { FILE_QUEUE, INVENTORY_QUEUE, redisOptions, type FileJob, type InventoryJob, logEvent } from "@buzon-sol/domain";
=======
import { AppError, INVENTORY_QUEUE, redisOptions, type InventoryJob } from "@buzon-sol/domain";
>>>>>>> 46cdc85e8eb7b709969c3920163453507626d844
import { type InventoryClient } from "@buzon-sol/sunat-adapter";
import { InventoryRunner } from "./inventory.js";
import { planReadAttachmentDownloads, type EnqueueFileFetch } from "./read-attachments.js";

async function enqueueFileFetch(accountId: string, fetchId: string): Promise<void> {
  const queue = new Queue<FileJob>(FILE_QUEUE, { connection: redisOptions() });
  try {
    await queue.add("file", { accountId, fetchId }, { jobId: fetchId, attempts: 1, removeOnComplete: true, removeOnFail: true });
  } finally {
    await queue.close();
  }
}

/** Production must supply a transport validated by the SUNAT integration plan. */
<<<<<<< HEAD
export function startInventoryWorker(db: DataSource, clientForAccount: (accountId: string) => InventoryClient,
  enqueueFile: EnqueueFileFetch = enqueueFileFetch): Worker<InventoryJob> {
=======
export function startInventoryWorker(db: DataSource, clientForAccount: (accountId: string) => InventoryClient | Promise<InventoryClient>): Worker<InventoryJob> {
>>>>>>> 46cdc85e8eb7b709969c3920163453507626d844
  return new Worker<InventoryJob>(INVENTORY_QUEUE, async (job) => {
    const { accountId, runId } = job.data;
    let client: InventoryClient | undefined;
    try {
      client = await clientForAccount(accountId);
      await new InventoryRunner(db, client).run(accountId, runId);
    } catch (error) {
      await db.query("UPDATE sync_runs SET state='partial',error_code=? WHERE id=? AND account_id=? AND state='pending'",
        [error instanceof AppError ? error.code : "remote_unavailable", runId, accountId]);
      throw error;
    } finally {
      try { await client?.close?.(); }
      catch { logEvent("warn", "sunat_session_cleanup_failed", { accountId }); }
    }
    // Downloads use their own session in the file worker; the inventory session is already closed.
    try { await planReadAttachmentDownloads(db, accountId, runId, enqueueFile); }
    catch { logEvent("error", "read_attachment_planning_failed", { accountId, runId }); }
  }, { connection: redisOptions(), concurrency: 2 });
}
