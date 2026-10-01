import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { CONNECTION_QUEUE, logEvent, redisOptions, type ConnectionJob } from "@buzon-sol/domain";
import { ConnectionProcessor, type ConnectionClientFactory } from "./connection.js";
import { BUSY_RETRY_MS, MAX_COMMAND_DEFERRALS, isBusy, postpone } from "./postpone.js";

/**
 * `afterTest` runs once a test finished without error (the account lock is already released); the worker uses it to
 * start the initial load of an account whose credential just proved valid. Its failure never fails the test.
 */
export function startConnectionWorker(db: DataSource, clientFactory: ConnectionClientFactory,
  afterTest?: (accountId: string) => Promise<unknown>): Worker<ConnectionJob> {
  return new Worker<ConnectionJob>(CONNECTION_QUEUE, async (job, token) => {
    const final = (job.data.deferrals ?? 0) >= MAX_COMMAND_DEFERRALS;
    try {
      await new ConnectionProcessor(db, clientFactory).process(job.data.accountId, job.data.testId, final);
    } catch (error) {
      if (isBusy(error) && !final) return postpone(job, token, BUSY_RETRY_MS);
      throw error;
    }
    if (afterTest) {
      try { await afterTest(job.data.accountId); }
      catch { logEvent("error", "after_connection_test_failed", { accountId: job.data.accountId }); }
    }
  }, { connection: redisOptions(), concurrency: 2 });
}
