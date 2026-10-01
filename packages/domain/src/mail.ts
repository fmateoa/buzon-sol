import { limaInstant } from "./schedule.js";

/**
 * SUNAT publishes `dd/mm/yyyy hh:mm:ss` without a zone. The explicit interpretation is America/Lima;
 * callers keep the original text next to the result. Unknown formats return null instead of guessing.
 */
export function parseSunatDateTime(text: unknown): Date | null {
  if (typeof text !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!match) return null;
  const [day, month, year, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return new Date(limaInstant(year, month, day, hour * 60 + minute).getTime() + second * 1000);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  iexcl: "¡", iquest: "¿", ordm: "º", ordf: "ª", deg: "°",
};
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);

/** SUNAT sends some values percent-encoded with HTML entities inside (`%26%23243;` is `ó`). The result is plain text. */
function decodeSunatText(value: string): string {
  let text = value;
  try { text = decodeURIComponent(value); }
  catch { /* A stray `%` is not an encoding: keep the text as it came. */ }
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[A-Za-z]{2,8});/gi, (entity, code: string) => {
    if (code[0] !== "#") return NAMED_ENTITIES[code] ?? entity;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

// Only keys whose meaning is evident from the observed values; any other key is shown as it came.
const FIELD_LABELS: Record<string, string> = {
  razon_social: "Razón social", nombre: "Nombre", numruc: "RUC", fecha_deposito: "Fecha de depósito",
  des_tip_doc: "Tipo de documento", num_doc: "Número de documento", dependencia: "Dependencia",
  tipo_doc: "Documento de identidad", nro_doc: "Número de identidad",
};

/**
 * `indTexto=3`: the body is a JSON object, not HTML. Renders it as a two-column table of escaped text so no value
 * can carry markup. Returns null when the body is not a JSON object; the caller then shows it as plain text.
 */
export function renderStructuredBody(body: string): string | null {
  let data: unknown;
  try { data = JSON.parse(body); }
  catch { return null; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rows = Object.entries(data as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => {
      const text = typeof value === "string" ? decodeSunatText(value) : typeof value === "object" ? JSON.stringify(value) : String(value);
      return `<tr><th>${escapeHtml(FIELD_LABELS[key] ?? key)}</th><td>${escapeHtml(text)}</td></tr>`;
    });
  return rows.length ? `<table><tbody>${rows.join("")}</tbody></table>` : null;
}
