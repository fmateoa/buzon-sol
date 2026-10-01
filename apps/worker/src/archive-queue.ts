import { Queue, Worker } from "bullmq";
import { DataSource } from "typeorm";
import { ARCHIVE_QUEUE, logEvent, redisOptions, type ArchiveJob } from "@buzon-sol/domain";
import { ArchiveProcessor, type ArchiveClientFactory } from "./archive.js";
import { planArchive, type EnqueueArchive } from "./archive-plan.js";
import { type ObjectStore } from "./files.js";

export async function enqueueArchiveRun(accountId: string, runId: string, delayMs = 0): Promise<void> {
  const queue = new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection: redisOptions() });
  try {
    await queue.add("archive", { accountId, runId },
      { jobId: runId, attempts: 1, delay: delayMs, removeOnComplete: true, removeOnFail: true });
  } finally {
    await queue.close();
  }
}

function batchDelay(): number {
  const value = Number(process.env.ARCHIVE_BATCH_DELAY_MS ?? 60_000);
  if (!Number.isInteger(value) || value < 0) throw new Error("Invalid ARCHIVE_BATCH_DELAY_MS");
  return value;
}

/**
 * Each batch is one SUNAT session. While a batch finishes cleanly, made progress and items remain, the next one is
 * queued after a pause; a failed or empty batch waits for the next inventory or a manual start.
 */
export function startArchiveWorker(db: DataSource, clientFactory: ArchiveClientFactory, store?: ObjectStore,
  enqueue: EnqueueArchive = enqueueArchiveRun): Worker<ArchiveJob> {
  const delayMs = batchDelay();
  return new Worker<ArchiveJob>(ARCHIVE_QUEUE, async (job) => {
    const { accountId, runId } = job.data;
    const outcome = await new ArchiveProcessor(db, clientFactory, store).process(accountId, runId);
    if (outcome?.state !== "complete" || !outcome.progressed || outcome.remaining === 0) return;
    try { await planArchive(db, accountId, "continue", enqueue, { delayMs }); }
    catch { logEvent("error", "archive_planning_failed", { accountId, runId }); }
  }, { connection: redisOptions(), concurrency: 2 });
}
