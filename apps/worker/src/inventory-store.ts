import { randomUUID } from "node:crypto";
import { parseSunatDateTime, type MailBox } from "@buzon-sol/domain";
import { type ScanPage, type SunatRow } from "@buzon-sol/sunat-adapter";
import { DataSource, EntityManager } from "typeorm";
import { noticeAdmins, noticeMailboxViewers } from "./notices.js";

/**
 * MySQL side of the inventory flow: page + checkpoint, catalogs and failure policy. Nothing here calls SUNAT, Redis
 * or S3; the use case (`inventory.ts`) decides when each step runs and under which lock.
 */
export const boxCode: Record<MailBox, number> = { messages: 1, notifications: 2 };
const text = (value: unknown, max: number): string | null =>
  typeof value === "string" || typeof value === "number" ? String(value).slice(0, max) : null;

export async function replaceCatalog(db: DataSource, table: "sunat_folders" | "sunat_labels", accountId: string,
  entries: [string, string, string | null, number | null][]): Promise<void> {
  await db.transaction(async (manager) => {
    await manager.query(`DELETE FROM ${table} WHERE account_id=?`, [accountId]);
    for (const [code, name, color, count] of entries) {
      if (table === "sunat_folders") await manager.query(
        "INSERT INTO sunat_folders (account_id,code,name,message_count) VALUES (?,?,?,?)", [accountId, code, name, count]);
      else await manager.query(
        "INSERT INTO sunat_labels (account_id,code,name,color,message_count) VALUES (?,?,?,?,?)", [accountId, code, name, color, count]);
    }
  });
}


export async function recordFailure(db: DataSource, accountId: string, code: string): Promise<void> {
  await db.transaction(async (manager) => {
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


/**
 * Stores one page and its checkpoint in one transaction. An incremental run ends the box at the first page whose rows
 * are all stored with the same remote state (`box_done`): the checkpoint then moves to the next box exactly as it does
 * after a confirmed empty page, so an interrupted run resumes in the right place.
 */
export type PageOutcome = "continue" | "box_done";

export async function persistPage(db: DataSource, accountId: string, runId: string, boxes: MailBox[], page: ScanPage,
  incremental = false): Promise<PageOutcome> {
  return db.transaction(async (manager) => {
    const previous: { id: string }[] = await manager.query(
      "SELECT id FROM sync_pages WHERE run_id=? AND tipo_msj=? AND page_number=?",
      [runId, boxCode[page.box], page.page],
    );
    if (previous.length) return "continue";
    const { fresh: uniqueRows, changed } = await upsertRows(manager, accountId, page.box, page.rows);
    const boxDone = page.confirmedEmpty || (incremental && page.rows.length > 0 && changed === 0);
    await manager.query(
      `INSERT INTO sync_pages
       (id,run_id,account_id,tipo_msj,page_number,rows_received,unique_rows,declared_records,declared_pages,confirmed_empty)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), runId, accountId, boxCode[page.box], page.page, page.received,
        uniqueRows, page.declaredRecords, page.declaredPages, page.confirmedEmpty],
    );
    const following = boxes[boxes.indexOf(page.box) + 1];
    const nextBox = boxDone ? (following ? boxCode[following] : null) : boxCode[page.box];
    const nextPage = boxDone ? (nextBox === null ? null : 1) : page.page + 1;
    await manager.query(
      `UPDATE sync_runs SET resume_box=?,resume_page=?,state=?,finished_at=IF(?,UTC_TIMESTAMP(6),NULL) WHERE id=? AND account_id=?`,
      [nextBox, nextPage, nextBox === null ? "complete" : "running", nextBox === null, runId, accountId],
    );
    if (nextBox === null) await recordNewItems(manager, accountId, runId, boxes);
    return boxDone && !page.confirmedEmpty ? "box_done" : "continue";
  });
}

/**
 * P-01 `detectado_desde_consulta_anterior`: rows first seen after the previous complete run. The first complete
 * run has no baseline and produces no notice; a partial run never redefines the baseline.
 */
async function recordNewItems(manager: EntityManager, accountId: string, runId: string, boxes: MailBox[]): Promise<void> {
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

/** `fresh`: rows never seen; `changed`: fresh rows plus stored rows whose remote state (`indEstado`) differs. */
async function upsertRows(manager: EntityManager, accountId: string, box: MailBox, rows: SunatRow[]): Promise<{ fresh: number; changed: number }> {
  const byId = new Map(rows.map((row) => [row.codMensaje, row]));
  if (byId.size === 0) return { fresh: 0, changed: 0 };
  const ids = [...byId.keys()];
  const existing: { cod_mensaje: string; ind_estado: number }[] = await manager.query(
    `SELECT cod_mensaje,ind_estado FROM mail_items WHERE account_id=? AND tipo_msj=? AND cod_mensaje IN (${ids.map(() => "?").join(",")})`,
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
  const fresh = ids.length - existing.length;
  const drifted = existing.filter((stored) => Number(byId.get(stored.cod_mensaje)?.indEstado) !== Number(stored.ind_estado)).length;
  return { fresh, changed: fresh + drifted };
}
