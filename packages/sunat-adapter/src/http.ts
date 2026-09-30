import { CookieJar } from "tough-cookie";
import { AppError, type MailBox } from "@buzon-sol/domain";
import { parseInventoryPage, type InventoryClient, type PageResponse } from "./index.js";

const HOME = "https://www.sunat.gob.pe/";
const LIST = "https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/listNotiMenPag";
const DETAIL = "https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/obtenerDetalleNotiMen";
const FOLDERS = "https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/ajax/listarCarpetas";
const ALERTS = "https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/consultarAlertas";
const EXIT = "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm";
const HOSTS = new Set(["www.sunat.gob.pe", "api-seguridad.sunat.gob.pe", "e-menu.sunat.gob.pe", "ww1.sunat.gob.pe"]);

export interface SolLogin { ruc: string; solUser: string; password: string }
export interface SolDetail {
  body: string;
  indTexto: string | null;
  updateLeido: boolean | null;
  generatedUrl: string | null;
  files: { kind: "attachment" | "generated_document"; codArchivo: string | null;
    numId: string | null; name: string | null }[];
}
export interface SolFileResponse { status: number; contentType: string; bytes: Buffer; filename?: string | null;
  verifiedGeneratedDocument?: boolean }
export interface SolFolder { codCarpeta: string; nomCarpeta: string; cantMensajes: number | null }
export interface SolLabel { codEtiqueta: string; descEtiqueta: string; colorEtiqueta: string | null; cantEtiqueta: number | null }

const unescapeAttribute = (value: string): string => value.replace(/&amp;|&#38;|&#x26;/gi, "&");

function downloadFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = disposition.match(/\bfilename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/\bfilename\s*=\s*"([^"]*)"/i)?.[1] ??
    disposition.match(/\bfilename\s*=\s*([^;\s]+)/i)?.[1];
  let name: string;
  try { name = encoded ? decodeURIComponent(encoded) : (plain ?? ""); }
  catch { return null; }
  return name && name.length <= 255 && !/[\\/\x00-\x1f\x7f]/.test(name) ? name : null;
}

function sunatUrl(value: string, base?: string): URL {
  let url: URL;
  try { url = new URL(unescapeAttribute(value), base); }
  catch { throw new AppError("schema_changed"); }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) throw new AppError("schema_changed");
  return url;
}

function matchAttribute(html: string, tag: string, attribute: string, predicate: (value: string) => boolean): string | null {
  for (const element of html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))) {
    const value = element[0].match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)`, "i"))?.[1];
    if (value && predicate(value)) return unescapeAttribute(value);
  }
  return null;
}

/** One in-memory cookie jar per account and execution. URLs and cookies never enter errors. */
export class SunatHttpSession implements InventoryClient {
  private readonly cookies = new CookieJar();
  private menuReached = false;
  private masterUrl: URL | null = null;
  private masterHtml: string | null = null;
  private closed = false;

  private constructor(private readonly credential: SolLogin, private readonly fetcher: typeof fetch) {}

  static async open(credential: SolLogin, fetcher: typeof fetch = fetch): Promise<SunatHttpSession> {
    if (!/^\d{11}$/.test(credential.ruc) || !credential.solUser || !credential.password) throw new AppError("validation");
    const session = new SunatHttpSession(credential, fetcher);
    try { await session.login(); return session; }
    catch (error) {
      try { await session.close(); } catch { /* Preserve the login error. */ }
      throw error;
    }
  }

  private async request(initialUrl: URL, init: RequestInit = {}): Promise<{ response: Response; url: URL }> {
    let url = sunatUrl(initialUrl.href);
    let method = init.method ?? "GET";
    let body = init.body;
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-419) PowerShell/7.6.6");
    headers.set("Accept", "text/html,application/json;q=0.9,*/*;q=0.8");
    for (let redirects = 0; redirects <= 8; redirects++) {
      const cookie = await this.cookies.getCookieString(url.href);
      if (cookie) headers.set("Cookie", cookie);
      else headers.delete("Cookie");
      let response: Response;
      try {
        response = await this.fetcher(url, { method, body, headers, redirect: "manual", signal: AbortSignal.timeout(25_000) });
        for (const setCookie of response.headers.getSetCookie()) await this.cookies.setCookie(setCookie, url.href);
      } catch { throw new AppError("remote_unavailable"); }
      if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url };
      const location = response.headers.get("Location");
      if (!location || redirects === 8) throw new AppError("schema_changed");
      const next = sunatUrl(location, url.href);
      if (next.origin !== url.origin) {
        headers.delete("Referer");
        headers.delete("X-Ruc");
        headers.delete("X-Requested-With");
      }
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method.toUpperCase() === "POST")) {
        method = "GET";
        body = undefined;
        headers.delete("Content-Type");
      }
      url = next;
    }
    throw new AppError("schema_changed");
  }

  private async html(url: URL, init?: RequestInit): Promise<{ body: string; url: URL }> {
    const result = await this.request(url, init);
    if (result.response.status !== 200 || !result.response.headers.get("Content-Type")?.toLowerCase().includes("text/html")) {
      throw new AppError("remote_unavailable");
    }
    try { return { body: await result.response.text(), url: result.url }; }
    catch { throw new AppError("remote_unavailable"); }
  }

  private async login(): Promise<void> {
    const home = await this.html(sunatUrl(HOME));
    const link = matchAttribute(home.body, "a", "href", (value) => value.includes("/oauth2/loginMenuSol"));
    if (!link) throw new AppError("schema_changed");
    const loginUrl = sunatUrl(link, home.url.href);
    if (loginUrl.hostname !== "api-seguridad.sunat.gob.pe" || !loginUrl.searchParams.get("originalUrl") || !loginUrl.searchParams.get("state")) {
      throw new AppError("schema_changed");
    }
    const form = await this.html(loginUrl);
    const action = matchAttribute(form.body, "form", "action", (value) => value.includes("j_security_check"));
    if (!action) throw new AppError("schema_changed");
    const actionUrl = sunatUrl(action, form.url.href);
    if (actionUrl.hostname !== "api-seguridad.sunat.gob.pe" || !actionUrl.pathname.endsWith("/oauth2/j_security_check")) {
      throw new AppError("schema_changed");
    }
    const fields = new URLSearchParams({ tipo: "2", dni: "", custom_ruc: this.credential.ruc,
      j_username: this.credential.solUser, j_password: this.credential.password, captcha: "", lang: "",
      originalUrl: loginUrl.searchParams.get("originalUrl")!, state: loginUrl.searchParams.get("state")! });
    const menu = await this.html(actionUrl, { method: "POST", body: fields,
      headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (menu.url.hostname !== "e-menu.sunat.gob.pe" || menu.url.searchParams.get("exe") !== "buzon" ||
        !menu.body.includes(this.credential.ruc)) throw new AppError("schema_changed");
    this.menuReached = true;
    const direct = menu.body.match(/https:\/\/ww1\.sunat\.gob\.pe\/ol-ti-itvisornoti\/visor\/master\?[^\s"'<>\\]+/i)?.[0];
    if (direct) {
      const master = sunatUrl(direct.replaceAll("&amp;", "&"));
      const page = await this.html(master); // HTML data only; no scripts or detail requests.
      this.masterUrl = page.url;
      this.masterHtml = page.body;
    } else {
      const action = menu.body.match(/function\s+cargaBuzon\s*\(\s*\)\s*\{\s*logoutAndLoad\s*\(\s*["']([^"']+)/i)?.[1];
      if (!action) throw new AppError("schema_changed");
      const target = sunatUrl(action, menu.url.href);
      if (target.hostname !== "e-menu.sunat.gob.pe" || !target.pathname.endsWith("/MenuInternet.htm") ||
          target.searchParams.get("action") !== "buzon") throw new AppError("schema_changed");
      await this.request(sunatUrl(EXIT), { method: "POST", body: new URLSearchParams({ action: "prevApp" }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      target.searchParams.set("s", "ww1");
      const page = await this.html(target); // Follows SUNAT's redirect to the exact master URL.
      if (page.url.hostname !== "ww1.sunat.gob.pe" || !page.url.pathname.endsWith("/visor/master") ||
          !page.url.searchParams.has("hc") || !page.url.searchParams.has("token")) throw new AppError("schema_changed");
      this.masterUrl = page.url;
      this.masterHtml = page.body;
    }
  }

  async listPage(box: MailBox, page: number): Promise<PageResponse> {
    if (this.closed || !this.masterUrl) throw new AppError("remote_unavailable");
    const first = await this.fetchListPage(box, page);
    if (!this.expired(first)) return first;
    await this.cookies.removeAllCookies();
    this.menuReached = false;
    this.masterUrl = null;
    this.masterHtml = null;
    await this.login();
    const retry = await this.fetchListPage(box, page);
    if (this.expired(retry)) throw new AppError("remote_session_expired");
    return retry;
  }

  private expired(response: PageResponse): boolean {
    if (response.contentType.toLowerCase().includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(response.body)) return true;
    if (!response.contentType.toLowerCase().includes("application/json")) return false;
    try { return (JSON.parse(response.body) as { rows?: unknown }).rows === null; }
    catch { return false; }
  }

  private async fetchListPage(box: MailBox, page: number): Promise<PageResponse> {
    if (!this.masterUrl) throw new AppError("remote_unavailable");
    const url = sunatUrl(LIST);
    url.search = new URLSearchParams({ tipoMsj: box === "messages" ? "1" : "2", codCarpeta: "00",
      codEtiqueta: "", page: String(page), des_asunto: "", codMensaje: "", tipoOrden: "NADA", _: String(Date.now()) }).toString();
    const { response } = await this.request(url, { headers: { "X-Requested-With": "XMLHttpRequest",
      "X-Ruc": this.credential.ruc, Referer: this.masterUrl.href } });
    if (response.status !== 200) throw new AppError("remote_unavailable");
    try { return { contentType: response.headers.get("Content-Type") ?? "", body: await response.text() }; }
    catch { throw new AppError("remote_unavailable"); }
  }

  async testConnection(): Promise<"valid"> {
    for (const box of ["messages", "notifications"] as const) parseInventoryPage(await this.listPage(box, 1), box);
    return "valid";
  }

  async listFolders(): Promise<SolFolder[]> {
    const { response } = await this.request(sunatUrl(FOLDERS), { headers: this.visorHeaders() });
    const raw = await this.jsonResponse(response);
    if (!Array.isArray(raw)) throw new AppError("schema_changed");
    return raw.map((entry) => {
      if (!entry || typeof entry !== "object") throw new AppError("schema_changed");
      const folder = entry as Record<string, unknown>;
      if ((typeof folder.codCarpeta !== "string" && typeof folder.codCarpeta !== "number") ||
          typeof folder.nomCarpeta !== "string") throw new AppError("schema_changed");
      return { codCarpeta: String(folder.codCarpeta), nomCarpeta: folder.nomCarpeta,
        cantMensajes: typeof folder.cantMensajes === "number" ? folder.cantMensajes : null };
    });
  }

  listLabels(): SolLabel[] {
    if (this.closed || !this.masterHtml) throw new AppError("remote_unavailable");
    const literal = this.masterHtml.match(/var\s+listEtiquetas\s*=\s*\$\.parseJSON\(\s*'((?:\\.|[^'\\])*)'\s*\)/s)?.[1];
    if (!literal) throw new AppError("schema_changed");
    let raw: unknown;
    try { raw = JSON.parse(literal); }
    catch { throw new AppError("schema_changed"); }
    if (!Array.isArray(raw)) throw new AppError("schema_changed");
    return raw.map((entry) => {
      if (!entry || typeof entry !== "object") throw new AppError("schema_changed");
      const label = entry as Record<string, unknown>;
      if ((typeof label.codEtiqueta !== "string" && typeof label.codEtiqueta !== "number") ||
          typeof label.descEtiqueta !== "string") throw new AppError("schema_changed");
      return { codEtiqueta: String(label.codEtiqueta), descEtiqueta: label.descEtiqueta,
        colorEtiqueta: typeof label.colorEtiqueta === "string" ? label.colorEtiqueta : null,
        cantEtiqueta: typeof label.cantEtiqueta === "number" ? label.cantEtiqueta : null };
    });
  }

  async consultAlerts(): Promise<unknown[]> {
    const { response } = await this.request(sunatUrl(ALERTS), { method: "POST", body: new URLSearchParams(),
      headers: this.visorHeaders() });
    const raw = await this.jsonResponse(response);
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as { listaAlertas?: unknown }).listaAlertas)) {
      throw new AppError("schema_changed");
    }
    return (raw as { listaAlertas: unknown[] }).listaAlertas;
  }

  private async jsonResponse(response: Response): Promise<unknown> {
    if (response.status !== 200) throw new AppError("remote_unavailable");
    const type = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (type.includes("text/html")) throw new AppError("remote_session_expired");
    if (!type.includes("application/json")) throw new AppError("schema_changed");
    try { return await response.json(); }
    catch { throw new AppError("schema_changed"); }
  }

  /** Explicit read only: this SUNAT endpoint may change remote read state. */
  async readDetail(box: MailBox, codMensaje: string): Promise<SolDetail> {
    if (this.closed || !this.masterUrl) throw new AppError("remote_unavailable");
    if (!/^\d+$/.test(codMensaje)) throw new AppError("validation");
    const url = sunatUrl(DETAIL);
    url.search = new URLSearchParams({ codigoMensaje: codMensaje, tipoMsj: box === "messages" ? "1" : "2",
      _: String(Date.now()) }).toString();
    const { response } = await this.request(url, { headers: { "X-Requested-With": "XMLHttpRequest",
      "X-Ruc": this.credential.ruc, Referer: this.masterUrl.href } });
    const raw = await this.jsonResponse(response);
    if (!raw || typeof raw !== "object") throw new AppError("schema_changed");
    const data = raw as Record<string, unknown>;
    if (typeof data.msjMensaje !== "string" || !Array.isArray(data.listAttach)) throw new AppError("schema_changed");
    const files: SolDetail["files"] = data.listAttach.map((entry) => {
      if (!entry || typeof entry !== "object") throw new AppError("schema_changed");
      const file = entry as Record<string, unknown>;
      const code = file.codArchivo;
      const numId = file.numId;
      const isCode = (typeof code === "number" || typeof code === "string") && /^\d+$/.test(String(code));
      const isGenerated = code == null && (typeof numId === "number" || typeof numId === "string") && /^\d+$/.test(String(numId));
      if (!isCode && !isGenerated) throw new AppError("schema_changed");
      const name = typeof file.nomArchivo === "string" ? file.nomArchivo :
        typeof file.nomAdjunto === "string" ? file.nomAdjunto : null;
      return { kind: isGenerated ? "generated_document" : "attachment", codArchivo: isCode ? String(code) : null,
        numId: numId == null ? null : String(numId), name };
    });
    let generatedUrl: string | null = null;
    if (typeof data.url === "string" && data.url) {
      const target = sunatUrl(data.url, "https://ww1.sunat.gob.pe/");
      if (target.hostname !== "ww1.sunat.gob.pe" || !target.pathname.endsWith("/cl-ti-iagenerador/gendocS01Alias")) {
        throw new AppError("schema_changed");
      }
      generatedUrl = target.href;
    }
    return { body: data.msjMensaje,
      indTexto: typeof data.indTexto === "string" || typeof data.indTexto === "number" ? String(data.indTexto) : null,
      updateLeido: typeof data.updateLeido === "boolean" ? data.updateLeido : null,
      generatedUrl, files };
  }

  async observeState(box: MailBox, codMensaje: string): Promise<number | null> {
    if (!/^\d+$/.test(codMensaje)) throw new AppError("validation");
    for (let page = 1; page <= 500; page++) {
      const current = parseInventoryPage(await this.listPage(box, page), box);
      const row = current.rows.find((entry) => entry.codMensaje === codMensaje);
      if (row) return row.indEstado;
      if (current.rows.length === 0) {
        const confirmation = parseInventoryPage(await this.listPage(box, page), box);
        if (confirmation.rows.length === 0) return null;
        const retried = confirmation.rows.find((entry) => entry.codMensaje === codMensaje);
        if (retried) return retried.indEstado;
      }
    }
    throw new AppError("incomplete_inventory");
  }

  /** Reopens the already authorized item, then downloads in the same session. */
  async fetchAttachment(box: MailBox, codMensaje: string, codArchivo: string): Promise<SolFileResponse> {
    if (!/^\d+$/.test(codArchivo)) throw new AppError("validation");
    const detail = await this.readDetail(box, codMensaje);
    if (detail.files.filter((file) => file.kind === "attachment" && file.codArchivo === codArchivo).length !== 1) {
      throw new AppError("schema_changed");
    }
    const url = sunatUrl(`https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/bajarArchivo/${codArchivo}/0/0/${this.credential.ruc}`);
    const { response } = await this.request(url, { headers: this.visorHeaders() });
    return { status: response.status, contentType: response.headers.get("Content-Type") ?? "",
      filename: downloadFilename(response.headers.get("Content-Disposition")), bytes: await this.boundedBody(response) };
  }

  async fetchGeneratedDocument(box: MailBox, codMensaje: string, numId: string): Promise<SolFileResponse> {
    if (!/^\d+$/.test(numId)) throw new AppError("validation");
    const detail = await this.readDetail(box, codMensaje);
    if (!detail.generatedUrl || detail.files.filter((file) => file.kind === "generated_document" && file.numId === numId).length !== 1) {
      throw new AppError("schema_changed");
    }
    const { response } = await this.request(sunatUrl(detail.generatedUrl), { headers: this.visorHeaders() });
    const contentType = response.headers.get("Content-Type") ?? "";
    const bytes = await this.boundedBody(response);
    const body = bytes.toString("utf8");
    return { status: response.status, contentType, bytes,
      verifiedGeneratedDocument: response.status === 200 && contentType.toLowerCase().includes("text/html") &&
        !/j_security_check|loginMenuSol|AutenticaMenuInternet/i.test(body) };
  }

  private visorHeaders(): Headers {
    if (this.closed || !this.masterUrl) throw new AppError("remote_unavailable");
    return new Headers({ "X-Requested-With": "XMLHttpRequest", "X-Ruc": this.credential.ruc, Referer: this.masterUrl.href });
  }

  private async boundedBody(response: Response): Promise<Buffer> {
    const limit = 20 * 1024 * 1024;
    const announced = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(announced) && announced > limit) throw new AppError("schema_changed");
    if (!response.body) throw new AppError("schema_changed");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new AppError("schema_changed");
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("remote_unavailable");
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.menuReached) {
        for (const action of ["prevApp", "salir"]) {
          await this.request(sunatUrl(EXIT), { method: "POST", body: new URLSearchParams({ action }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        }
      }
    } finally { await this.cookies.removeAllCookies(); this.masterUrl = null; this.masterHtml = null; }
  }
}
