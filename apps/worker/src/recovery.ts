import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { tryAccountLock } from "./account-lock.js";

/**
 * Recovery policy by intention type. Each pass takes the account lock before touching a run, so a live runner is
 * never disturbed, and none of them contacts SUNAT.
 *
 * | Intention            | `pending` without a job         | `running` with the lock free        | Automatic repeat |
 * |----------------------|---------------------------------|-------------------------------------|------------------|
 * | `sync_runs`          | → `partial` (resumable)         | → `partial`, checkpoint kept        | no: next start resumes |
 * | `archive_runs`       | → `partial`                     | → `partial`; next batch closes its `calling` events as `uncertain` | no: next inventory/manual start plans a new batch |
 * | `mail_read_events`   | not recovered by this pass; the job itself retries (6 attempts, 5 s) while the event is `pending` (busy lock, failed login) | `calling` → `uncertain` the next time the job runs | never: a detail request may have reached SUNAT |
 * | `file_fetches`       | not recovered (stays `pending`) | not recovered (`fetching`)          | no (archive-origin leftovers become `failed` at the next batch) |
 * | `connection_tests`   | not recovered (stays `pending`) | not recovered (`testing`)           | no: the user starts a new test |
 *
 * Reading, file and connection intentions are deliberately not requeued: the plan keeps them as documented gaps
 * until each family has a crash test at every edge (see plan 06, W-0).
 */

/** Reports whether the queue still holds a job for a run; a lost job leaves a pending run without a worker. */
export type JobExists = (runId: string) => Promise<boolean>;

/**
 * Moves runs left behind by a dead process to `partial` so they can be resumed from their checkpoint.
 * A runner holds the account lock for the whole `running` state, so taking that lock proves no runner is alive.
 */
export async function recoverOrphanRuns(db: DataSource, jobExists: JobExists): Promise<number> {
  const candidates: { id: string; account_id: string; state: string }[] = await db.query(
    "SELECT id,account_id,state FROM sync_runs WHERE state IN ('pending','running') ORDER BY account_id,id");
  let recovered = 0;
  for (const run of candidates) {
    // A queued job will be picked up and resumed by the runner itself.
    if (run.state === "pending" && await jobExists(run.id)) continue;
    const lock = await tryAccountLock(db, run.account_id);
    if (!lock) continue;
    try {
      // A job enqueued between the check and the lock would find the run partial and still resume it.
      if (run.state === "pending" && await jobExists(run.id)) continue;
      await db.transaction(async (manager) => {
        const result: { affectedRows?: number } = await manager.query(
          "UPDATE sync_runs SET state='partial',error_code='incomplete_inventory' WHERE id=? AND account_id=? AND state=?",
          [run.id, run.account_id, run.state]);
        if (!result.affectedRows) return;
        await manager.query(
          "INSERT INTO audit_events (id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?)",
          [randomUUID(), run.account_id, "recover_orphan", "sync_run", run.id, JSON.stringify({ from: run.state })]);
        recovered++;
      });
    } finally {
      await lock.release();
    }
  }
  return recovered;
}

/**
 * Archive runs left behind by a dead process or a lost job become `partial`; the next inventory or a manual start
 * queues a new batch. A live batch holds the account lock, so taking it proves none is running.
 */
export async function recoverOrphanArchiveRuns(db: DataSource, jobExists: (runId: string) => Promise<boolean>): Promise<number> {
  const candidates: { id: string; account_id: string; state: string }[] = await db.query(
    "SELECT id,account_id,state FROM archive_runs WHERE state IN ('pending','running') ORDER BY account_id,id");
  let recovered = 0;
  for (const run of candidates) {
    if (run.state === "pending" && await jobExists(run.id)) continue;
    const lock = await tryAccountLock(db, run.account_id);
    if (!lock) continue;
    try {
      if (run.state === "pending" && await jobExists(run.id)) continue;
      const result: { affectedRows?: number } = await db.query(
        `UPDATE archive_runs SET state='partial',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6)
         WHERE id=? AND account_id=? AND state=?`, [run.id, run.account_id, run.state]);
      if (result.affectedRows) recovered++;
    } finally {
      await lock.release();
    }
  }
  return recovered;
}
