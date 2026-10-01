import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { addJob } from "../common/job-queue";
import { AppError, READ_QUEUE, renderStructuredBody, type ReadJob } from "@buzon-sol/domain";
import { DB } from "../common/tokens";
import { recordAudit } from "../common/audit";
import { AuthService, type Principal } from "../auth/auth";
import { validId } from "../common/ids";

@Injectable()
export class ReadingService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  async requestRead(actor: Principal, accountId: string, itemId: string, key: unknown) {
    this.auth.requireAccount(actor, "read_content", validId(accountId));
    if (process.env.SUNAT_READ_VALIDATED !== "true") throw new AppError("remote_unavailable");
    validId(itemId);
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new AppError("validation");
    const event = await this.db.transaction(async (manager) => {
      const items: { id: string; ind_estado: number }[] = await manager.query(
        "SELECT id,ind_estado FROM mail_items WHERE id=? AND account_id=? FOR UPDATE", [itemId, accountId]);
      if (!items.length) throw new AppError("not_found");
      const previous: { id: string; status: string }[] = await manager.query(
        "SELECT id,status FROM mail_read_events WHERE item_id=? AND idempotency_key=?", [itemId, key]);
      if (previous.length) return { id: previous[0].id, status: previous[0].status };
      const id = randomUUID();
      await manager.query(
        `INSERT INTO mail_read_events
         (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before)
         VALUES (?,?,?,?,?,'pending',?)`,
        [id, itemId, accountId, actor.id, key, items[0].ind_estado],
      );
      await recordAudit(manager, { actorId: actor.id, accountId, action: "read", objectType: "item", objectId: itemId });
      return { id, status: "pending" };
    });
    if (event.status === "pending") {
      try {
        await addJob<ReadJob>(READ_QUEUE, "read", { accountId, eventId: event.id },
          // Retries only cover a busy account lock: the processor never repeats a remote call for one event.
          { jobId: event.id, attempts: 36, backoff: { type: "fixed", delay: 5_000 }, removeOnComplete: true, removeOnFail: true });
      } catch {
        // The event stays `pending`: the next request with the same key queues it again.
        throw new AppError("remote_unavailable");
      }
    }
    return event;
  }

  /** Progress of one explicit read; the body itself is served by `getDetail` once it is `complete`. */
  async readStatus(actor: Principal, accountId: string, itemId: string, eventId: string) {
    this.auth.requireAccount(actor, "read_content", validId(accountId));
    const rows: { id: string; status: string; remoteBefore: number | null; remoteAfter: number | null; updateLeido: number | null }[] =
      await this.db.query(
        `SELECT id,status,remote_before AS remoteBefore,remote_after AS remoteAfter,update_leido AS updateLeido
         FROM mail_read_events WHERE id=? AND item_id=? AND account_id=?`, [validId(eventId), validId(itemId), accountId]);
    if (!rows.length) throw new AppError("not_found");
    return { ...rows[0], updateLeido: rows[0].updateLeido === null ? null : Number(rows[0].updateLeido) === 1 };
  }

  async getDetail(actor: Principal, accountId: string, itemId: string) {
    this.auth.requireAccount(actor, "read_content", validId(accountId));
    validId(itemId);
    const rows: { safe_body: string; original_body: string | null; ind_texto: string | null; fetched_at: Date }[] = await this.db.query(
      "SELECT d.safe_body,d.original_body,d.ind_texto,d.fetched_at FROM mail_details d WHERE d.item_id=? AND d.account_id=?", [itemId, accountId]);
    if (!rows.length) throw new AppError("not_found");
    const files = await this.db.query(
      `SELECT id,kind,original_name AS name,mime_type AS mimeType,size_bytes AS sizeBytes,state
       FROM file_assets WHERE item_id=? AND account_id=? ORDER BY kind,position_index`, [itemId, accountId]);
    // A JSON body is rendered from the stored original, so details saved before a rendering change read the same way.
    const structured = rows[0].ind_texto === "3" && rows[0].original_body ? renderStructuredBody(rows[0].original_body) : null;
    return { itemId, accountId, bodyHtml: structured ?? rows[0].safe_body, fetchedAt: rows[0].fetched_at, files };
  }
}
