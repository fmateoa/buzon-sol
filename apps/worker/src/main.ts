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
export async function main(): Promise<void> {
  if (process.env.ENABLE_SUNAT_JOBS !== "true") {
    process.stdout.write("Worker idle: SUNAT jobs disabled\n");
    await waitForStop();
    return;
  }
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
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}

if (process.argv[1]?.endsWith("main.ts")) void main();
