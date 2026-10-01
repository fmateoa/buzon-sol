import { AppError } from "@buzon-sol/domain";
import type { PageResponse } from "./index.js";

export interface SunatFolder { code: string; name: string; messageCount: number | null }
export interface SunatLabel { code: string; name: string; color: string | null; messageCount: number | null }
export interface SunatAlerts { alerts: unknown[] }

const code = (value: unknown): string | null =>
  (typeof value === "string" || typeof value === "number") && /^[0-9A-Za-z_-]{1,40}$/.test(String(value)) ? String(value) : null;
const name = (value: unknown): string | null =>
  typeof value === "string" && value.trim() && value.length <= 200 ? value.trim() : null;
const count = (value: unknown): number | null => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;

function json(response: PageResponse): unknown {
  const type = response.contentType.toLowerCase();
  if (type.includes("text/html") || /^\s*<(!doctype html|html)/i.test(response.body)) throw new AppError("remote_session_expired");
  if (!type.includes("application/json")) throw new AppError("schema_changed");
  try { return JSON.parse(response.body); }
  catch { throw new AppError("schema_changed"); }
}

/** C-03 `listarCarpetas`: an array with codCarpeta, nomCarpeta and cantMensajes; `[]` is a valid empty catalog. */
export function parseFolders(response: PageResponse): SunatFolder[] {
  const data = json(response);
  if (!Array.isArray(data)) throw new AppError("schema_changed");
  return data.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const folderCode = code(row.codCarpeta), folderName = name(row.nomCarpeta);
    if (!folderCode || !folderName) throw new AppError("schema_changed");
    return { code: folderCode, name: folderName, messageCount: count(row.cantMensajes) };
  });
}

/** Returns the balanced `[...]` literal that starts at `start`, honoring JSON strings. */
function arrayLiteral(source: string, start: number): string | null {
  let depth = 0, inString = false, escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
    } else if (char === "\"") inString = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

/**
 * `listEtiquetas` is embedded in the `/visor/master` HTML (no separate endpoint observed). The HTML is treated as
 * data and its scripts are never executed. Only a strict JSON array literal is accepted; anything else is
 * `schema_changed`, so the caller marks the catalog unavailable while the inventory continues.
 * The exact embedding is pending S-11; the fixture is invented.
 */
export function parseLabels(response: PageResponse): SunatLabel[] {
  if (!response.contentType.toLowerCase().includes("text/html")) throw new AppError("schema_changed");
  const match = /\blistEtiquetas\s*[=:]\s*\[/.exec(response.body);
  if (!match) throw new AppError("schema_changed");
  const literal = arrayLiteral(response.body, match.index + match[0].length - 1);
  if (!literal) throw new AppError("schema_changed");
  let data: unknown;
  try { data = JSON.parse(literal); }
  catch { throw new AppError("schema_changed"); }
  if (!Array.isArray(data)) throw new AppError("schema_changed");
  return data.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const labelCode = code(row.codEtiqueta), labelName = name(row.descEtiqueta);
    if (!labelCode || !labelName) throw new AppError("schema_changed");
    const color = typeof row.colorEtiqueta === "string" && /^#[0-9a-f]{3,8}$/i.test(row.colorEtiqueta) ? row.colorEtiqueta : null;
    return { code: labelCode, name: labelName, color, messageCount: count(row.cantEtiqueta) };
  });
}

/** C-04 `consultarAlertas`: `{listaAlertas: []}`. Alerts are kept raw for diagnosis; no semantics are inferred. */
export function parseAlerts(response: PageResponse): SunatAlerts {
  const data = json(response) as { listaAlertas?: unknown } | null;
  if (!data || typeof data !== "object" || !Array.isArray(data.listaAlertas)) throw new AppError("schema_changed");
  return { alerts: data.listaAlertas };
}
