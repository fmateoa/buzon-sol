import { Worker } from "bullmq";
import { DataSource } from "typeorm";
import { INVENTORY_QUEUE, redisOptions, type InventoryJob } from "@buzon-sol/domain";
import { type InventoryClient } from "@buzon-sol/sunat-adapter";
import { InventoryRunner } from "./inventory.js";

/** Production must supply a transport validated by the SUNAT integration plan. */
export function startInventoryWorker(db: DataSource, clientForAccount: (accountId: string) => InventoryClient): Worker<InventoryJob> {
  return new Worker<InventoryJob>(INVENTORY_QUEUE, async (job) => {
    const { accountId, runId } = job.data;
    let client: InventoryClient | undefined;
    try {
      client = clientForAccount(accountId);
      await new InventoryRunner(db, client).run(accountId, runId);
    } catch (error) {
      await db.query("UPDATE sync_runs SET state='partial',error_code='remote_unavailable' WHERE id=? AND account_id=? AND state='pending'", [runId, accountId]);
      throw error;
    } finally {
      try { await client?.close?.(); }
      catch { process.stderr.write("SUNAT session cleanup failed\n"); }
    }
  }, { connection: redisOptions(), concurrency: 2 });
}
