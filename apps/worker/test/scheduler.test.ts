import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { dispatchDueSchedules } from "../src/scheduler";
import { testDb } from "./db";

test("due schedules create one run per account, advance Lima slot and pause on queue failure",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
    const db = await testDb();
    const accountId = randomUUID(), roleId = randomUUID(), adminId = randomUUID();
    const now = new Date("2026-09-30T14:00:00.000Z");
    try {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [accountId, "Scheduler fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
      await db.query("INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), accountId, 1, Buffer.from("fictional"), Buffer.alloc(12), "test", "valid"]);
      await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [roleId, `Schedule admin ${roleId}`]);
      await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "manage_accounts"]);
      await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [adminId, `scheduler-${adminId}@example.test`, "Fixture", "fixture-hash", "active", roleId]);
      await db.query(
        `INSERT INTO sync_schedules
         (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state,next_run_at)
         VALUES (?,?,?,?,?,?,?,'active',?)`,
        [randomUUID(), accountId, "daily", JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
          "08:00:00", "17:00:00", JSON.stringify(["messages"]), new Date("2026-09-30T13:00:00.000Z")]);
      await assert.rejects(dispatchDueSchedules(db, async () => {}, now),
        (error) => error instanceof AppError && error.code === "remote_unavailable");
      process.env.SUNAT_CRON_VALIDATED = "true";
      // Without S-04 validated, an admin must accept the possible remote effect of logging in.
      assert.equal(await dispatchDueSchedules(db, async () => { throw new Error("must not enqueue"); }, now), 0);
      const gated: { state: string; pause_reason: string }[] = await db.query(
        "SELECT state,pause_reason FROM sync_schedules WHERE account_id=?", [accountId]);
      assert.deepEqual([gated[0].state, gated[0].pause_reason], ["paused", "remote_effect_not_accepted"]);
      await db.query("UPDATE sync_schedules SET state='active',pause_reason=NULL,remote_effect_accepted=true,next_run_at=? WHERE account_id=?",
        [new Date("2026-09-30T13:00:00.000Z"), accountId]);
      await db.query("DELETE FROM in_app_notices WHERE account_id=?", [accountId]);
      const jobs: string[] = [];
      const enqueue = async (_account: string, runId: string) => { jobs.push(runId); };
      const dispatched = await Promise.all([
        dispatchDueSchedules(db, enqueue, now), dispatchDueSchedules(db, enqueue, now),
      ]);
      assert.equal(dispatched.reduce((a, b) => a + b, 0), 1);
      assert.equal(jobs.length, 1);
      const run: { mode: string; state: string; boxes_json: string[] | string }[] = await db.query("SELECT mode,state,boxes_json FROM sync_runs WHERE id=?", [jobs[0]]);
      assert.deepEqual([run[0].mode, run[0].state], ["scheduled", "pending"]);
      assert.deepEqual(typeof run[0].boxes_json === "string" ? JSON.parse(run[0].boxes_json) : run[0].boxes_json, ["messages"]);
      const next: { next_run_at: Date }[] = await db.query("SELECT next_run_at FROM sync_schedules WHERE account_id=?", [accountId]);
      assert.equal(next[0].next_run_at.toISOString(), "2026-10-01T13:00:00.000Z");
      assert.equal(await dispatchDueSchedules(db, enqueue, now), 0);
      await db.query("UPDATE sync_runs SET state='complete' WHERE id=?", [jobs[0]]);
      await db.query("UPDATE sync_schedules SET next_run_at=? WHERE account_id=?", [now, accountId]);
      assert.equal(await dispatchDueSchedules(db, async () => { throw new Error("Redis unavailable"); }, now), 0);
      const paused: { state: string; pause_reason: string }[] = await db.query(
        "SELECT state,pause_reason FROM sync_schedules WHERE account_id=?", [accountId]);
      assert.deepEqual([paused[0].state, paused[0].pause_reason], ["paused", "queue_unavailable"]);
      const notice: { n: number }[] = await db.query(
        "SELECT COUNT(*) AS n FROM in_app_notices WHERE account_id=? AND user_id=?", [accountId, adminId]);
      assert.equal(Number(notice[0].n), 1);
      const noCredentialAccount = randomUUID();
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [noCredentialAccount, "No credential fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
      await db.query(
        `INSERT INTO sync_schedules
         (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state,next_run_at)
         VALUES (?,?,?,?,?,?,?,'active',?)`,
        [randomUUID(), noCredentialAccount, "daily", JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
          "08:00:00", "17:00:00", JSON.stringify(["messages"]), now]);
      assert.equal(await dispatchDueSchedules(db, enqueue, now), 0);
      const withoutCredential: { state: string; pause_reason: string }[] = await db.query(
        "SELECT state,pause_reason FROM sync_schedules WHERE account_id=?", [noCredentialAccount]);
      assert.deepEqual([withoutCredential[0].state, withoutCredential[0].pause_reason], ["paused", "needs_credential"]);
    } finally {
      delete process.env.SUNAT_CRON_VALIDATED;
      await db.destroy();
    }
  });
