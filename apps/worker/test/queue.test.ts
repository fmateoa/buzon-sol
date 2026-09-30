import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Queue, QueueEvents } from "bullmq";
import { INVENTORY_QUEUE, redisOptions, type InventoryJob } from "@buzon-sol/domain";
import { InventoryRunner } from "../src/inventory";
import { startInventoryWorker } from "../src/queue";
import { testDb } from "./db";

test("BullMQ dispatches a persisted inventory run with an isolated test client",
  { skip: process.env.BUZON_TEST_DB !== "1" || process.env.BUZON_TEST_REDIS !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID();
  const client = { async listPage(_box: "messages" | "notifications", _page: number) {
    return { contentType: "application/json", body: '{"rows":[],"records":0,"total":0}' };
  } };
  const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const events = new QueueEvents(INVENTORY_QUEUE, { connection: redisOptions() });
  const worker = startInventoryWorker(db, () => client);
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    const runId = await new InventoryRunner(db, client).createRun(accountId, "test");
    await events.waitUntilReady();
    const job = await queue.add("inventory", { accountId, runId }, { jobId: runId, removeOnComplete: true });
    await job.waitUntilFinished(events, 10_000);
    const rows: { state: string }[] = await db.query("SELECT state FROM sync_runs WHERE id=?", [runId]);
    assert.equal(rows[0].state, "complete");
    const pages: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM sync_pages WHERE run_id=?", [runId]);
    assert.equal(Number(pages[0].n), 2);
  } finally {
    await worker.close();
    await events.close();
    await queue.close();
    await db.destroy();
  }
});
