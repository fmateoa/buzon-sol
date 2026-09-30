/** Reads one authorized test credential from stdin; emits only redacted verdicts. */
import { createHash } from "node:crypto";
import { parseInventoryPage, scanBox, SunatHttpSession } from "../packages/sunat-adapter/src/index.js";

type Credential = { ruc: string; solUser: string; password: string };
const mode = process.argv[2] ?? "--connection";

async function snapshot(session: SunatHttpSession): Promise<Map<string, number>> {
  const states = new Map<string, number>();
  for (const box of ["messages", "notifications"] as const) {
    await scanBox(session, box, async (page) => {
      for (const row of page.rows) states.set(`${box}:${row.codMensaje}`, row.indEstado);
    });
  }
  return states;
}

async function probe(credential: Credential): Promise<object> {
  if (mode === "--passive-check") {
    const first = await SunatHttpSession.open(credential);
    let before: Map<string, number>;
    try { before = await snapshot(first); } finally { await first.close(); }
    const second = await SunatHttpSession.open(credential);
    let after: Map<string, number>;
    try { after = await snapshot(second); } finally { await second.close(); }
    const unread = [...before].filter(([, state]) => state === 0);
    return { unreadBefore: unread.length,
      unreadStillUnread: unread.filter(([id]) => after.get(id) === 0).length,
      unreadChanged: unread.filter(([id]) => after.has(id) && after.get(id) !== 0).length,
      missingAfter: unread.filter(([id]) => !after.has(id)).length };
  }
  if (mode === "--relogin-check") {
    let logins = 0;
    let injected = false;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag") && !injected) {
        injected = true;
        return new Response('{"rows":null}', { headers: { "Content-Type": "application/json" } });
      }
      const response = await fetch(input, init);
      if (url.pathname.endsWith("/oauth2/j_security_check")) logins++;
      return response;
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try {
      await session.testConnection();
      return { injectedExpiry: injected, freshLogins: logins, resumed: logins === 2 };
    } finally { await session.close(); }
  }
  if (mode === "--logout-check") {
    let protectedRequest: { url: URL; headers: Headers } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag")) {
        protectedRequest = { url, headers: new Headers(init?.headers) };
      }
      return fetch(input, init);
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try { await session.testConnection(); } finally { await session.close(); }
    if (!protectedRequest) throw new Error("missing_protected_request");
    const response = await fetch(protectedRequest.url, {
      headers: protectedRequest.headers, redirect: "manual", signal: AbortSignal.timeout(25_000),
    });
    let rowsArray = false;
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      try { rowsArray = Array.isArray((await response.json() as { rows?: unknown }).rows); } catch { /* Invalid JSON is not access. */ }
    }
    return { status: response.status, protectedRowsStillAccessible: rowsArray };
  }
  if (mode === "--dependency-check") {
    let listRequest: { url: URL; headers: Headers } | undefined;
    let fileRequest: { url: URL; headers: Headers } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag")) listRequest = { url, headers: new Headers(init?.headers) };
      if (url.pathname.includes("/visor/bajarArchivo/")) fileRequest = { url, headers: new Headers(init?.headers) };
      return fetch(input, init);
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try {
      await session.testConnection();
      const page = parseInventoryPage(await session.listPage("notifications", 1), "notifications");
      for (const row of page.rows.filter((entry) => entry.indEstado !== 0).slice(0, 5)) {
        const detail = await session.readDetail("notifications", row.codMensaje);
        const file = detail.files.find((entry) => entry.kind === "attachment" && entry.codArchivo !== "0");
        if (file?.codArchivo) {
          await session.fetchAttachment("notifications", row.codMensaje, file.codArchivo);
          break;
        }
      }
      if (!listRequest) throw new Error("missing_list_request");
      const variants = ["full", "no_cookie", "no_x_ruc", "no_xhr", "no_referer", "anonymous"] as const;
      const lists = [];
      const files = [];
      for (const variant of variants) {
        const headers = new Headers(listRequest.headers);
        if (variant === "no_cookie" || variant === "anonymous") headers.delete("Cookie");
        if (variant === "no_x_ruc" || variant === "anonymous") headers.delete("X-Ruc");
        if (variant === "no_xhr" || variant === "anonymous") headers.delete("X-Requested-With");
        if (variant === "no_referer" || variant === "anonymous") headers.delete("Referer");
        const response = await fetch(listRequest.url, { headers, redirect: "manual", signal: AbortSignal.timeout(25_000) });
        let rows = false;
        if (response.headers.get("Content-Type")?.includes("application/json")) {
          try { rows = Array.isArray((await response.json() as { rows?: unknown }).rows); } catch { /* Not a valid list. */ }
        }
        lists.push({ variant, status: response.status, rows });
        if (fileRequest) {
          const fileHeaders = new Headers(fileRequest.headers);
          if (variant === "no_cookie" || variant === "anonymous") fileHeaders.delete("Cookie");
          if (variant === "no_x_ruc" || variant === "anonymous") fileHeaders.delete("X-Ruc");
          if (variant === "no_xhr" || variant === "anonymous") fileHeaders.delete("X-Requested-With");
          if (variant === "no_referer" || variant === "anonymous") fileHeaders.delete("Referer");
          const fileResponse = await fetch(fileRequest.url, { headers: fileHeaders,
            redirect: "manual", signal: AbortSignal.timeout(25_000) });
          const bytes = new Uint8Array(await fileResponse.arrayBuffer());
          files.push({ variant, status: fileResponse.status,
            pdf: fileResponse.headers.get("Content-Type")?.toLowerCase().includes("application/pdf") === true &&
              Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-" });
        }
      }
      return { lists, files, fileFound: !!fileRequest };
    } finally { await session.close(); }
  }
  if (mode === "--inventory-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const report = [];
      for (const box of ["messages", "notifications"] as const) {
        const ids = new Set<string>();
        let pagesWithRows = 0;
        let emptyPage: number | null = null;
        const started = Date.now();
        await scanBox(session, box, async (page) => {
          if (page.confirmedEmpty) { emptyPage = page.page; return; }
          pagesWithRows++;
          for (const row of page.rows) ids.add(row.codMensaje);
        });
        report.push({ box, pagesWithRows, uniqueRows: ids.size, emptyPage,
          elapsedSeconds: Math.round((Date.now() - started) / 1000) });
      }
      return { inventory: report };
    } finally { await session.close(); }
  }
  if (mode === "--catalog-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const result: Record<string, object> = {};
      try { result.folders = { count: (await session.listFolders()).length }; }
      catch (error) { result.folders = { error: error instanceof Error && "code" in error ? error.code : "probe_failed" }; }
      try { result.labels = { count: session.listLabels().length }; }
      catch (error) { result.labels = { error: error instanceof Error && "code" in error ? error.code : "probe_failed" }; }
      try { result.alerts = { count: (await session.consultAlerts()).length }; }
      catch (error) { result.alerts = { error: error instanceof Error && "code" in error ? error.code : "probe_failed" }; }
      return result;
    } finally { await session.close(); }
  }
  if (mode === "--read-safe-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const result = [];
      for (const box of ["messages", "notifications"] as const) {
        let checked = false;
        for (let page = 1; page <= 500; page++) {
          let current = parseInventoryPage(await session.listPage(box, page), box);
          if (current.rows.length === 0) {
            current = parseInventoryPage(await session.listPage(box, page), box);
            if (current.rows.length === 0) break;
          }
          const row = current.rows.find((entry) => entry.indEstado !== 0);
          if (row) {
            const detail = await session.readDetail(box, row.codMensaje);
            const after = parseInventoryPage(await session.listPage(box, page), box)
              .rows.find((entry) => entry.codMensaje === row.codMensaje);
            result.push({ box, foundReadItem: true,
              indTexto: detail.indTexto === "1" || detail.indTexto === "3" ? detail.indTexto : "other",
              nestedJsonValid: detail.indTexto === "3" ? isJson(detail.body) : null,
              updateLeido: detail.updateLeido, stateUnchanged: after?.indEstado === row.indEstado,
              attachmentCount: detail.files.filter((file) => file.kind === "attachment").length,
              generatedDocumentCount: detail.files.filter((file) => file.kind === "generated_document").length,
              generatedUrlPresent: detail.generatedUrl !== null });
            checked = true;
            break;
          }
        }
        if (!checked) result.push({ box, foundReadItem: false });
      }
      return { alreadyReadDetails: result };
    } finally { await session.close(); }
  }
  if (mode === "--files-safe-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const result = [];
      for (const box of ["messages", "notifications"] as const) {
        let inspectedReadItems = 0;
        let attachment: object | null = null;
        let generated: object | null = null;
        for (let page = 1; page <= 500 && (!attachment || !generated); page++) {
          let current = parseInventoryPage(await session.listPage(box, page), box);
          if (current.rows.length === 0) {
            current = parseInventoryPage(await session.listPage(box, page), box);
            if (current.rows.length === 0) break;
          }
          for (const row of current.rows) {
            if (row.indEstado === 0 || inspectedReadItems >= 25) continue;
            inspectedReadItems++;
            const detail = await session.readDetail(box, row.codMensaje);
            if (detail.updateLeido === true) throw new Error("already_read_state_changed");
            const file = detail.files.find((entry) => entry.kind === "attachment");
            if (!attachment && file?.codArchivo) {
              const response = await session.fetchAttachment(box, row.codMensaje, file.codArchivo);
              attachment = { codeZero: file.codArchivo === "0", status: response.status,
                mimeIsPdf: response.contentType.toLowerCase().includes("application/pdf"),
                pdfMagic: response.bytes.subarray(0, 5).toString() === "%PDF-",
                filenamePresent: !!response.filename, bytes: response.bytes.length,
                sha256Computed: createHash("sha256").update(response.bytes).digest().length === 32 };
            }
            const doc = detail.files.find((entry) => entry.kind === "generated_document");
            if (!generated && doc?.numId && detail.generatedUrl) {
              const response = await session.fetchGeneratedDocument(box, row.codMensaje, doc.numId);
              generated = { status: response.status, mimeIsHtml: response.contentType.toLowerCase().includes("text/html"),
                verified: response.verifiedGeneratedDocument === true,
                bytes: response.bytes.length, sha256Computed: createHash("sha256").update(response.bytes).digest().length === 32 };
            }
            if (attachment && generated) break;
          }
          if (inspectedReadItems >= 25) break;
        }
        result.push({ box, inspectedReadItems, attachment, generated });
      }
      return { alreadyReadFiles: result };
    } finally { await session.close(); }
  }
  if (mode === "--expiry-idle" || mode === "--expiry-active") {
    const minutes = Number(process.env.SUNAT_PROBE_MINUTES ?? "15");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error("invalid_duration");
    let logins = 0;
    let expiredReplies = 0;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const response = await fetch(input, init);
      if (url.pathname.endsWith("/oauth2/j_security_check")) logins++;
      if (url.pathname.endsWith("/visor/listNotiMenPag")) {
        const type = response.headers.get("Content-Type")?.toLowerCase() ?? "";
        if (type.includes("text/html")) expiredReplies++;
        else if (type.includes("application/json")) {
          try { if ((await response.clone().json() as { rows?: unknown }).rows === null) expiredReplies++; }
          catch { /* The adapter handles malformed JSON. */ }
        }
      }
      return response;
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try {
      await session.testConnection();
      for (let elapsed = 1; elapsed <= minutes; elapsed++) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        if (mode === "--expiry-active" || elapsed === minutes) {
          parseInventoryPage(await session.listPage("messages", 1), "messages");
        }
      }
      return { mode, observedMinutes: minutes, freshLogins: logins,
        expiredReplies, reentered: logins > 1 };
    } finally { await session.close(); }
  }
  if (mode !== "--connection") throw new Error("unknown_mode");
  const session = await SunatHttpSession.open(credential);
  try { return { session: await session.testConnection(), boxes: ["messages", "notifications"] }; }
  finally { await session.close(); }
}

function isJson(value: string): boolean {
  try { JSON.parse(value); return true; }
  catch { return false; }
}

async function main(): Promise<void> {
  try {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    const credential = JSON.parse(input) as Credential;
    if (!/^\d{11}$/.test(credential.ruc) || !credential.solUser || !credential.password) throw new Error("credential_shape");
    process.stdout.write(JSON.stringify(await probe(credential)) + "\n");
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error instanceof Error && "code" in error ? error.code : "probe_failed" }) + "\n");
    process.exitCode = 1;
  }
}

void main();
