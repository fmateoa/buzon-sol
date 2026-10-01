import { randomUUID } from "node:crypto";
import { AppError, logEvent, nextRuns, validateSchedule } from "@buzon-sol/domain";
import { DataSource } from "typeorm";
import { runBoxes } from "./inventory.js";
import { noticeAdmins } from "./notices.js";

type Candidate = { account_id: string };
type Schedule = {
  id: string; state: string; next_run_at: Date | null; frequency: string;
  days_json: string | string[]; window_start: string; window_end: string;
  boxes_json: string | string[]; remote_effect_accepted: number;
};
export type EnqueueInventory = (accountId: string, runId: string) => Promise<void>;

const parseJson = (value: string | string[]): unknown => typeof value === "string" ? JSON.parse(value) : value;

/** One scheduler pass. An account row lock coordinates concurrent schedulers and manual starts. */
export async function dispatchDueSchedules(
  db: DataSource, enqueue: EnqueueInventory, now = new Date(), batchSize = 50,
): Promise<number> {
  if (process.env.SUNAT_CRON_VALIDATED !== "true") throw new AppError("remote_unavailable");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new AppError("validation");
  const candidates: Candidate[] = await db.query(
    `SELECT account_id FROM sync_schedules
     WHERE state='active' AND next_run_at IS NOT NULL AND next_run_at<=?
     ORDER BY next_run_at,account_id LIMIT ?`, [now, batchSize]);
  let dispatched = 0;
  for (const candidate of candidates) {
    const runId = await db.transaction(async (manager) => {
      const accounts: { active: number }[] = await manager.query(
        "SELECT active FROM sunat_accounts WHERE id=? FOR UPDATE", [candidate.account_id]);
      if (!accounts.length || !accounts[0].active) return null;
      const schedules: Schedule[] = await manager.query(
        "SELECT * FROM sync_schedules WHERE account_id=? FOR UPDATE", [candidate.account_id]);
      const schedule = schedules[0];
      if (!schedule || schedule.state !== "active" || !schedule.next_run_at || schedule.next_run_at > now) return null;
      const credential: { status: string }[] = await manager.query(
        "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [candidate.account_id]);
      if (credential[0]?.status !== "valid") {
        await manager.query(
          "UPDATE sync_schedules SET state='paused',pause_reason='needs_credential',next_run_at=NULL WHERE id=?",
          [schedule.id]);
        await noticeAdmins(manager, candidate.account_id, "needs_credential");
        return null;
      }
      // Until S-04 proves a passive start, logging in may mark the first item read; an admin must accept that.
      if (process.env.SUNAT_PASSIVE_START_VALIDATED !== "true" && !schedule.remote_effect_accepted) {
        await manager.query(
          "UPDATE sync_schedules SET state='paused',pause_reason='remote_effect_not_accepted',next_run_at=NULL WHERE id=?",
          [schedule.id]);
        await noticeAdmins(manager, candidate.account_id, "remote_effect_not_accepted");
        return null;
      }
      const input = validateSchedule({ frequency: schedule.frequency, days: parseJson(schedule.days_json),
        windowStart: String(schedule.window_start).slice(0, 5),
        windowEnd: String(schedule.window_end).slice(0, 5) });
      const next = nextRuns(input, now, 1)[0];
      if (!next) throw new AppError("validation");
      await manager.query("UPDATE sync_schedules SET next_run_at=? WHERE id=?", [next, schedule.id]);
      const active: { id: string }[] = await manager.query(
        "SELECT id FROM sync_runs WHERE account_id=? AND state IN ('pending','running') LIMIT 1", [candidate.account_id]);
      if (active.length) return null;
      const id = randomUUID();
      const boxes = runBoxes(schedule.boxes_json);
      await manager.query(
        "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page,boxes_json) VALUES (?,?,?,'pending',?,1,?)",
        [id, candidate.account_id, "scheduled", boxes[0] === "messages" ? 1 : 2, JSON.stringify(boxes)]);
      await manager.query(
        "INSERT INTO audit_events (id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?)",
        [randomUUID(), candidate.account_id, "schedule_due", "sync_run", id]);
      return id;
    });
    if (!runId) continue;
    try {
      await enqueue(candidate.account_id, runId);
      dispatched++;
    } catch {
      logEvent("error", "schedule_enqueue_failed", { accountId: candidate.account_id, runId });
      await db.transaction(async (manager) => {
        await manager.query(
          "UPDATE sync_runs SET state='partial',error_code='remote_unavailable' WHERE id=? AND state='pending'", [runId]);
        await manager.query(
          "UPDATE sync_schedules SET state='paused',pause_reason='queue_unavailable',next_run_at=NULL WHERE account_id=?",
          [candidate.account_id]);
        await noticeAdmins(manager, candidate.account_id, "queue_unavailable");
      });
    }
  }
  return dispatched;
}
