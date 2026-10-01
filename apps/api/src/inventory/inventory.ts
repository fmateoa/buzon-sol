import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { addJob } from "../common/job-queue";
import { DataSource } from "typeorm";
import { AppError, INVENTORY_QUEUE, type InventoryJob } from "@buzon-sol/domain";
import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { AuthService, type Principal } from "../auth/auth";
import { validId } from "../common/ids";

@Injectable()
export class InventoryService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  private requireGate(): void {
    if (process.env.SUNAT_TRANSPORT_VALIDATED !== "true") throw new AppError("remote_unavailable");
  }

  async start(actor: Principal, accountId: string): Promise<{ id: string; state: string }> {
    this.auth.requireAccount(actor, "run_inventory", validId(accountId));
    this.requireGate();
    const run = await this.db.transaction(async (manager) => {
      const accounts: { active: number }[] = await manager.query("SELECT active FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active) throw new AppError("paused");
      const credentials: { status: string }[] = await manager.query(
        "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      if (!credentials.length) throw new AppError("needs_credential");
      if (credentials[0].status !== "valid") throw new AppError("invalid_credential");
      const existing: { id: string; state: string }[] = await manager.query(
        "SELECT id,state FROM sync_runs WHERE account_id=? AND state IN ('pending','running') ORDER BY started_at DESC LIMIT 1", [accountId]);
      if (existing.length) return existing[0];
      const id = randomUUID();
      await manager.query(
        // A manual run covers both boxes; scheduled runs use the configured boxes.
        "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page,boxes_json) VALUES (?,?,?,?,?,?,?)",
        [id, accountId, "manual", "pending", 1, 1, JSON.stringify(["messages", "notifications"])],
      );
      await recordAudit(manager, { actorId: actor.id, accountId, action: "start", objectType: "sync_run", objectId: id });
      return { id, state: "pending" };
    });
    if (run.state === "pending") await this.enqueue(accountId, run.id);
    return { id: run.id, state: run.state };
  }

  /**
   * One inventory per active account the actor may run: each company gets its own run, session and result.
   * An account that cannot start (no credential, rejected credential, queue down) reports its code and never
   * blocks the others.
   */
  async startAll(actor: Principal): Promise<{ accountId: string; runId: string | null; state: string | null; code: string | null }[]> {
    this.auth.requirePermission(actor, "run_inventory");
    this.requireGate();
    const accounts: { id: string }[] = await this.db.query(
      `SELECT a.id FROM sunat_accounts a WHERE a.active=true AND (?=true OR EXISTS
         (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=? AND ra.account_id=a.id)) ORDER BY a.alias,a.id`,
      [actor.allAccounts, actor.roleId]);
    const results = [];
    for (const account of accounts) {
      try {
        const run = await this.start(actor, account.id);
        results.push({ accountId: account.id, runId: run.id, state: run.state, code: null });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        results.push({ accountId: account.id, runId: null, state: null, code: error.code });
      }
    }
    return results;
  }

  async resume(actor: Principal, accountId: string, runId: string): Promise<{ id: string; state: "pending" }> {
    this.auth.requireAccount(actor, "run_inventory", validId(accountId));
    validId(runId);
    this.requireGate();
    await this.db.transaction(async (manager) => {
      // Match start() lock order and serialize competing runs for the account.
      const accounts: { active: number }[] = await manager.query(
        "SELECT active FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active) throw new AppError("paused");
      const runs: { state: string }[] = await manager.query(
        "SELECT state FROM sync_runs WHERE id=? AND account_id=? FOR UPDATE", [runId, accountId]);
      if (!runs.length) throw new AppError("not_found");
      if (runs[0].state !== "partial" && runs[0].state !== "paused") throw new AppError("conflict_running");
      const competing: { id: string }[] = await manager.query(
        "SELECT id FROM sync_runs WHERE account_id=? AND id<>? AND state IN ('pending','running') LIMIT 1",
        [accountId, runId]);
      if (competing.length) throw new AppError("conflict_running");
      const credentials: { status: string }[] = await manager.query(
        "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      if (!credentials.length) throw new AppError("needs_credential");
      if (credentials[0].status !== "valid") throw new AppError("invalid_credential");
      await manager.query("UPDATE sync_runs SET state='pending',error_code=NULL WHERE id=?", [runId]);
      await recordAudit(manager, { actorId: actor.id, accountId, action: "resume", objectType: "sync_run", objectId: runId });
    });
    await this.enqueue(accountId, runId);
    return { id: runId, state: "pending" };
  }

  private async enqueue(accountId: string, runId: string): Promise<void> {
    try {
      await addJob<InventoryJob>(INVENTORY_QUEUE, "inventory", { accountId, runId },
        { jobId: runId, attempts: 1, removeOnComplete: true, removeOnFail: true });
    } catch {
      await this.db.query("UPDATE sync_runs SET state='partial',error_code='remote_unavailable' WHERE id=? AND state='pending'", [runId]);
      throw new AppError("remote_unavailable");
    }
  }
}
