import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

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
    const lease = db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${run.account_id}`;
    let locked = false;
    try {
      const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) continue;
      locked = true;
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
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }
  return recovered;
}
