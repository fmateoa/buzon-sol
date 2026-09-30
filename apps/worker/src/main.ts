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
export async function main(): Promise<void> {
  if (process.env.ENABLE_SUNAT_JOBS === "true") {
    throw new Error("SUNAT jobs are not implemented or validated");
  }
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
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  for (const stop of stops) stop();
  await queue.close();
  await db.destroy();
}

if (process.argv[1]?.endsWith("main.ts")) void main();
