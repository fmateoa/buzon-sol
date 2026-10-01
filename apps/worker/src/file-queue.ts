import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { FILE_QUEUE, redisOptions, type FileJob } from "@buzon-sol/domain";
import { FileFetchProcessor } from "./file-fetch.js";
import { type FileClientFactory } from "./files.js";
import { BUSY_RETRY_MS, MAX_COMMAND_DEFERRALS, isBusy, postpone } from "./postpone.js";

/**
 * A download asked by a person waits for the account (an inventory yields to it within a page) instead of failing the
 * moment the account is busy; only after `MAX_COMMAND_DEFERRALS` postponements does it close as failed.
 */
export function startFileWorker(db: DataSource, clientFactory: FileClientFactory): Worker<FileJob> {
  return new Worker<FileJob>(FILE_QUEUE, async (job, token) => {
    const final = (job.data.deferrals ?? 0) >= MAX_COMMAND_DEFERRALS;
    try {
      await new FileFetchProcessor(db, clientFactory).process(job.data.accountId, job.data.fetchId, final);
    } catch (error) {
      if (isBusy(error) && !final) return postpone(job, token, BUSY_RETRY_MS);
      throw error;
    }
  }, { connection: redisOptions(), concurrency: 2 });
}
