import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { DataSource } from "typeorm";
import { AppError, CONNECTION_QUEUE, redisApiOptions, type ConnectionJob } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

@Injectable()
export class ConnectionService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async request(actor: Principal, accountId: string): Promise<{ id: string; status: string }> {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    if (process.env.SUNAT_CONNECTION_CLIENT_READY !== "true") throw new AppError("remote_unavailable");
    const event = await this.db.transaction(async (manager) => {
      const accounts: { active: number }[] = await manager.query(
        "SELECT active FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      if (!accounts.length) throw new AppError("not_found");
      if (!accounts[0].active) throw new AppError("paused");
      const credentials: { id: string; status: string }[] = await manager.query(
        "SELECT id,status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      if (!credentials.length) throw new AppError("needs_credential");
      if (credentials[0].status === "rejected") throw new AppError("invalid_credential");
      const current: { id: string; status: string }[] = await manager.query(
        `SELECT id,status FROM connection_tests WHERE account_id=? AND credential_id=?
         AND status IN ('pending','testing') ORDER BY created_at DESC LIMIT 1`,
        [accountId, credentials[0].id]);
      if (current.length) return current[0];
      const id = randomUUID();
      await manager.query(
        "INSERT INTO connection_tests (id,account_id,credential_id,actor_user_id,status) VALUES (?,?,?,?,'pending')",
        [id, accountId, credentials[0].id, actor.id]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "test_connection", "connection_test", id]);
      return { id, status: "pending" };
    });
    const queue = new Queue<ConnectionJob>(CONNECTION_QUEUE, { connection: redisApiOptions() });
    try {
      await queue.add("connection", { accountId, testId: event.id },
        { jobId: event.id, attempts: 1, removeOnComplete: true, removeOnFail: true });
    } catch {
      await this.db.query(
        "UPDATE connection_tests SET status='failed',error_code='remote_unavailable',finished_at=UTC_TIMESTAMP(6) WHERE id=? AND status='pending'",
        [event.id]);
      throw new AppError("remote_unavailable");
    } finally {
      await queue.close();
    }
    return event;
  }

  async get(actor: Principal, accountId: string, testId: string) {
    this.auth.requirePermission(actor, "manage_accounts");
    validId(accountId);
    validId(testId);
    const rows: { id: string; status: string; errorCode: string | null; createdAt: Date; finishedAt: Date | null }[] =
      await this.db.query(
        `SELECT id,status,error_code AS errorCode,created_at AS createdAt,finished_at AS finishedAt
         FROM connection_tests WHERE id=? AND account_id=?`, [testId, accountId]);
    if (!rows.length) throw new AppError("not_found");
    return rows[0];
  }
}
