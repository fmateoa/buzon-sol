<<<<<<< HEAD
import { Queue } from "bullmq";
import { DataSource } from "typeorm";
import { INVENTORY_QUEUE, logEvent, redisOptions, type InventoryJob } from "@buzon-sol/domain";
import { recoverOrphanRuns } from "./recovery.js";
import { dispatchDueSchedules } from "./scheduler.js";

/** The schema is owned by the API migrations; the worker never synchronizes or migrates. */
export function workerDataSource(): DataSource {
  return new DataSource({
    type: "mysql", host: process.env.DB_HOST ?? "127.0.0.1", port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? "buzon", password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "buzon_sol", charset: "utf8mb4", timezone: "Z",
    synchronize: false, migrationsRun: false,
  });
}

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

/**
 * Worker process boundary. Maintenance runs always; the scheduler loop only after the unattended-cron gate;
 * SUNAT job consumers only once validated clients exist (none yet: transport NO_VALIDADO).
 */
=======
import { SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { Queue } from "bullmq";
import { INVENTORY_QUEUE, redisApiOptions, type InventoryJob } from "@buzon-sol/domain";
import { loadSolCredential } from "./credentials.js";
import { workerDataSource } from "./data-source.js";
import { startConnectionWorker } from "./connection-queue.js";
import { startInventoryWorker } from "./queue.js";
import { startReadWorker } from "./read-queue.js";
import { startFileWorker } from "./file-queue.js";
import { SunatFileClient } from "./sunat-file-client.js";
import { dispatchDueSchedules } from "./scheduler.js";

/** Connection tests can run independently; inventory remains gated by phase A. */
>>>>>>> 46cdc85e8eb7b709969c3920163453507626d844
export async function main(): Promise<void> {
  if (process.env.ENABLE_SUNAT_JOBS !== "true") {
    process.stdout.write("Worker idle: SUNAT jobs disabled\n");
    await waitForStop();
    return;
  }
<<<<<<< HEAD
  const recoveryMs = interval("RECOVERY_INTERVAL_MS", 300_000);
  const schedulerMs = interval("SCHEDULER_INTERVAL_MS", 60_000);
  const db = await workerDataSource().initialize();
  const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const stops = [every(recoveryMs, async () => {
    try {
      const recovered = await recoverOrphanRuns(db, async (runId) => Boolean(await queue.getJob(runId)));
      if (recovered) logEvent("warn", "orphan_runs_recovered", { recovered });
    } catch {
      logEvent("error", "orphan_recovery_failed");
    }
  })];
  if (process.env.SUNAT_CRON_VALIDATED === "true") {
    stops.push(every(schedulerMs, async () => {
      try {
        const dispatched = await dispatchDueSchedules(db, async (accountId, runId) => {
          await queue.add("inventory", { accountId, runId }, { jobId: runId, attempts: 1, removeOnComplete: true, removeOnFail: true });
        });
        if (dispatched) logEvent("info", "schedules_dispatched", { dispatched });
      } catch {
        logEvent("error", "scheduler_pass_failed");
      }
    }));
  }
  logEvent("info", "worker_started", { sunatJobs: false, scheduler: process.env.SUNAT_CRON_VALIDATED === "true" });
  await new Promise<void>((resolve) => {
=======
  if (process.env.SUNAT_CONNECTION_CLIENT_READY !== "true" &&
      process.env.SUNAT_TRANSPORT_VALIDATED !== "true") {
    throw new Error("SUNAT jobs need an explicitly validated capability");
  }
  if (process.env.SUNAT_CRON_VALIDATED === "true" && process.env.SUNAT_TRANSPORT_VALIDATED !== "true") {
    throw new Error("SUNAT cron requires validated inventory transport");
  }
  if (process.env.SUNAT_READ_VALIDATED === "true" && process.env.SUNAT_TRANSPORT_VALIDATED !== "true") {
    throw new Error("SUNAT reading requires validated inventory transport");
  }
  if (process.env.SUNAT_FILE_CLIENT_READY === "true" &&
      (process.env.SUNAT_READ_VALIDATED !== "true" || process.env.SUNAT_TRANSPORT_VALIDATED !== "true")) {
    throw new Error("SUNAT files require validated reading and inventory");
  }
  await workerDataSource.initialize();
  const workers = [];
  let stopScheduler: (() => Promise<void>) | undefined;
  try {
    if (process.env.SUNAT_CONNECTION_CLIENT_READY === "true") {
      workers.push(startConnectionWorker(workerDataSource, (credential) => SunatHttpSession.open(credential)));
    }
    if (process.env.SUNAT_TRANSPORT_VALIDATED === "true") {
      workers.push(startInventoryWorker(workerDataSource, async (accountId) =>
        SunatHttpSession.open(await loadSolCredential(workerDataSource, accountId))));
    }
    if (process.env.SUNAT_READ_VALIDATED === "true") {
      workers.push(startReadWorker(workerDataSource, async (accountId) =>
        SunatHttpSession.open(await loadSolCredential(workerDataSource, accountId))));
    }
    if (process.env.SUNAT_FILE_CLIENT_READY === "true") {
      workers.push(startFileWorker(workerDataSource, async (accountId) =>
        new SunatFileClient(workerDataSource,
          await SunatHttpSession.open(await loadSolCredential(workerDataSource, accountId)))));
    }
    if (process.env.SUNAT_CRON_VALIDATED === "true") stopScheduler = startScheduler();
    process.stdout.write("SUNAT worker ready\n");
    await waitForStop();
  } finally {
    await stopScheduler?.();
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await workerDataSource.destroy();
  }
}

function startScheduler(): () => Promise<void> {
  const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisApiOptions() });
  let active: Promise<void> | undefined;
  const tick = () => {
    if (active) return;
    active = dispatchDueSchedules(workerDataSource, async (accountId, runId) => {
      await queue.add("inventory", { accountId, runId },
        { jobId: runId, attempts: 1, removeOnComplete: true, removeOnFail: true });
    }).then(() => {}, () => { process.stderr.write("SUNAT scheduler pass failed\n"); })
      .finally(() => { active = undefined; });
  };
  tick();
  const interval = setInterval(tick, 30_000);
  return async () => { clearInterval(interval); await active; await queue.close(); };
}

function waitForStop(): Promise<void> {
  return new Promise((resolve) => {
>>>>>>> 46cdc85e8eb7b709969c3920163453507626d844
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  for (const stop of stops) stop();
  await queue.close();
  await db.destroy();
}

if (process.argv[1]?.endsWith("main.ts")) void main();
