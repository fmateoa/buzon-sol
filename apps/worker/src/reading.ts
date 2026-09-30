import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import sanitizeHtml from "sanitize-html";
import { AppError, type MailBox } from "@buzon-sol/domain";

export interface ReadClient {
  readDetail(box: MailBox, codMensaje: string): Promise<{
    body: string;
    updateLeido: boolean | null;
    files?: { kind: "attachment" | "generated_document"; codArchivo: number | string | null;
      numId?: string | null; name?: string | null }[];
  }>;
  observeState(box: MailBox, codMensaje: string): Promise<number | null>;
  close?(): Promise<void>;
}

export class ReadProcessor {
  constructor(private readonly db: DataSource, private readonly client: ReadClient) {}

  /** A pending event is durable before this method can contact SUNAT. */
  async process(accountId: string, eventId: string): Promise<void> {
    const lease = this.db.createQueryRunner();
    await lease.connect();
    const lockName = `buzon:${accountId}`;
    let locked = false;
    try {
      const lock: { granted: number | string }[] = await lease.query("SELECT GET_LOCK(?,0) AS granted", [lockName]);
      if (Number(lock[0]?.granted) !== 1) throw new AppError("conflict_running");
      locked = true;
      const rows: { id: string; status: string; item_id: string; actor_user_id: string | null; tipo_msj: number; cod_mensaje: string; ind_estado: number }[] =
        await this.db.query(`SELECT e.id,e.status,e.item_id,e.actor_user_id,i.tipo_msj,i.cod_mensaje,i.ind_estado
          FROM mail_read_events e JOIN mail_items i ON i.id=e.item_id AND i.account_id=e.account_id
          WHERE e.id=? AND e.account_id=?`, [eventId, accountId]);
      const event = rows[0];
      if (!event) throw new AppError("not_found");
      if (["complete", "failed", "uncertain", "denied"].includes(event.status)) return;
      if (event.status === "calling") {
        // A previous process may have reached SUNAT. Reopening could repeat an irreversible read.
        await this.db.query("UPDATE mail_read_events SET status='uncertain',finished_at=UTC_TIMESTAMP(6) WHERE id=?", [eventId]);
        return;
      }
      const authorized: { id: string }[] = event.actor_user_id ? await this.db.query(
        `SELECT u.id FROM app_users u JOIN roles r ON r.id=u.role_id
         JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission='read_content'
         WHERE u.id=? AND u.status='active' AND
           (r.all_accounts=true OR EXISTS
             (SELECT 1 FROM role_sunat_accounts ra WHERE ra.role_id=r.id AND ra.account_id=?))`,
        [event.actor_user_id, accountId]) : [];
      if (!authorized.length) {
        await this.db.query("UPDATE mail_read_events SET status='denied',finished_at=UTC_TIMESTAMP(6) WHERE id=?", [eventId]);
        throw new AppError("forbidden");
      }
      await this.db.query("UPDATE mail_read_events SET status='calling' WHERE id=? AND status='pending'", [eventId]);
      const box: MailBox = event.tipo_msj === 1 ? "messages" : "notifications";
      try {
        const detail = await this.client.readDetail(box, event.cod_mensaje);
        const safeBody = sanitizeHtml(detail.body, {
          allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "a", "div", "span"],
          allowedAttributes: {},
        });
        let observed: number | null = null;
        try { observed = await this.client.observeState(box, event.cod_mensaje); }
        catch { /* The remote transition is unconfirmed; preserve the fetched body. */ }
        await this.db.transaction(async (manager) => {
          await manager.query(
            `INSERT INTO mail_details (item_id,account_id,original_body,safe_body)
             VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE original_body=VALUES(original_body),safe_body=VALUES(safe_body),fetched_at=UTC_TIMESTAMP(6)`,
            [event.item_id, accountId, detail.body, safeBody],
          );
          for (const [position, file] of (detail.files ?? []).entries()) {
            await manager.query(
              `INSERT INTO file_assets
               (id,item_id,account_id,kind,position_index,cod_archivo,num_id,original_name,state)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE cod_archivo=VALUES(cod_archivo),num_id=VALUES(num_id),original_name=VALUES(original_name)`,
              [randomUUID(), event.item_id, accountId, file.kind, position,
                file.codArchivo === null ? null : String(file.codArchivo), file.numId ?? null,
                file.name ?? null, "available"],
            );
          }
          if (observed !== null) await manager.query(
            "UPDATE mail_items SET ind_estado=? WHERE id=? AND account_id=?", [observed, event.item_id, accountId]);
          await manager.query(
            "UPDATE mail_read_events SET status='complete',remote_after=?,update_leido=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",
            [observed, detail.updateLeido, eventId],
          );
        });
      } catch (error) {
        await this.db.query("UPDATE mail_read_events SET status='uncertain',finished_at=UTC_TIMESTAMP(6) WHERE id=?", [eventId]);
        throw error;
      }
    } finally {
      if (locked) await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
      await lease.release();
    }
  }
}
