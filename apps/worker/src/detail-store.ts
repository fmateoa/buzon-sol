import { randomUUID } from "node:crypto";
import { EntityManager } from "typeorm";
import sanitizeHtml from "sanitize-html";
import { renderStructuredBody } from "@buzon-sol/domain";

export interface DetailFile {
  kind: "attachment" | "generated_document";
  codArchivo: number | string | null;
  numId?: string | null;
  name?: string | null;
  /** Size SUNAT announces for the file (`cntTamarch`); replaced by the real size once stored. */
  sizeBytes?: number | null;
}
export interface DetailContent {
  body: string;
  indTexto?: string | null;
  files?: DetailFile[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;" })[char]!);
}

/** `indTexto` 3 is a JSON object shown as a table, 1 (or absent) is HTML; any other observed value is plain text. */
export function safeBody(detail: DetailContent): string {
  if (detail.indTexto === "3") return renderStructuredBody(detail.body) ?? `<p>${escapeHtml(detail.body)}</p>`;
  if (detail.indTexto && detail.indTexto !== "1") return `<p>${escapeHtml(detail.body)}</p>`;
  return sanitizeHtml(detail.body, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "a", "div", "span"],
    allowedAttributes: {},
  });
}

/** Stores the original and the sanitized body plus the file references the detail announced. */
export async function storeDetail(manager: EntityManager, accountId: string, itemId: string, detail: DetailContent): Promise<void> {
  await manager.query(
    `INSERT INTO mail_details (item_id,account_id,original_body,safe_body,ind_texto)
     VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE original_body=VALUES(original_body),safe_body=VALUES(safe_body),
       ind_texto=VALUES(ind_texto),fetched_at=UTC_TIMESTAMP(6)`,
    [itemId, accountId, detail.body, safeBody(detail), detail.indTexto ?? null],
  );
  for (const [position, file] of (detail.files ?? []).entries()) {
    await manager.query(
      `INSERT INTO file_assets
       (id,item_id,account_id,kind,position_index,cod_archivo,num_id,original_name,size_bytes,state)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE cod_archivo=VALUES(cod_archivo),num_id=VALUES(num_id),original_name=VALUES(original_name),
         size_bytes=IF(state='stored',size_bytes,VALUES(size_bytes))`,
      [randomUUID(), itemId, accountId, file.kind, position,
        file.codArchivo === null ? null : String(file.codArchivo), file.numId ?? null,
        file.name?.slice(0, 255) ?? null, Number.isInteger(file.sizeBytes) && Number(file.sizeBytes) > 0 ? file.sizeBytes : null, "available"],
    );
  }
}
