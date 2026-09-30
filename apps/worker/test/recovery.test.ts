import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { recoverOrphanRuns } from "../src/recovery";
import { InventoryRunner } from "../src/inventory";
import { testDb } from "./db";

test("orphan runs become resumable partial runs; live or queued runs are untouched",
  { timeout: 10000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accounts = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [crashed, lost, queued, live] = accounts;
  const empty = { async listPage() { return { contentType: "application/json", body: '{"rows":[]}' }; } };
  const runs: Record<string, string> = {};
  try {
    for (const accountId of accounts) {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
      runs[accountId] = await new InventoryRunner(db, empty).createRun(accountId, "test");
    }
    await db.query("UPDATE sync_runs SET state='running',resume_box=1,resume_page=7 WHERE id IN (?,?)", [runs[crashed], runs[live]]);
    const holder = db.createQueryRunner();
    await holder.connect();
    await holder.query("SELECT GET_LOCK(?,0)", [`buzon:${live}`]);
    try {
      const recovered = await recoverOrphanRuns(db, async (runId) => runId === runs[queued]);
      assert.ok(recovered >= 2);
    } finally {
      await holder.query("SELECT RELEASE_LOCK(?)", [`buzon:${live}`]);
      await holder.release();
    }
    const states: { id: string; state: string; error_code: string | null; resume_page: number }[] = await db.query(
      "SELECT id,state,error_code,resume_page FROM sync_runs WHERE id IN (?,?,?,?)", Object.values(runs));
    const byId = new Map(states.map((row) => [row.id, row]));
    assert.deepEqual([byId.get(runs[crashed])?.state, byId.get(runs[crashed])?.error_code], ["partial", "incomplete_inventory"]);
    assert.equal(byId.get(runs[crashed])?.resume_page, 7);
    assert.equal(byId.get(runs[lost])?.state, "partial");
    assert.equal(byId.get(runs[queued])?.state, "pending");
    assert.equal(byId.get(runs[live])?.state, "running");
    const audit: { n: number }[] = await db.query(
      "SELECT COUNT(*) AS n FROM audit_events WHERE action='recover_orphan' AND object_id IN (?,?)", [runs[crashed], runs[lost]]);
    assert.equal(Number(audit[0].n), 2);
    // The recovered checkpoint resumes where the dead process stopped.
    const pages: string[] = [];
    await new InventoryRunner(db, { async listPage(box, page) {
      pages.push(`${box}:${page}`);
      return { contentType: "application/json", body: '{"rows":[]}' };
    } }).run(crashed, runs[crashed]);
    assert.equal(pages[0], "messages:7");
    assert.equal(await recoverOrphanRuns(db, async () => false) >= 0, true);
    const again: { state: string }[] = await db.query("SELECT state FROM sync_runs WHERE id=?", [runs[crashed]]);
    assert.equal(again[0].state, "complete");
  } finally {
    await db.query("UPDATE sync_runs SET state='partial' WHERE id IN (?,?,?,?) AND state IN ('pending','running')", Object.values(runs));
    await db.destroy();
  }
});
