import { Queue, type Worker } from "bullmq";
import { SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { ARCHIVE_QUEUE, INVENTORY_QUEUE, logEvent, redisOptions, type ArchiveJob, type InventoryJob } from "@buzon-sol/domain";
import { loadWorkerConfig } from "./config.js";
import { every } from "./loop.js";
import { recoverOrphanArchiveRuns } from "./archive.js";
import { startArchiveWorker } from "./archive-queue.js";
import { startConnectionWorker } from "./connection-queue.js";
import { loadSolCredential } from "./credentials.js";
import { workerDataSource } from "./data-source.js";
import { startFileWorker } from "./file-queue.js";
import { startInventoryWorker } from "./queue.js";
import { startReadWorker } from "./read-queue.js";
import { recoverOrphanRuns } from "./recovery.js";
import { dispatchDueSchedules } from "./scheduler.js";
import { SunatFileClient } from "./sunat-file-client.js";

function waitForStop(): Promise<void> {
  return new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}

/**
 * Worker process boundary. Each SUNAT capability has its own gate and none is on by default: connection tests,
 * inventory, explicit reads plus the per-account archive, file downloads and the scheduler loop. Every job opens
 * its own session for one account and closes it; no cookie jar outlives a job. Maintenance runs with any gate.
 */
export async function main(): Promise<void> {
  const config = loadWorkerConfig();
  if (!config.enabled) {
    logEvent("info", "worker_idle");
    await waitForStop();
    return;
  }
  const { connection, transport, reading, files, cron, recoveryMs, schedulerMs } = config;

  const db = await workerDataSource().initialize();
  const inventoryQueue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const archiveQueue = new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection: redisOptions() });
  const session = async (accountId: string) => SunatHttpSession.open(await loadSolCredential(db, accountId));
  const workers: Worker[] = [];
  const stops: (() => Promise<void>)[] = [];
  try {
    if (connection) workers.push(startConnectionWorker(db, (credential) => SunatHttpSession.open(credential)));
    if (transport) workers.push(startInventoryWorker(db, session));
    if (reading) workers.push(startReadWorker(db, session), startArchiveWorker(db, session));
    if (files) workers.push(startFileWorker(db, async (accountId) => new SunatFileClient(db, await session(accountId))));
    // Job failures are recorded by each processor; this only keeps a queue connection error from ending the process.
    for (const worker of workers) worker.on("error", () => logEvent("error", "queue_worker_error", { queue: worker.name }));

    stops.push(every(recoveryMs, async () => {
      try {
        const recovered = await recoverOrphanRuns(db, async (runId) => Boolean(await inventoryQueue.getJob(runId)));
        const archives = await recoverOrphanArchiveRuns(db, async (runId) => Boolean(await archiveQueue.getJob(runId)));
        if (recovered || archives) logEvent("warn", "orphan_runs_recovered", { recovered, archives });
      } catch {
        logEvent("error", "orphan_recovery_failed");
      }
    }));
    if (cron) {
      stops.push(every(schedulerMs, async () => {
        try {
          const dispatched = await dispatchDueSchedules(db, async (accountId, runId) => {
            await inventoryQueue.add("inventory", { accountId, runId },
              { jobId: runId, attempts: 1, removeOnComplete: true, removeOnFail: true });
          });
          if (dispatched) logEvent("info", "schedules_dispatched", { dispatched });
        } catch {
          logEvent("error", "scheduler_pass_failed");
        }
      }));
    }
    logEvent("info", "worker_started", { connection, inventory: transport, reading, archive: reading, files, scheduler: cron });
    await waitForStop();
  } finally {
    // Stop the loops first (and let a pass in flight finish) so nothing uses the queues or MySQL once they close.
    await Promise.allSettled(stops.map((stop) => stop()));
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await Promise.allSettled([inventoryQueue.close(), archiveQueue.close()]);
    await db.destroy();
  }
}

if (process.argv[1]?.endsWith("main.ts")) {
  main().catch((error) => {
    // Configuration errors carry no secrets; anything else is reported without its message.
    logEvent("error", "worker_stopped", { reason: error instanceof Error && /^(SUNAT |Invalid )/.test(error.message) ? error.message : "unexpected" });
    process.exitCode = 1;
  });
}
