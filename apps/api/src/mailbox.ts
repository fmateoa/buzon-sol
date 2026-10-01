import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppError } from "@buzon-sol/domain";
import { AuthService, DB, type Principal } from "./auth";
import { validId } from "./identity";

type Query = Record<string, string | undefined>;
const boxes: Record<string, number> = { messages: 1, notifications: 2 };
const sortColumns: Record<string, string> = {
  publishedAt: "m.published_at", subject: "m.subject_text", sender: "m.sender_text", remoteState: "m.ind_estado",
  firstSeenAt: "m.first_seen_at",
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
// Content stored by an explicit read or by the account archive; listing it never opens a detail.
const hasContent = "EXISTS (SELECT 1 FROM mail_details d WHERE d.item_id=m.id AND d.account_id=m.account_id)";

/** Row metadata for one user. Parameters: the user id twice (opened-by-user, then the review join). */
const rowSelect = `SELECT m.id,m.tipo_msj AS tipoMsj,m.cod_mensaje AS codMensaje,m.ind_estado AS indEstado,
  m.subject_text AS subject,m.sender_text AS sender,m.published_at_text AS publishedAtText,
  m.published_at AS publishedAt,m.first_seen_at AS firstSeenAt,m.folder_code AS folderCode,m.label_code AS labelCode,
  l.name AS labelName,l.color AS labelColor,m.attachment_count AS attachmentCount,
  COALESCE(JSON_EXTRACT(m.row_json,'$.indDesta')=1,false) AS starred,COALESCE(JSON_EXTRACT(m.row_json,'$.indUrg')=1,false) AS urgent,
  COALESCE(r.reviewed,false) AS reviewed,r.reviewed_at AS reviewedAt,${hasContent} AS contentStored,
  (SELECT COUNT(*) FROM file_assets f WHERE f.item_id=m.id AND f.account_id=m.account_id AND f.state='stored') AS storedFiles,
  EXISTS (SELECT 1 FROM mail_read_events e WHERE e.item_id=m.id AND e.account_id=m.account_id AND e.actor_user_id=? AND e.status='complete') AS openedByUser`;
const rowSource = `FROM mail_items m
  LEFT JOIN mail_reviews r ON r.item_id=m.id AND r.user_id=?
  LEFT JOIN sunat_labels l ON l.account_id=m.account_id AND l.code=m.label_code`;

type Row = {
  id: string; tipoMsj: number; codMensaje: string; indEstado: number; subject: string | null;
  sender: string | null; publishedAtText: string | null; publishedAt: Date | null; firstSeenAt: Date; folderCode: string | null;
  labelCode: string | null; labelName: string | null; labelColor: string | null; attachmentCount: number | null; starred: number | string; urgent: number | string;
  reviewed: number | string; reviewedAt: Date | null; contentStored: number | string; storedFiles: number | string; openedByUser: number | string;
};

const toDto = (row: Row) => ({
  ...row, box: Number(row.tipoMsj) === 1 ? "messages" : "notifications",
  remoteState: Number(row.indEstado) === 0 ? "unread" : "read",
  publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
  firstSeenAt: new Date(row.firstSeenAt).toISOString(),
  reviewed: Number(row.reviewed) === 1, reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
  starred: Number(row.starred) === 1, urgent: Number(row.urgent) === 1,
  contentStored: Number(row.contentStored) === 1, storedFiles: Number(row.storedFiles),
  openedByUser: Number(row.openedByUser) === 1,
});

function pick(value: string | undefined, allowed: readonly string[], fallback: string): string {
  if (value === undefined || value === "") return fallback;
  if (!allowed.includes(value)) throw new AppError("validation");
  return value;
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new AppError("validation");
  return parsed;
}

/** A calendar day in America/Lima (UTC-05:00, no daylight saving) as the UTC instant where it starts. */
function limaDayStart(value: string): Date {
  if (!datePattern.test(value)) throw new AppError("validation");
  const date = new Date(`${value}T00:00:00-05:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError("validation");
  return date;
}

@Injectable()
export class MailboxService {
  constructor(@Inject(DB) private readonly db: DataSource, @Inject(AuthService) private readonly auth: AuthService) {}

  /**
   * Last successfully observed SUNAT catalog. `state` is the latest run's attempt (`ok`, `unavailable` or null when
   * the client does not provide it), so a stale catalog is never presented as fresh.
   */
  async catalog(actor: Principal, accountId: string, kind: "folders" | "labels") {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const accounts: { id: string }[] = await this.db.query("SELECT id FROM sunat_accounts WHERE id=?", [accountId]);
    if (!accounts.length) throw new AppError("not_found");
    const items: Record<string, unknown>[] = kind === "folders"
      ? await this.db.query(
        "SELECT code,name,message_count AS messageCount FROM sunat_folders WHERE account_id=? ORDER BY code", [accountId])
      : await this.db.query(
        "SELECT code,name,color,message_count AS messageCount FROM sunat_labels WHERE account_id=? ORDER BY code", [accountId]);
    const observed: { observedAt: Date | null }[] = await this.db.query(
      `SELECT MAX(observed_at) AS observedAt FROM ${kind === "folders" ? "sunat_folders" : "sunat_labels"} WHERE account_id=?`, [accountId]);
    const latest: { state: string | null }[] = await this.db.query(
      `SELECT ${kind === "folders" ? "folders_state" : "labels_state"} AS state FROM sync_runs
       WHERE account_id=? AND started_at IS NOT NULL ORDER BY started_at DESC,id DESC LIMIT 1`, [accountId]);
    return { accountId, items, observedAt: observed[0]?.observedAt ?? null, lastAttempt: latest[0]?.state ?? null };
  }

  /** Persisted metadata of one item; never contacts SUNAT or opens its detail. */
  async item(actor: Principal, accountId: string, itemId: string) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const rows: Row[] = await this.db.query(`${rowSelect} ${rowSource} WHERE m.account_id=? AND m.id=?`,
      [actor.id, actor.id, accountId, validId(itemId)]);
    if (!rows.length) throw new AppError("not_found");
    return toDto(rows[0]);
  }

  /** Persisted metadata only; this query never contacts SUNAT or opens a detail. */
  async list(actor: Principal, accountId: string, query: Query) {
    this.auth.requireAccount(actor, "view_mailbox", validId(accountId));
    const offset = integer(query.offset, 0, 0, 1_000_000);
    const limit = integer(query.limit, 100, 1, 200);
    const box = pick(query.box, ["all", "messages", "notifications"], "all");
    const state = pick(query.state, ["all", "unread", "read"], "all");
    const review = pick(query.review, ["all", "reviewed", "pending"], "all");
    const content = pick(query.content, ["all", "stored", "missing"], "all");
    const sort = pick(query.sort, Object.keys(sortColumns), "publishedAt");
    const direction = pick(query.direction, ["asc", "desc"], "desc");
    const text = query.q?.trim() ?? "";
    if (text.length > 200) throw new AppError("validation");
    const from = query.dateFrom ? limaDayStart(query.dateFrom) : null;
    const to = query.dateTo ? new Date(limaDayStart(query.dateTo).getTime() + 86_400_000) : null;
    if (from && to && from >= to) throw new AppError("validation");
    const seenAfter = query.seenAfter ? new Date(query.seenAfter) : null;
    if (seenAfter && Number.isNaN(seenAfter.getTime())) throw new AppError("validation");
    for (const value of [query.folder, query.label]) {
      if (value !== undefined && (value.length === 0 || value.length > 40)) throw new AppError("validation");
    }

    const accounts: { id: string }[] = await this.db.query("SELECT id FROM sunat_accounts WHERE id=?", [accountId]);
    if (!accounts.length) throw new AppError("not_found");
    const where = ["m.account_id=?"];
    const params: unknown[] = [actor.id, accountId];
    if (box !== "all") { where.push("m.tipo_msj=?"); params.push(boxes[box]); }
    // Only indEstado=0 is unread; any other observed value is shown as read, like the SUNAT web.
    if (state === "unread") where.push("m.ind_estado=0");
    if (state === "read") where.push("m.ind_estado<>0");
    if (review === "reviewed") where.push("COALESCE(r.reviewed,false)=true");
    if (review === "pending") where.push("COALESCE(r.reviewed,false)=false");
    if (content !== "all") where.push(`${content === "stored" ? "" : "NOT "}${hasContent}`);
    if (text) {
      where.push("(m.subject_text LIKE ? ESCAPE '!' OR m.sender_text LIKE ? ESCAPE '!')");
      const like = `%${text.replace(/[!%_]/g, "!$&")}%`;
      params.push(like, like);
    }
    if (from) { where.push("m.published_at>=?"); params.push(from); }
    if (to) { where.push("m.published_at<?"); params.push(to); }
    if (seenAfter) { where.push("m.first_seen_at>?"); params.push(seenAfter); }
    if (query.folder !== undefined) { where.push("m.folder_code=?"); params.push(query.folder); }
    if (query.label !== undefined) { where.push("m.label_code=?"); params.push(query.label); }

    const source = `${rowSource} WHERE ${where.join(" AND ")}`;
    const totals: { total: number }[] = await this.db.query(`SELECT COUNT(*) AS total ${source}`, params);
    // NULL dates sort last in both directions; the id keeps pages stable.
    const order = `${sortColumns[sort]} IS NULL, ${sortColumns[sort]} ${direction.toUpperCase()}, m.id ${direction.toUpperCase()}`;
    const rows: Row[] = await this.db.query(`${rowSelect} ${source} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [actor.id, ...params, limit, offset]);
    return { rows: rows.map(toDto), total: Number(totals[0]?.total ?? 0), offset, limit };
  }
}
