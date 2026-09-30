import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { FILE_QUEUE, redisOptions, type FileJob } from "@buzon-sol/domain";
import { FileFetchProcessor, type FileClientFactory } from "./file-fetch.js";

export function startFileWorker(db: DataSource, clientFactory: FileClientFactory): Worker<FileJob> {
  return new Worker<FileJob>(FILE_QUEUE, async (job) => {
    await new FileFetchProcessor(db, clientFactory).process(job.data.accountId, job.data.fetchId);
  }, { connection: redisOptions(), concurrency: 2 });
}
