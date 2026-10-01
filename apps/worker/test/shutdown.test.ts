import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Queue } from "bullmq";
import { INVENTORY_QUEUE, redisOptions, type InventoryJob } from "@buzon-sol/domain";
import { type SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { tryAccountLock } from "../src/account-lock";
import { InventoryRunner } from "../src/inventory";
import { main } from "../src/main";
import { testDb } from "./db";

const skip = process.env.BUZON_TEST_DB !== "1" || process.env.BUZON_TEST_REDIS !== "1";
const ENV = ["ENABLE_SUNAT_JOBS", "SUNAT_TRANSPORT_VALIDATED", "SOL_PRIVATE_KEY_PEM", "RECOVERY_INTERVAL_MS"];

test("SIGTERM lets the active job finish, takes no new job and releases the lock and connections",
  { skip, timeout: 30_000 }, async () => {
  const prior = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
  const db = await testDb();
  const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisOptions() });
  const first = randomUUID(), second = randomUUID();
  let secondJob: string | undefined;
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const inside = new Promise<void>((resolve) => { entered = resolve; });
  let closed = 0;
  const sessions: string[] = [];
  const fake = (accountId: string) => {
    sessions.push(accountId);
    return Promise.resolve({
      async listPage() { entered(); await blocked; return { contentType: "application/json", body: '{"rows":[]}' }; },
      async close() { closed++; },
    } as unknown as SunatHttpSession);
  };
  try {
    process.env.ENABLE_SUNAT_JOBS = "true";
    process.env.SUNAT_TRANSPORT_VALIDATED = "true";
    process.env.SOL_PRIVATE_KEY_PEM = "unused-by-injected-session";
    process.env.RECOVERY_INTERVAL_MS = "3600000";
    const running = main({ openSession: fake });
    await new Promise((resolve) => setTimeout(resolve, 500)); // consumers attached and the startup recovery pass done
    const runs: Record<string, string> = {};
    for (const accountId of [first, second]) {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
      runs[accountId] = await new InventoryRunner(db, () => { throw new Error("unused"); }).createRun(accountId, "test");
    }
    await queue.add("inventory", { accountId: first, runId: runs[first] }, { jobId: runs[first], removeOnComplete: true });
    await inside;

    let finished = false;
    running.then(() => { finished = true; });
    process.emit("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    secondJob = runs[second];
    await queue.add("inventory", { accountId: second, runId: runs[second] }, { jobId: runs[second], removeOnComplete: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(finished, false, "shutdown waits for the job in flight");
    release();
    await running;

    assert.deepEqual(sessions, [first], "no session for the job queued after the signal");
    assert.equal(closed, 1);
    const states = Object.fromEntries((await db.query("SELECT id,state FROM sync_runs WHERE id IN (?,?)", [runs[first], runs[second]]))
      .map((row: { id: string; state: string }) => [row.id, row.state]));
    assert.deepEqual([states[runs[first]], states[runs[second]]], ["complete", "pending"]);
    const lock = await tryAccountLock(db, first);
    assert.ok(lock, "the account lock was released");
    await lock.release();
  } finally {
    if (secondJob) await queue.remove(secondJob).catch(() => undefined);
    await queue.close();
    await db.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("a MySQL failure at startup rejects without leaving queues or timers behind",
  { skip, timeout: 30_000 }, async () => {
  const prior = Object.fromEntries([...ENV, "DB_PASSWORD"].map((key) => [key, process.env[key]]));
  try {
    process.env.ENABLE_SUNAT_JOBS = "true";
    process.env.SUNAT_TRANSPORT_VALIDATED = "true";
    process.env.SOL_PRIVATE_KEY_PEM = "unused-by-injected-session";
    process.env.DB_PASSWORD = "wrong-password-for-test";
    await assert.rejects(main({ openSession: () => Promise.reject(new Error("unused")) }));
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
