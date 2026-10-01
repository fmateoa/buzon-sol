import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { DataSource } from "typeorm";
import { AppError, INVENTORY_QUEUE, redisApiOptions, type InventoryJob } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

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
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "start", "sync_run", id],
      );
      return { id, state: "pending" };
    });
    if (run.state === "pending") await this.enqueue(accountId, run.id);
    return { id: run.id, state: run.state };
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
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "resume", "sync_run", runId],
      );
    });
    await this.enqueue(accountId, runId);
    return { id: runId, state: "pending" };
  }

  private async enqueue(accountId: string, runId: string): Promise<void> {
    const queue = new Queue<InventoryJob>(INVENTORY_QUEUE, { connection: redisApiOptions() });
    try {
      await queue.add("inventory", { accountId, runId }, { jobId: runId, attempts: 1,
        removeOnComplete: true, removeOnFail: true });
    } catch {
      await this.db.query("UPDATE sync_runs SET state='partial',error_code='remote_unavailable' WHERE id=? AND state='pending'", [runId]);
      throw new AppError("remote_unavailable");
    } finally {
      await queue.close();
    }
  }
}
