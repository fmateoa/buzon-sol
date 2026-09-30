import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { CONNECTION_QUEUE, redisOptions, type ConnectionJob } from "@buzon-sol/domain";
import { ConnectionProcessor, type ConnectionClientFactory } from "./connection.js";

export function startConnectionWorker(db: DataSource, clientFactory: ConnectionClientFactory): Worker<ConnectionJob> {
  return new Worker<ConnectionJob>(CONNECTION_QUEUE, async (job) => {
    await new ConnectionProcessor(db, clientFactory).process(job.data.accountId, job.data.testId);
  }, { connection: redisOptions(), concurrency: 2 });
}
