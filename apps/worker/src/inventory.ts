import { randomUUID } from "node:crypto";
import { AppError, type MailBox } from "@buzon-sol/domain";
import { scanBox, type InventoryClient, type ScanPage, type SunatRow } from "@buzon-sol/sunat-adapter";
import { DataSource, EntityManager } from "typeorm";

const boxCode: Record<MailBox, number> = { messages: 1, notifications: 2 };

export class InventoryRunner {
  constructor(private readonly db: DataSource, private readonly client: InventoryClient) {}

  async createRun(accountId: string, mode: "manual" | "test" = "manual"): Promise<string> {
    const rows: { active: number }[] = await this.db.query("SELECT active FROM sunat_accounts WHERE id=?", [accountId]);
    if (!rows.length) throw new AppError("not_found");
    if (!rows[0].active) throw new AppError("paused");
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page) VALUES (?,?,?,?,?,?)",
      [id, accountId, mode, "pending", 1, 1],
    );
    return id;
  }

  async run(accountId: string, runId: string, maxPages = 500): Promise<void> {
    // A connection-scoped MySQL lock survives page transactions and is released on process death.
    const lease = this.db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${accountId}`;
    let locked = false;
    try {
      const lock: { granted: number }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) throw new AppError("conflict_running");
      locked = true;
      const rows: { account_id: string; state: string; resume_box: number | null; resume_page: number | null; active: number }[] =
        await this.db.query(`SELECT r.account_id,r.state,r.resume_box,r.resume_page,a.active
          FROM sync_runs r JOIN sunat_accounts a ON a.id=r.account_id WHERE r.id=?`, [runId]);
      const run = rows[0];
      if (!run || run.account_id !== accountId) throw new AppError("not_found");
      if (!run.active) throw new AppError("paused");
      if (run.state === "complete") return;
      await this.db.query("UPDATE sync_runs SET state='running',error_code=NULL,started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?", [runId]);
      for (const box of ["messages", "notifications"] as const) {
        if (boxCode[box] < (run.resume_box ?? 3)) continue;
        const startPage = boxCode[box] === run.resume_box ? run.resume_page ?? 1 : 1;
        await scanBox(this.client, box, (page) => this.persistPage(accountId, runId, page), startPage, maxPages);
      }
      await this.db.query("UPDATE sunat_accounts SET sync_failure_streak=0 WHERE id=?", [accountId]);
    } catch (error) {
      const code = error instanceof AppError ? error.code : "remote_unavailable";
      if (locked && code !== "conflict_running") {
        await this.db.query("UPDATE sync_runs SET state='partial',error_code=? WHERE id=? AND account_id=? AND state='running'", [code, runId, accountId]);
        if (["invalid_credential", "remote_session_expired", "remote_unavailable", "schema_changed", "incomplete_inventory"].includes(code)) {
          await this.recordFailure(accountId, code);
        }
      }
      throw error;
    } finally {
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }

  private async recordFailure(accountId: string, code: string): Promise<void> {
    await this.db.transaction(async (manager) => {
      const previous: { sync_failure_streak: number }[] = await manager.query(
        "SELECT sync_failure_streak FROM sunat_accounts WHERE id=? FOR UPDATE", [accountId]);
      const before = Number(previous[0]?.sync_failure_streak ?? 0);
      const after = before + 1;
      await manager.query("UPDATE sunat_accounts SET sync_failure_streak=? WHERE id=?", [after, accountId]);
      const pause = code === "invalid_credential" || after >= 3;
      if (!pause) return;
      const reason = code === "invalid_credential" ? "invalid_credential" : "repeated_failures";
      if (code === "invalid_credential") {
        await manager.query("UPDATE sunat_credentials SET status='rejected' WHERE account_id=? ORDER BY version DESC LIMIT 1", [accountId]);
      }
      await manager.query("UPDATE sync_schedules SET state='paused',pause_reason=?,next_run_at=NULL WHERE account_id=?", [reason, accountId]);
      if ((code === "invalid_credential" && before !== 0) || (code !== "invalid_credential" && after !== 3)) return;
      const admins: { id: string }[] = await manager.query(
        `SELECT DISTINCT u.id FROM app_users u
         JOIN roles r ON r.id=u.role_id
         JOIN role_permissions p ON p.role_id=r.id AND p.permission='manage_accounts'
         WHERE u.status='active' AND (r.all_accounts=true OR EXISTS
           (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=?))`,
        [accountId],
      );
      for (const admin of admins) {
        await manager.query("INSERT INTO in_app_notices (id,account_id,user_id,kind) VALUES (?,?,?,?)",
          [randomUUID(), accountId, admin.id, reason]);
      }
    });
  }

  private async persistPage(accountId: string, runId: string, page: ScanPage): Promise<void> {
    await this.db.transaction(async (manager) => {
      const previous: { id: string }[] = await manager.query(
        "SELECT id FROM sync_pages WHERE run_id=? AND tipo_msj=? AND page_number=?",
        [runId, boxCode[page.box], page.page],
      );
      if (previous.length) return;
      const uniqueRows = await this.upsertRows(manager, accountId, page.box, page.rows);
      await manager.query(
        `INSERT INTO sync_pages
         (id,run_id,account_id,tipo_msj,page_number,rows_received,unique_rows,declared_records,declared_pages,confirmed_empty)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [randomUUID(), runId, accountId, boxCode[page.box], page.page, page.received,
          uniqueRows, page.declaredRecords, page.declaredPages, page.confirmedEmpty],
      );
      const nextBox = page.confirmedEmpty ? (page.box === "messages" ? 2 : null) : boxCode[page.box];
      const nextPage = page.confirmedEmpty ? (nextBox === null ? null : 1) : page.page + 1;
      await manager.query(
        `UPDATE sync_runs SET resume_box=?,resume_page=?,state=?,finished_at=? WHERE id=? AND account_id=?`,
        [nextBox, nextPage, nextBox === null ? "complete" : "running",
          nextBox === null ? new Date() : null, runId, accountId],
      );
    });
  }

  private async upsertRows(manager: EntityManager, accountId: string, box: MailBox, rows: SunatRow[]): Promise<number> {
    const byId = new Map(rows.map((row) => [row.codMensaje, row]));
    if (byId.size === 0) return 0;
    const ids = [...byId.keys()];
    const existing: { cod_mensaje: string }[] = await manager.query(
      `SELECT cod_mensaje FROM mail_items WHERE account_id=? AND tipo_msj=? AND cod_mensaje IN (${ids.map(() => "?").join(",")})`,
      [accountId, boxCode[box], ...ids],
    );
    const values: unknown[] = [];
    for (const row of byId.values()) {
      values.push(randomUUID(), accountId, boxCode[box], row.codMensaje, row.indEstado,
        typeof row.desAsunto === "string" ? row.desAsunto : null,
        typeof row.fecPublica === "string" ? row.fecPublica : null,
        JSON.stringify(row));
    }
    await manager.query(
      `INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,subject_text,published_at_text,row_json)
       VALUES ${ids.map(() => "(?,?,?,?,?,?,?,?)").join(",")}
       ON DUPLICATE KEY UPDATE ind_estado=VALUES(ind_estado),subject_text=VALUES(subject_text),
       published_at_text=VALUES(published_at_text),row_json=VALUES(row_json),last_seen_at=UTC_TIMESTAMP(6)`,
      values,
    );
    return ids.length - existing.length;
  }
}
