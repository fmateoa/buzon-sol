import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { READ_QUEUE, redisOptions, type ReadJob } from "@buzon-sol/domain";
import { ReadProcessor, type ReadClient } from "./reading.js";

export function startReadWorker(db: DataSource, clientForAccount: (accountId: string) => ReadClient | Promise<ReadClient>): Worker<ReadJob> {
  return new Worker<ReadJob>(READ_QUEUE, async (job) => {
    const { accountId, eventId } = job.data;
    await new ReadProcessor(db, () => clientForAccount(accountId)).process(accountId, eventId);
  }, { connection: redisOptions(), concurrency: 2 });
}
