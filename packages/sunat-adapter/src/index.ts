import { AppError, type MailBox } from "@buzon-sol/domain";

export interface SunatRow {
  codMensaje: string;
  indEstado: number;
  [key: string]: unknown;
}

export interface PageResponse {
  contentType: string;
  body: string;
}

export interface ParsedPage {
  rows: SunatRow[];
  declaredRecords: number | null;
  declaredPages: number | null;
}

export interface InventoryClient {
  /** A session isolated to one account; inventory has no detail method. */
  listPage(box: MailBox, page: number): Promise<PageResponse>;
  /** C-03 `listarCarpetas`. Optional: a failure marks the catalog unavailable and never stops the inventory. */
  listFolders?(): Promise<PageResponse>;
  /** `/visor/master` requested as HTML without running its scripts; source of `listEtiquetas`. */
  visorHtml?(): Promise<PageResponse>;
  /** C-04 `consultarAlertas`. */
  consultAlerts?(): Promise<PageResponse>;
  /** Starts a new session for the same account after `remote_session_expired`; throws `invalid_credential` if rejected. */
  reauthenticate?(): Promise<void>;
  close?(): Promise<void>;
}

/** `any` es solo para consultas por etiqueta, que la web hace sin `tipoMsj` y mezclan ambas bandejas. */
export function parseInventoryPage(response: PageResponse, box: MailBox | "any"): ParsedPage {
  const type = response.contentType.toLowerCase();
  if (type.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(response.body)) {
    throw new AppError("remote_session_expired");
  }
  if (!type.includes("application/json")) throw new AppError("schema_changed");
  let data: unknown;
  try { data = JSON.parse(response.body); }
  catch { throw new AppError("schema_changed"); }
  if (data && typeof data === "object" && (data as { rows?: unknown }).rows === null) {
    throw new AppError("remote_session_expired");
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { rows?: unknown }).rows)) {
    throw new AppError("schema_changed");
  }
  const page = data as { rows: unknown[]; records?: unknown; total?: unknown };
  const expectedType = box === "any" ? null : box === "messages" ? 1 : 2;
  const rows = page.rows.map((entry): SunatRow => {
    if (!entry || typeof entry !== "object") throw new AppError("schema_changed");
    const row = entry as Record<string, unknown>;
    const id = row.codMensaje;
    if ((typeof id !== "number" && typeof id !== "string") || !/^\d+$/.test(String(id)) ||
        typeof row.indEstado !== "number" || !Number.isInteger(row.indEstado) ||
        (expectedType !== null && row.indTipmsj != null && Number(row.indTipmsj) !== expectedType)) {
      throw new AppError("schema_changed");
    }
    return { ...row, codMensaje: String(id), indEstado: row.indEstado };
  });
  return {
    rows,
    declaredRecords: typeof page.records === "number" ? page.records : null,
    declaredPages: typeof page.total === "number" ? page.total : null,
  };
}

export interface ScanPage {
  box: MailBox;
  page: number;
  rows: SunatRow[];
  received: number;
  declaredRecords: number | null;
  declaredPages: number | null;
  confirmedEmpty: boolean;
}

export async function scanBox(
  client: InventoryClient,
  box: MailBox,
  persistPage: (page: ScanPage) => Promise<void>,
  startPage = 1,
  maxPages = 500,
): Promise<void> {
  if (!Number.isInteger(startPage) || startPage < 1 || !Number.isInteger(maxPages) || maxPages < startPage) {
    throw new AppError("validation");
  }
  for (let page = startPage; page <= maxPages; page++) {
    let parsed = parseInventoryPage(await client.listPage(box, page), box);
    if (parsed.rows.length === 0) {
      const confirmation = parseInventoryPage(await client.listPage(box, page), box);
      if (confirmation.rows.length === 0) {
        await persistPage({ box, page, rows: [], received: 0,
          declaredRecords: confirmation.declaredRecords, declaredPages: confirmation.declaredPages,
          confirmedEmpty: true });
        return;
      }
      parsed = confirmation;
    }
    await persistPage({ box, page, rows: parsed.rows, received: parsed.rows.length,
      declaredRecords: parsed.declaredRecords, declaredPages: parsed.declaredPages,
      confirmedEmpty: false });
  }
  throw new AppError("incomplete_inventory");
}

export { parseFolders, parseLabels, parseAlerts, type SunatFolder, type SunatLabel, type SunatAlerts } from "./catalogs.js";
export { SunatHttpSession, type SolLogin, type SolDetail, type SolFileResponse, type ListFilter } from "./http.js";
