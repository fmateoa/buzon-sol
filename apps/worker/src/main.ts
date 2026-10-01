import { Queue, type Worker } from "bullmq";
import { SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { ARCHIVE_QUEUE, INVENTORY_QUEUE, logEvent, redisOptions, type ArchiveJob, type InventoryJob } from "@buzon-sol/domain";
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

const gate = (name: string): boolean => process.env[name] === "true";

function interval(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 10_000) throw new Error(`Invalid ${name}`);
  return value;
}

/** Runs `task` now and then every `ms`, never overlapping itself. */
function every(ms: number, task: () => Promise<void>): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await task(); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), ms);
  return () => clearInterval(timer);
}

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
  if (!gate("ENABLE_SUNAT_JOBS")) {
    logEvent("info", "worker_idle");
    await waitForStop();
    return;
  }
  const transport = gate("SUNAT_TRANSPORT_VALIDATED"), reading = gate("SUNAT_READ_VALIDATED");
  const connection = gate("SUNAT_CONNECTION_CLIENT_READY"), files = gate("SUNAT_FILE_CLIENT_READY");
  const cron = gate("SUNAT_CRON_VALIDATED");
  if (!connection && !transport) throw new Error("SUNAT jobs need an explicitly validated capability");
  if (cron && !transport) throw new Error("SUNAT cron requires validated inventory transport");
  if (reading && !transport) throw new Error("SUNAT reading requires validated inventory transport");
  if (files && (!reading || !transport)) throw new Error("SUNAT files require validated reading and inventory");
  const recoveryMs = interval("RECOVERY_INTERVAL_MS", 300_000);
  const schedulerMs = interval("SCHEDULER_INTERVAL_MS", 60_000);

  const db = await workerDataSource().initialize();
  const inventoryQueue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const archiveQueue = new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection: redisOptions() });
  const session = async (accountId: string) => SunatHttpSession.open(await loadSolCredential(db, accountId));
  const workers: Worker[] = [];
  const stops: (() => void)[] = [];
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
    for (const stop of stops) stop();
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
