import { Queue, type Worker } from "bullmq";
import { type DataSource } from "typeorm";
import { SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { ARCHIVE_QUEUE, INVENTORY_QUEUE, logEvent, redisOptions, type ArchiveJob, type InventoryJob } from "@buzon-sol/domain";
import { loadWorkerConfig } from "./config.js";
import { every } from "./loop.js";
import { startArchiveWorker } from "./archive-queue.js";
import { startConnectionWorker } from "./connection-queue.js";
import { loadSolCredential } from "./credentials.js";
import { workerDataSource } from "./data-source.js";
import { startFileWorker } from "./file-queue.js";
import { planInitialLoad } from "./initial-load.js";
import { startInventoryWorker } from "./queue.js";
import { startReadWorker } from "./read-queue.js";
import { recoverOrphanArchiveRuns, recoverOrphanRuns } from "./recovery.js";
import { dispatchDueSchedules } from "./scheduler.js";
import { SunatFileClient } from "./sunat-file-client.js";

/**
 * Espera SIGINT/SIGTERM. Un temporizador mantiene vivo el proceso: sin puertas SUNAT no hay conexiones abiertas y,
 * sin él, Node terminaría con código 0 justo después de `worker_idle` (y Docker lo reiniciaría en bucle).
 */
function waitForStop(): Promise<void> {
  return new Promise((resolve) => {
    const keepAlive = setInterval(() => undefined, 2 ** 30);
    const stop = (): void => { clearInterval(keepAlive); resolve(); };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

export interface MainOptions {
  /** Opens one SUNAT session for an account; tests inject a client that never reaches the network. */
  openSession?: (accountId: string, db: DataSource) => Promise<SunatHttpSession>;
}

/** Runs every closer even if one fails; a failure is named by step, never by its message. */
async function closeAll(steps: [string, () => Promise<unknown>][]): Promise<void> {
  const results = await Promise.allSettled(steps.map(([, close]) => close()));
  results.forEach((result, index) => {
    if (result.status === "rejected") logEvent("error", "shutdown_step_failed", { step: steps[index][0] });
  });
}

/**
 * Worker process boundary. Each SUNAT capability has its own gate and none is on by default: connection tests,
 * inventory, explicit reads plus the per-account archive, file downloads and the scheduler loop. A session is opened
 * by the use case that holds the account lock and closed by it; no cookie jar outlives a job. Maintenance runs
 * with any gate.
 *
 * Shutdown order: stop the periodic loops (waiting for a pass in flight), close the consumers (no new job is taken
 * and active jobs finish), close the queues, then MySQL. Every resource is registered as soon as it is acquired, so a
 * failure at any point of startup releases what was already opened.
 */
export async function main(options: MainOptions = {}): Promise<void> {
  const config = loadWorkerConfig();
  if (!config.enabled) {
    logEvent("info", "worker_idle");
    await waitForStop();
    return;
  }
  const { connection, transport, reading, files, cron, recoveryMs, schedulerMs } = config;

  const workers: Worker[] = [];
  const queues: Queue[] = [];
  const stops: (() => Promise<void>)[] = [];
  let db: DataSource | undefined;
  try {
    const source = workerDataSource();
    db = await source.initialize();
    const inventoryQueue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
    queues.push(inventoryQueue);
    const archiveQueue = new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection: redisOptions() });
    queues.push(archiveQueue);
    const open = options.openSession ?? (async (accountId: string, source: DataSource) =>
      SunatHttpSession.open(await loadSolCredential(source, accountId)));
    const session = (accountId: string) => open(accountId, source);
    const enqueueInventory = async (accountId: string, runId: string) => {
      await inventoryQueue.add("inventory", { accountId, runId },
        { jobId: runId, attempts: 1, removeOnComplete: true, removeOnFail: true });
    };
    // A credential that just proved valid starts the account's initial load, but only where inventory is enabled.
    if (connection) workers.push(startConnectionWorker(source, (credential) => SunatHttpSession.open(credential),
      transport ? (accountId) => planInitialLoad(source, accountId, enqueueInventory) : undefined));
    if (transport) workers.push(startInventoryWorker(source, session));
    if (reading) workers.push(startReadWorker(source, session), startArchiveWorker(source, session));
    if (files) workers.push(startFileWorker(source, async (accountId) => new SunatFileClient(source, await session(accountId))));
    // Job failures are recorded by each processor; this only keeps a queue connection error from ending the process.
    for (const worker of workers) worker.on("error", () => logEvent("error", "queue_worker_error", { queue: worker.name }));

    stops.push(every(recoveryMs, async () => {
      try {
        const recovered = await recoverOrphanRuns(source, async (runId) => Boolean(await inventoryQueue.getJob(runId)));
        const archives = await recoverOrphanArchiveRuns(source, async (runId) => Boolean(await archiveQueue.getJob(runId)));
        if (recovered || archives) logEvent("warn", "orphan_runs_recovered", { recovered, archives });
      } catch {
        logEvent("error", "orphan_recovery_failed");
      }
    }));
    if (cron) {
      stops.push(every(schedulerMs, async () => {
        try {
          const dispatched = await dispatchDueSchedules(source, enqueueInventory);
          if (dispatched) logEvent("info", "schedules_dispatched", { dispatched });
        } catch {
          logEvent("error", "scheduler_pass_failed");
        }
      }));
    }
    logEvent("info", "worker_started", { connection, inventory: transport, reading, archive: reading, files, scheduler: cron });
    await waitForStop();
  } finally {
    await closeAll(stops.map((stop, index) => [`loop_${index}`, stop]));
    await closeAll(workers.map((worker) => [`consumer_${worker.name}`, () => worker.close()]));
    await closeAll(queues.map((queue) => [`queue_${queue.name}`, () => queue.close()]));
    if (db?.isInitialized) await closeAll([["mysql", () => db!.destroy()]]);
  }
}

if (process.argv[1]?.endsWith("main.ts")) {
  main().catch((error) => {
    // Configuration errors carry no secrets; anything else is reported without its message.
    logEvent("error", "worker_stopped", { reason: error instanceof Error && /^(SUNAT |Invalid )/.test(error.message) ? error.message : "unexpected" });
    process.exitCode = 1;
  });
}
