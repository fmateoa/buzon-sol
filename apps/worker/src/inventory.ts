import { randomUUID } from "node:crypto";
import { AppError, logEvent, parseSunatDateTime, type MailBox } from "@buzon-sol/domain";
import {
  parseAlerts, parseFolders, parseLabels, scanBox,
  type InventoryClient, type ScanPage, type SunatRow,
} from "@buzon-sol/sunat-adapter";
import { DataSource, EntityManager } from "typeorm";
import { noticeAdmins, noticeMailboxViewers } from "./notices.js";

const boxCode: Record<MailBox, number> = { messages: 1, notifications: 2 };
const ALL_BOXES: MailBox[] = ["messages", "notifications"];
const text = (value: unknown, max: number): string | null =>
  typeof value === "string" || typeof value === "number" ? String(value).slice(0, max) : null;

/** Normalizes a configured box list to SUNAT order; an empty or unknown list is rejected. */
export function runBoxes(value: unknown): MailBox[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value ?? ALL_BOXES;
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every((box) => box === "messages" || box === "notifications")) {
    throw new AppError("validation");
  }
  return ALL_BOXES.filter((box) => parsed.includes(box));
}

type RunRow = {
  account_id: string; state: string; resume_box: number | null; resume_page: number | null;
  active: number; boxes_json: string | MailBox[] | null;
};

export class InventoryRunner {
  constructor(private readonly db: DataSource, private readonly client: InventoryClient) {}

  async createRun(accountId: string, mode: "manual" | "test" = "manual", boxes: MailBox[] = ALL_BOXES): Promise<string> {
    const scope = runBoxes(boxes);
    const rows: { active: number }[] = await this.db.query("SELECT active FROM sunat_accounts WHERE id=?", [accountId]);
    if (!rows.length) throw new AppError("not_found");
    if (!rows[0].active) throw new AppError("paused");
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page,boxes_json) VALUES (?,?,?,?,?,?,?)",
      [id, accountId, mode, "pending", boxCode[scope[0]], 1, JSON.stringify(scope)],
    );
    return id;
  }

  async run(accountId: string, runId: string, maxPages = 500, maxReauth = 2): Promise<void> {
    // A connection-scoped MySQL lock survives page transactions and is released on process death.
    const lease = this.db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${accountId}`;
    const startedAt = Date.now();
    let locked = false;
    let reauths = 0;
    try {
      const lock: { granted: number }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) throw new AppError("conflict_running");
      locked = true;
      const rows: RunRow[] = await this.db.query(`SELECT r.account_id,r.state,r.resume_box,r.resume_page,r.boxes_json,a.active
        FROM sync_runs r JOIN sunat_accounts a ON a.id=r.account_id WHERE r.id=?`, [runId]);
      const run = rows[0];
      if (!run || run.account_id !== accountId) throw new AppError("not_found");
      if (!run.active) throw new AppError("paused");
      if (run.state === "complete") return;
      const boxes = runBoxes(run.boxes_json);
      await this.db.query("UPDATE sync_runs SET state='running',error_code=NULL,started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?", [runId]);
      await this.refreshAuxiliary(accountId, runId);
      for (;;) {
        try {
          await this.scan(accountId, runId, boxes, maxPages);
          break;
        } catch (error) {
          // A bounded number of fresh sessions; the checkpoint makes the retry continue at the pending page.
          if (!(error instanceof AppError) || error.code !== "remote_session_expired" ||
              !this.client.reauthenticate || reauths >= maxReauth) throw error;
          reauths++;
          await this.db.query("UPDATE sync_runs SET reauth_count=reauth_count+1 WHERE id=?", [runId]);
          await this.client.reauthenticate();
        }
      }
      await this.db.query("UPDATE sunat_accounts SET sync_failure_streak=0 WHERE id=?", [accountId]);
      await this.logFinished(accountId, runId, startedAt, reauths, null);
    } catch (error) {
      const code = error instanceof AppError ? error.code : "remote_unavailable";
      if (locked && code !== "conflict_running") {
        await this.db.query("UPDATE sync_runs SET state='partial',error_code=? WHERE id=? AND account_id=? AND state='running'", [code, runId, accountId]);
        if (["invalid_credential", "remote_session_expired", "remote_unavailable", "schema_changed", "incomplete_inventory"].includes(code)) {
          await this.recordFailure(accountId, code);
        }
        await this.logFinished(accountId, runId, startedAt, reauths, code);
      }
      throw error;
    } finally {
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }

  private async scan(accountId: string, runId: string, boxes: MailBox[], maxPages: number): Promise<void> {
    const rows: { resume_box: number | null; resume_page: number | null }[] = await this.db.query(
      "SELECT resume_box,resume_page FROM sync_runs WHERE id=?", [runId]);
    const resumeBox = rows[0]?.resume_box;
    if (resumeBox == null) return;
    for (const box of boxes) {
      if (boxCode[box] < resumeBox) continue;
      const startPage = boxCode[box] === resumeBox ? rows[0].resume_page ?? 1 : 1;
      await scanBox(this.client, box, (page) => this.persistPage(accountId, runId, boxes, page), startPage, maxPages);
    }
  }

  /**
   * Folders, labels and alerts are auxiliary (S-09–S-12): each failure is recorded as `unavailable`
   * and never stops or empties the inventory. Catalogs are replaced only by a successfully parsed response.
   */
  private async refreshAuxiliary(accountId: string, runId: string): Promise<void> {
    const client = this.client;
    const step = async (column: string, fetch: (() => Promise<void>) | null) => {
      if (!fetch) return;
      let state = "ok";
      try { await fetch(); }
      catch { state = "unavailable"; }
      await this.db.query(`UPDATE sync_runs SET ${column}=? WHERE id=?`, [state, runId]);
    };
    await step("folders_state", client.listFolders ? async () => {
      const folders = parseFolders(await client.listFolders!());
      await this.replaceCatalog("sunat_folders", accountId, folders.map((folder) =>
        [folder.code, folder.name, null, folder.messageCount]));
    } : null);
    await step("labels_state", client.visorHtml ? async () => {
      const labels = parseLabels(await client.visorHtml!());
      await this.replaceCatalog("sunat_labels", accountId, labels.map((label) =>
        [label.code, label.name, label.color, label.messageCount]));
    } : null);
    await step("alerts_state", client.consultAlerts ? async () => {
      const { alerts } = parseAlerts(await client.consultAlerts!());
      await this.db.query("UPDATE sync_runs SET alerts_json=? WHERE id=?", [JSON.stringify(alerts), runId]);
    } : null);
  }

  private async replaceCatalog(table: "sunat_folders" | "sunat_labels", accountId: string,
    entries: [string, string, string | null, number | null][]): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query(`DELETE FROM ${table} WHERE account_id=?`, [accountId]);
      for (const [code, name, color, count] of entries) {
        if (table === "sunat_folders") await manager.query(
          "INSERT INTO sunat_folders (account_id,code,name,message_count) VALUES (?,?,?,?)", [accountId, code, name, count]);
        else await manager.query(
          "INSERT INTO sunat_labels (account_id,code,name,color,message_count) VALUES (?,?,?,?,?)", [accountId, code, name, color, count]);
      }
    });
  }

  private async logFinished(accountId: string, runId: string, startedAt: number, reauths: number, errorCode: string | null): Promise<void> {
    const pages: { pages: number; received: number | null; unique_rows: number | null }[] = await this.db.query(
      "SELECT COUNT(*) AS pages,SUM(rows_received) AS received,SUM(unique_rows) AS unique_rows FROM sync_pages WHERE run_id=?", [runId]);
    logEvent(errorCode ? "warn" : "info", "inventory_run_finished", {
      accountId, runId, runState: errorCode ? "partial" : "complete", errorCode, durationMs: Date.now() - startedAt,
      pages: Number(pages[0]?.pages ?? 0), rowsReceived: Number(pages[0]?.received ?? 0),
      newRows: Number(pages[0]?.unique_rows ?? 0), reauths,
    });
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
      await noticeAdmins(manager, accountId, reason);
    });
  }

  private async persistPage(accountId: string, runId: string, boxes: MailBox[], page: ScanPage): Promise<void> {
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
      const following = boxes[boxes.indexOf(page.box) + 1];
      const nextBox = page.confirmedEmpty ? (following ? boxCode[following] : null) : boxCode[page.box];
      const nextPage = page.confirmedEmpty ? (nextBox === null ? null : 1) : page.page + 1;
      await manager.query(
        `UPDATE sync_runs SET resume_box=?,resume_page=?,state=?,finished_at=IF(?,UTC_TIMESTAMP(6),NULL) WHERE id=? AND account_id=?`,
        [nextBox, nextPage, nextBox === null ? "complete" : "running", nextBox === null, runId, accountId],
      );
      if (nextBox === null) await this.recordNewItems(manager, accountId, runId, boxes);
    });
  }

  /**
   * P-01 `detectado_desde_consulta_anterior`: rows first seen after the previous complete run. The first complete
   * run has no baseline and produces no notice; a partial run never redefines the baseline.
   */
  private async recordNewItems(manager: EntityManager, accountId: string, runId: string, boxes: MailBox[]): Promise<void> {
    const baseline: { finished_at: Date }[] = await manager.query(
      `SELECT finished_at FROM sync_runs WHERE account_id=? AND state='complete' AND id<>? AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`, [accountId, runId]);
    if (!baseline.length) return;
    const counts: { tipo_msj: number; n: number }[] = await manager.query(
      "SELECT tipo_msj,COUNT(*) AS n FROM mail_items WHERE account_id=? AND first_seen_at>? GROUP BY tipo_msj",
      [accountId, baseline[0].finished_at]);
    const count = (box: MailBox) => boxes.includes(box)
      ? Number(counts.find((row) => Number(row.tipo_msj) === boxCode[box])?.n ?? 0) : null;
    const messages = count("messages"), notifications = count("notifications");
    await manager.query("UPDATE sync_runs SET new_messages=?,new_notifications=? WHERE id=?", [messages, notifications, runId]);
    if (!(messages ?? 0) && !(notifications ?? 0)) return;
    const schedule: { notify_in_app: number }[] = await manager.query(
      "SELECT notify_in_app FROM sync_schedules WHERE account_id=?", [accountId]);
    if (schedule.length && !schedule[0].notify_in_app) return;
    await noticeMailboxViewers(manager, accountId, "new_mail", { runId, messages: messages ?? 0, notifications: notifications ?? 0 });
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
        parseSunatDateTime(row.fecPublica), text(row.codUsremisor, 160), text(row.codCarpeta, 40),
        text(row.codEtiqueta, 40), Number.isInteger(row.cantidadArchAdj) ? row.cantidadArchAdj : null,
        JSON.stringify(row));
    }
    await manager.query(
      `INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,subject_text,published_at_text,
         published_at,sender_text,folder_code,label_code,attachment_count,row_json,first_seen_at,last_seen_at)
       VALUES ${ids.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))").join(",")}
       ON DUPLICATE KEY UPDATE ind_estado=VALUES(ind_estado),subject_text=VALUES(subject_text),
       published_at_text=VALUES(published_at_text),published_at=VALUES(published_at),
       sender_text=VALUES(sender_text),folder_code=VALUES(folder_code),label_code=VALUES(label_code),
       attachment_count=VALUES(attachment_count),row_json=VALUES(row_json),last_seen_at=UTC_TIMESTAMP(6)`,
      values,
    );
    return ids.length - existing.length;
  }
}
