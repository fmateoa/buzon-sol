import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { READ_QUEUE, redisOptions, type ReadJob } from "@buzon-sol/domain";
import { ReadProcessor, type ReadClient } from "./reading.js";

export function startReadWorker(db: DataSource, clientForAccount: (accountId: string) => ReadClient): Worker<ReadJob> {
  return new Worker<ReadJob>(READ_QUEUE, async (job) => {
    const { accountId, eventId } = job.data;
    let client: ReadClient | undefined;
    try {
      client = clientForAccount(accountId);
      await new ReadProcessor(db, client).process(accountId, eventId);
    } finally {
      try { await client?.close?.(); }
      catch { process.stderr.write("SUNAT session cleanup failed\n"); }
    }
  }, { connection: redisOptions(), concurrency: 2 });
}
