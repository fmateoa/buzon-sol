import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import { loadSolCredential, type SolCredential } from "./credentials.js";

export interface ConnectionClient {
  testConnection(): Promise<"valid" | "invalid">;
  close?(): Promise<void>;
}
export type ConnectionClientFactory = (credential: SolCredential) => ConnectionClient | Promise<ConnectionClient>;

export class ConnectionProcessor {
  constructor(private readonly db: DataSource, private readonly clientFactory: ConnectionClientFactory) {}

  async process(accountId: string, testId: string): Promise<void> {
    const lease = this.db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${accountId}`;
    let locked = false;
    let client: ConnectionClient | undefined;
    try {
      const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) throw new AppError("conflict_running");
      locked = true;
      const tests: { status: string; credential_id: string; actor_user_id: string; active: number }[] = await this.db.query(
        `SELECT t.status,t.credential_id,t.actor_user_id,a.active
         FROM connection_tests t JOIN sunat_accounts a ON a.id=t.account_id
         WHERE t.id=? AND t.account_id=?`, [testId, accountId]);
      const record = tests[0];
      if (!record) throw new AppError("not_found");
      if (["valid", "invalid", "failed", "denied", "superseded"].includes(record.status)) return;
      const current: { id: string }[] = await this.db.query(
        "SELECT id FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      if (current[0]?.id !== record.credential_id) {
        await this.finish(testId, "superseded", null);
        return;
      }
      const actor: { id: string }[] = await this.db.query(
        `SELECT u.id FROM app_users u JOIN roles r ON r.id=u.role_id
         JOIN role_permissions p ON p.role_id=r.id AND p.permission='manage_accounts'
         WHERE u.id=? AND u.status='active'`, [record.actor_user_id]);
      if (!record.active || !actor.length) {
        await this.finish(testId, "denied", "forbidden");
        return;
      }
      await this.db.query("UPDATE connection_tests SET status='testing' WHERE id=?", [testId]);
      try {
        const credential = await loadSolCredential(this.db, accountId);
        client = await this.clientFactory(credential);
        const result = await client.testConnection();
        if (result !== "valid" && result !== "invalid") throw new AppError("schema_changed");
        await this.db.transaction(async (manager) => {
          await manager.query("UPDATE sunat_credentials SET status=? WHERE id=? AND account_id=?",
            [result === "valid" ? "valid" : "rejected", record.credential_id, accountId]);
          if (result === "invalid") {
            await manager.query(
              "UPDATE sync_schedules SET state='paused',pause_reason='invalid_credential',next_run_at=NULL WHERE account_id=?",
              [accountId]);
            const admins: { id: string }[] = await manager.query(
              `SELECT DISTINCT u.id FROM app_users u JOIN roles r ON r.id=u.role_id
               JOIN role_permissions p ON p.role_id=r.id AND p.permission='manage_accounts'
               WHERE u.status='active' AND (r.all_accounts=true OR EXISTS
                 (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=?))`, [accountId]);
            for (const admin of admins) await manager.query(
              "INSERT INTO in_app_notices (id,account_id,user_id,kind) VALUES (?,?,?,?)",
              [randomUUID(), accountId, admin.id, "invalid_credential"]);
          }
          await manager.query(
            "UPDATE connection_tests SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
            [result, result === "invalid" ? "invalid_credential" : null, testId]);
          await manager.query(
            "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?,?)",
            [randomUUID(), record.actor_user_id, accountId, "test_connection_result", "connection_test", testId,
              JSON.stringify({ status: result })]);
        });
      } catch (error) {
        await this.finish(testId, "failed", error instanceof AppError ? error.code : "remote_unavailable");
        throw error;
      }
    } finally {
      try { await client?.close?.(); }
      catch { process.stderr.write("SUNAT session cleanup failed\n"); }
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }

  private async finish(testId: string, status: string, code: string | null): Promise<void> {
    await this.db.transaction(async (manager) => {
      const rows: { actor_user_id: string; account_id: string }[] = await manager.query(
        "SELECT actor_user_id,account_id FROM connection_tests WHERE id=?", [testId]);
      if (!rows.length) throw new AppError("not_found");
      await manager.query(
        "UPDATE connection_tests SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
        [status, code, testId]);
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id,change_json) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), rows[0].actor_user_id, rows[0].account_id,
          "test_connection_result", "connection_test", testId, JSON.stringify({ status, code })]);
    });
  }
}
