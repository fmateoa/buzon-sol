import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Queue } from "bullmq";
import { AppError, READ_QUEUE, redisApiOptions, type ReadJob } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

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
      await manager.query(
        "INSERT INTO audit_events (id,actor_user_id,account_id,action,object_type,object_id) VALUES (?,?,?,?,?,?)",
        [randomUUID(), actor.id, accountId, "read", "item", itemId],
      );
      return { id, status: "pending" };
    });
    if (event.status === "pending") {
      const queue = new Queue<ReadJob>(READ_QUEUE, { connection: redisApiOptions() });
      try {
        await queue.add("read", { accountId, eventId: event.id },
          { jobId: event.id, attempts: 1, removeOnComplete: true, removeOnFail: true });
      } catch {
        throw new AppError("remote_unavailable");
      } finally {
        await queue.close();
      }
    }
    return event;
  }

  async getDetail(actor: Principal, accountId: string, itemId: string) {
    this.auth.requireAccount(actor, "read_content", validId(accountId));
    validId(itemId);
    const rows: { safe_body: string; fetched_at: Date }[] = await this.db.query(
      "SELECT d.safe_body,d.fetched_at FROM mail_details d WHERE d.item_id=? AND d.account_id=?", [itemId, accountId]);
    if (!rows.length) throw new AppError("not_found");
    const files = await this.db.query(
      `SELECT id,kind,original_name AS name,mime_type AS mimeType,size_bytes AS sizeBytes,state
       FROM file_assets WHERE item_id=? AND account_id=? ORDER BY kind,position_index`, [itemId, accountId]);
    return { itemId, accountId, bodyHtml: rows[0].safe_body, fetchedAt: rows[0].fetched_at, files };
  }
}
