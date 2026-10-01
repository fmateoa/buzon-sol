import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { logEvent } from "@buzon-sol/domain";
import { type EnqueueInventory } from "./scheduler.js";

/**
 * Initial load of an account: the first full walk of both boxes, started by the system as soon as the credential is
 * proven valid, so nobody has to remember to press a button. It runs in the background; the mailbox screens read
 * what is already stored while it goes on. An account that never completed a full pass either resumes its unfinished
 * full run at the stored checkpoint or gets a new one; an account that has one is left to its schedule.
 *
 * Phase 1 is a MySQL transaction under the account row lock (the same lock `start` and the scheduler take, so two
 * triggers cannot create two runs); phase 2 enqueues. A failed enqueue leaves the run `partial`, resumable by hand.
 */
export async function planInitialLoad(db: DataSource, accountId: string, enqueue: EnqueueInventory): Promise<string | null> {
  if (process.env.SUNAT_TRANSPORT_VALIDATED !== "true") return null;
  const claimed = await db.transaction(async (manager): Promise<{ runId: string; resumed: boolean } | null> => {
    const accounts: { active: number }[] = await manager.query("SELECT active FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
    if (!accounts.length || !accounts[0].active) return null;
    const credential: { status: string }[] = await manager.query(
      "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
    if (credential[0]?.status !== "valid") return null;
    const done: unknown[] = await manager.query(
      "SELECT 1 AS ok FROM sync_runs WHERE account_id=? AND state='complete' AND scan_kind='full' LIMIT 1", [accountId]);
    if (done.length) return null;
    const active: unknown[] = await manager.query(
      "SELECT 1 AS ok FROM sync_runs WHERE account_id=? AND state IN ('pending','running') LIMIT 1", [accountId]);
    if (active.length) return null;
    const unfinished: { id: string }[] = await manager.query(
      `SELECT id FROM sync_runs WHERE account_id=? AND state='partial' AND scan_kind='full'
       ORDER BY COALESCE(started_at,'9999-12-31') DESC,id DESC LIMIT 1`, [accountId]);
    if (unfinished.length) {
      await manager.query("UPDATE sync_runs SET state='pending',error_code=NULL WHERE id=? AND account_id=?", [unfinished[0].id, accountId]);
      return { runId: unfinished[0].id, resumed: true };
    }
    const runId = randomUUID();
    await manager.query(
      "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page,boxes_json,scan_kind) VALUES (?,?,'initial','pending',1,1,?,'full')",
      [runId, accountId, JSON.stringify(["messages", "notifications"])]);
    await manager.query(
      "INSERT INTO audit_events (id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?)",
      [randomUUID(), accountId, "initial_load", "sync_run", runId]);
    return { runId, resumed: false };
  });
  if (!claimed) return null;
  try {
    await enqueue(accountId, claimed.runId);
  } catch {
    logEvent("error", "initial_load_enqueue_failed", { accountId, runId: claimed.runId });
    await db.query("UPDATE sync_runs SET state='partial',error_code='remote_unavailable' WHERE id=? AND state='pending'", [claimed.runId]);
    return null;
  }
  logEvent("info", "initial_load_planned", { accountId, runId: claimed.runId, resumed: claimed.resumed });
  return claimed.runId;
}
