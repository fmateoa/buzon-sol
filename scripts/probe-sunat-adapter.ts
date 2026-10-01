/** Reads one authorized test credential from stdin; emits only redacted verdicts. */
import { createHash } from "node:crypto";
import { parseAlerts, parseFolders, parseInventoryPage, parseLabels, scanBox, SunatHttpSession } from "../packages/sunat-adapter/src/index.js";

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

async function isolationProbe(credentials: Credential[]): Promise<object> {
  if (credentials.length < 2 || new Set(credentials.map((entry) => entry.ruc)).size !== credentials.length) throw new Error("need_distinct_accounts");
  const sessions = await Promise.all(credentials.map((entry) => SunatHttpSession.open(entry)));
  try {
    const fingerprints: string[][] = sessions.map(() => []);
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all(sessions.map(async (session) => {
        const parts: string[] = [];
        for (const box of ["messages", "notifications"] as const) {
          const page = parseInventoryPage(await session.listPage(box, 1), box);
          parts.push(page.rows.map((row) => `${row.codMensaje}:${row.indEstado}`).join(","), String(page.declaredRecords));
        }
        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
      }));
      results.forEach((value, index) => fingerprints[index]!.push(value));
    }
    const stable = fingerprints.map((values) => new Set(values).size === 1);
    const distinct = new Set(fingerprints.map((values) => values[0])).size === sessions.length;
    return { accounts: sessions.length, parallelRounds: 3, eachAccountStable: stable.every(Boolean), accountsDistinct: distinct };
  } finally { await Promise.all(sessions.map((session) => session.close())); }
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
      try { result.folders = { count: parseFolders(await session.listFolders()).length }; }
      catch (error) { result.folders = { error: error instanceof Error && "code" in error ? error.code : "probe_failed" }; }
      try { result.labels = { count: parseLabels(await session.visorHtml()).length }; }
      catch (error) { result.labels = { error: error instanceof Error && "code" in error ? error.code : "probe_failed" }; }
      try { result.alerts = { count: parseAlerts(await session.consultAlerts()).alerts.length }; }
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
  if (mode === "--logout-cookies") {
    let protectedRequest: { url: URL; headers: Headers } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag")) protectedRequest = { url, headers: new Headers(init?.headers) };
      return fetch(input, init);
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try { await session.testConnection(); } finally { await session.close(); }
    if (!protectedRequest) throw new Error("missing_protected_request");
    const pairs = (protectedRequest.headers.get("Cookie") ?? "").split(/;\s*/).filter(Boolean);
    const accessible = async (cookies: string[]) => {
      const headers = new Headers(protectedRequest!.headers);
      if (cookies.length) headers.set("Cookie", cookies.join("; ")); else headers.delete("Cookie");
      const response = await fetch(protectedRequest!.url, { headers, redirect: "manual", signal: AbortSignal.timeout(25_000) });
      if (!response.headers.get("Content-Type")?.includes("application/json")) return false;
      try { return Array.isArray((await response.json() as { rows?: unknown }).rows); } catch { return false; }
    };
    const names = pairs.map((pair) => pair.split("=")[0]!.replace(/\d{6,}/g, "#"));
    const result: object[] = [{ variant: "all", accessible: await accessible(pairs) }];
    for (let i = 0; i < pairs.length; i++) {
      result.push({ variant: `without:${names[i]}`, accessible: await accessible(pairs.filter((_, j) => j !== i)) });
      result.push({ variant: `only:${names[i]}`, accessible: await accessible([pairs[i]!]) });
    }
    return { cookieNames: names, result };
  }
  if (mode === "--master-logout-js") {
    let menu = "";
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const response = await fetch(input, init);
      if (url.pathname.endsWith("/MenuInternet.htm") && init?.method !== "POST" && !menu) {
        const text = await response.clone().text();
        if (text.includes(credential.ruc)) menu = text;
      }
      return response;
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try {
      const mask = (text: string) => text.replace(/[A-Za-z0-9_\-]{24,}/g, "X").replace(/\d{6,}/g, "#").replace(/\s+/g, " ");
      const find = (text: string, word: RegExp, max: number) => [...text.matchAll(word)].slice(0, max)
        .map((m) => mask(text.slice(Math.max(0, (m.index ?? 0) - 240), (m.index ?? 0) + 360)));
      const occurrences = (word: string) => {
        const out: string[] = [];
        for (let at = menu.indexOf(word); at >= 0 && out.length < 12; at = menu.indexOf(word, at + word.length)) {
          const prev = menu[at - 1] ?? "";
          if (/[A-Za-z0-9_]/.test(prev)) continue;
          out.push(mask(menu.slice(Math.max(0, at - 50), at + 110)));
        }
        return out;
      };
      return { menuBytes: menu.length, dominioOcc: occurrences("dominio").filter((t) => /(var|let|const|=)\s*\S*dominio|dominio\s*=/.test(t) || true).slice(0, 8),
        randomOcc: occurrences("randomCookie").slice(0, 8) };
    } finally { await session.close(); }
  }
  if (mode === "--logout-delay") {
    let protectedRequest: { url: URL; headers: Headers } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag")) protectedRequest = { url, headers: new Headers(init?.headers) };
      return fetch(input, init);
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try { await session.testConnection(); } finally { await session.close(); }
    if (!protectedRequest) throw new Error("missing_protected_request");
    const accessible = async () => {
      const response = await fetch(protectedRequest!.url, { headers: protectedRequest!.headers, redirect: "manual", signal: AbortSignal.timeout(25_000) });
      if (!response.headers.get("Content-Type")?.includes("application/json")) return false;
      try { return Array.isArray((await response.json() as { rows?: unknown }).rows); } catch { return false; }
    };
    const checks: object[] = [];
    let waited = 0;
    for (const at of [0, 3, 6, 8, 10, 12, 14, 20]) {
      await new Promise((resolve) => setTimeout(resolve, (at - waited) * 1000));
      waited = at;
      checks.push({ afterSeconds: at, accessible: await accessible() });
    }
    return { checks };
  }
  if (mode === "--collision-check") {
    // ¿Cerrar una sesión de la cuenta afecta a otra sesión simultánea o abierta justo después?
    const works = async (session: SunatHttpSession) => {
      try { parseInventoryPage(await session.listPage("messages", 1), "messages"); return true; } catch { return false; }
    };
    const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    const first = await SunatHttpSession.open(credential);
    const parallel = await SunatHttpSession.open(credential);
    const result: Record<string, unknown> = { bothWorkBeforeClose: (await works(first)) && (await works(parallel)) };
    await first.close();
    result.parallelRightAfterCloseOfFirst = await works(parallel);
    const afterClose = await SunatHttpSession.open(credential); // login inmediato tras cerrar la primera
    result.newLoginRightAfterClose = await works(afterClose);
    await wait(25); // pasa la ventana de gracia del cierre
    result.parallelAfter25s = await works(parallel);
    result.newLoginAfter25s = await works(afterClose);
    await parallel.close();
    await wait(25);
    result.lastAfterParallelClosed25s = await works(afterClose);
    await afterClose.close();
    return result;
  }
  if (mode === "--read-unread-check") {
    // S-14, autorizado por el usuario en el chat: abre UN Mensaje sin leer (el más antiguo de la cuenta) para validar 0 -> 1.
    // Efecto esperado en SUNAT: indEstado 0 -> 1, irreversible. No imprime identificadores, asuntos ni contenido.
    const session = await SunatHttpSession.open(credential);
    try {
      const rowsOf = async (page: number) => parseInventoryPage(await session.listPage("messages", page), "messages").rows;
      let high = 1;
      while ((await rowsOf(high)).length > 0 && high < 2048) high *= 2;
      let low = Math.floor(high / 2);
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if ((await rowsOf(mid)).length > 0) low = mid; else high = mid;
      }
      let target: { page: number; codMensaje: string } | null = null;
      for (let page = low; page >= 1 && !target; page--) {
        const row = (await rowsOf(page)).reverse().find((entry) => entry.indEstado === 0);
        if (row) target = { page, codMensaje: row.codMensaje };
      }
      if (!target) return { foundUnread: false, lastPage: low };
      const stateOf = async (client: SunatHttpSession) => (await parseInventoryPage(await client.listPage("messages", target!.page), "messages")
        .rows.find((entry) => entry.codMensaje === target!.codMensaje))?.indEstado ?? null;
      const before = await stateOf(session);
      process.stderr.write(JSON.stringify({ intent: "readContent", box: "messages", expected: "indEstado 0->1 (irreversible)",
        stateBefore: before, at: new Date().toISOString() }) + "\n");
      if (before !== 0) return { foundUnread: true, aborted: "state_not_unread_before_read", stateBefore: before };
      const detail = await session.readDetail("messages", target.codMensaje);
      const polls: (number | null)[] = [];
      for (let attempt = 0; attempt < 7; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 10_000));
        polls.push(await stateOf(session));
        if (polls.at(-1) === 1) break;
      }
      const fresh = await SunatHttpSession.open(credential);
      let afterFresh: number | null;
      try { afterFresh = await stateOf(fresh); } finally { await fresh.close(); }
      const again = await session.readDetail("messages", target.codMensaje);
      return { foundUnread: true, lastPage: low, stateBefore: before, updateLeido: detail.updateLeido,
        indTexto: detail.indTexto === "1" || detail.indTexto === "3" ? detail.indTexto : "other",
        attachmentCount: detail.files.filter((file) => file.kind === "attachment").length,
        statePolls: polls, stateAfterFreshSession: afterFresh, secondReadUpdateLeido: again.updateLeido,
        transitioned: before === 0 && afterFresh === 1 };
    } finally { await session.close(); }
  }
  if (mode === "--logout-diagnose") {
    // Solo estructura de la respuesta de "salir": hosts, rutas sin query, palabras clave y cabeceras de redirección.
    const captured: object[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const response = await fetch(input, init);
      if (url.pathname.endsWith("/time/gettime.pl")) {
        const text = await response.clone().text();
        captured.push({ gettime: true, status: response.status, contentType: (response.headers.get("Content-Type") ?? "").split(";")[0],
          bytes: text.length, body: text.length < 1500 ? text.replace(/\d{6,}/g, "#").replace(/[A-Za-z0-9_\-]{24,}/g, "X") : null,
          setCookieNames: response.headers.getSetCookie().map((c) => c.split("=")[0]!.replace(/\d{6,}/g, "#")),
          queryKeys: [...url.searchParams.keys()] });
      }
      if (url.pathname.endsWith("/visor/master") && url.search === "?logout" && init?.method === "POST") {
        const text = await response.clone().text();
        captured.push({ visorLogoutPost: true, status: response.status, contentType: (response.headers.get("Content-Type") ?? "").split(";")[0],
          bytes: text.length, body: text.length < 300 ? text.replace(/\d{6,}/g, "#").replace(/[A-Za-z0-9_\-]{24,}/g, "X") : null,
          setCookieNames: response.headers.getSetCookie().map((c) => c.split("=")[0]!.replace(/\d{6,}/g, "#")) });
      }
      if (url.pathname.endsWith("/visor/master") && url.search === "?logout") {
        const text = await response.clone().text();
        captured.push({ visorLogoutGet: true, status: response.status, contentType: (response.headers.get("Content-Type") ?? "").split(";")[0],
          bytes: text.length, hasAjaxLogout: /logout/i.test(text), hasPost: /POST/i.test(text),
          setsCookieCount: response.headers.getSetCookie().length });
      }
      if (url.pathname.endsWith("/MenuInternet.htm") && init?.method !== "POST") {
        const text = await response.clone().text();
        captured.push({ get: "MenuInternet", status: response.status, containsRuc: text.includes(credential.ruc),
          hasLoginForm: /j_security_check/.test(text), hasBuzonMenu: /cargaBuzon/.test(text) });
      }
      if (url.pathname.endsWith("/MenuInternet.htm") && init?.method === "POST") {
        const text = await response.clone().text();
        const urls = [...text.matchAll(/https?:\/\/[^\s"'<>\)]+/gi)].map((m) => { try { const u = new URL(m[0]); return u.hostname + u.pathname; } catch { return "invalid"; } });
        captured.push({ status: response.status, contentType: (response.headers.get("Content-Type") ?? "").split(";")[0],
          locationLeaf: (() => { const l = response.headers.get("Location"); if (!l) return null; try { const u = new URL(l, url); return u.hostname + u.pathname; } catch { return "invalid"; } })(),
          bytes: text.length, masked: text.length < 80 ? text.replace(/[A-Za-z0-9]+/g, (w) => w.toLowerCase() === "logout" ? w : w.length <= 4 ? w.replace(/\d/g, "9") : "X" + w.length) : null, urlsInBody: [...new Set(urls)].slice(0, 12),
          keywords: Object.fromEntries(["authen", "logout", "location", "submit", "salir"].map((k) => [k, (text.match(new RegExp(k, "gi")) ?? []).length])) });
      }
      return response;
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    await session.close();
    return { postResponses: captured };
  }
  if (mode === "--login-diagnose") {
    const steps: { host: string; leaf: string; method: string; status: number }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const response = await fetch(input, init);
      steps.push({ host: url.hostname, leaf: url.pathname.split("/").filter(Boolean).at(-1) ?? "", method: init?.method ?? "GET", status: response.status });
      return response;
    };
    try { await (await SunatHttpSession.open(credential, fetcher)).close(); return { ok: true, steps }; }
    catch (error) { return { ok: false, error: error instanceof Error && "code" in error ? error.code : "probe_failed", steps }; }
  }
  if (mode === "--search-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const result = [];
      const ids = async (box: "messages" | "notifications", filter: object) => {
        const all = new Set<string>();
        for (let page = 1; page <= 50; page++) {
          const rows = parseInventoryPage(await session.listPage(box, page, filter), box).rows;
          if (rows.length === 0) break;
          for (const row of rows) all.add(`${box}:${row.codMensaje}`);
        }
        return all;
      };
      for (const box of ["messages", "notifications"] as const) {
        const base = await ids(box, {});
        const first = parseInventoryPage(await session.listPage(box, 1), box).rows[0];
        const word = typeof first?.desAsunto === "string"
          ? first.desAsunto.split(/\s+/).find((w) => w.length >= 5 && /^[\p{L}\d]+$/u.test(w)) : undefined;
        const search = word ? await ids(box, { desAsunto: word }) : null;
        const miss = await ids(box, { desAsunto: "zzqxj" + Date.now() });
        const orders: Record<string, number> = {};
        for (const order of ["LEIDOS", "NO_LEIDOS"]) {
          try { orders[order] = (await ids(box, { tipoOrden: order })).size; } catch { orders[order] = -1; }
        }
        result.push({ box, baseRows: base.size, searchUsedWord: !!word, searchRows: search?.size ?? null,
          searchSubsetOfBase: search ? [...search].every((id) => base.has(id)) : null,
          searchNarrowed: search ? search.size >= 1 && search.size <= base.size : null,
          noMatchRows: miss.size, orderRows: orders });
      }
      return { search: result };
    } finally { await session.close(); }
  }
  if (mode === "--label-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const labels = parseLabels(await session.visorHtml());
      const result = [];
      for (const label of labels.slice(0, 12)) {
        const rows: string[] = [];
        let error: string | null = null;
        try {
          for (let page = 1; page <= 50; page++) {
            const current = parseInventoryPage(await session.listPage("messages", page, { codEtiqueta: label.code }), "any");
            if (current.rows.length === 0) break;
            rows.push(...current.rows.map((row) => `${row.indTipmsj ?? ""}:${row.codMensaje}`));
          }
        } catch (caught) { error = caught instanceof Error && "code" in caught ? String(caught.code) : "probe_failed"; }
        result.push({ declared: label.messageCount, returned: rows.length, uniqueReturned: new Set(rows).size,
          messages: rows.filter((id) => id.startsWith("1:")).length, notifications: rows.filter((id) => id.startsWith("2:")).length, error });
      }
      return { labelsQueried: result.length, labels: result };
    } finally { await session.close(); }
  }
  if (mode === "--schema-check") {
    const session = await SunatHttpSession.open(credential);
    try {
      const result = [];
      for (const box of ["messages", "notifications"] as const) {
        const rows = parseInventoryPage(await session.listPage(box, 1), box).rows;
        const types = new Map<string, Set<string>>();
        for (const row of rows) for (const [key, value] of Object.entries(row)) {
          const set = types.get(key) ?? new Set<string>();
          set.add(value === null ? "null" : typeof value);
          types.set(key, set);
        }
        result.push({ box, rows: rows.length,
          fields: Object.fromEntries([...types].sort().map(([key, set]) => [key, [...set].sort().join("|")])) });
      }
      return { listSchema: result, labels: parseLabels(await session.visorHtml()).length >= 0 };
    } finally { await session.close(); }
  }
  if (mode === "--capacity-check") {
    const timed = async <T>(work: () => Promise<T>): Promise<[T, number]> => {
      const started = Date.now();
      return [await work(), Date.now() - started];
    };
    const [session, loginMs] = await timed(() => SunatHttpSession.open(credential));
    try {
      const listMs: number[] = [];
      const detailMs: number[] = [];
      const fileMs: number[] = [];
      let fileBytes = 0;
      for (const box of ["messages", "notifications"] as const) {
        const [page, ms] = await timed(() => session.listPage(box, 1));
        listMs.push(ms);
        const rows = parseInventoryPage(page, box).rows.filter((row) => row.indEstado !== 0).slice(0, 3);
        for (const row of rows) {
          const [detail, dms] = await timed(() => session.readDetail(box, row.codMensaje));
          if (detail.updateLeido === true) throw new Error("already_read_state_changed");
          detailMs.push(dms);
          const file = detail.files.find((entry) => entry.kind === "attachment");
          if (file?.codArchivo) {
            const [response, fms] = await timed(() => session.fetchAttachment(box, row.codMensaje, file.codArchivo!));
            fileMs.push(fms);
            fileBytes += response.bytes.length;
          }
        }
      }
      const summary = (values: number[]) => values.length === 0 ? null :
        { n: values.length, minMs: Math.min(...values), maxMs: Math.max(...values),
          avgMs: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
      return { loginMs, list: summary(listMs), detail: summary(detailMs), file: summary(fileMs), fileBytes };
    } finally { await session.close(); }
  }
  if (mode === "--logout-lifetime") {
    // Tras la salida observada, repite la petición protegida capturada cada minuto hasta perder acceso o agotar el tiempo.
    const minutes = Number(process.env.SUNAT_PROBE_MINUTES ?? "15");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error("invalid_duration");
    let protectedRequest: { url: URL; headers: Headers } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/visor/listNotiMenPag")) protectedRequest = { url, headers: new Headers(init?.headers) };
      return fetch(input, init);
    };
    const session = await SunatHttpSession.open(credential, fetcher);
    try { await session.testConnection(); } finally { await session.close(); }
    if (!protectedRequest) throw new Error("missing_protected_request");
    const accessible = async () => {
      const response = await fetch(protectedRequest!.url, { headers: protectedRequest!.headers, redirect: "manual",
        signal: AbortSignal.timeout(25_000) });
      if (!response.headers.get("Content-Type")?.includes("application/json")) return false;
      try { return Array.isArray((await response.json() as { rows?: unknown }).rows); } catch { return false; }
    };
    const accessByMinute: number[] = [];
    let lostAtMinute: number | null = null;
    if (await accessible()) accessByMinute.push(0);
    else lostAtMinute = 0;
    for (let minute = 1; minute <= minutes && lostAtMinute === null; minute++) {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      if (await accessible()) accessByMinute.push(minute);
      else lostAtMinute = minute;
    }
    return { observedMinutes: minutes, lostAtMinute, lastAccessibleMinute: accessByMinute.at(-1) ?? null };
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
    const parsed = JSON.parse(input) as Credential | { accounts: Credential[] };
    if ("accounts" in parsed) {
      if (mode !== "--isolation-check" || !parsed.accounts.every((entry) => /^\d{11}$/.test(entry.ruc) && entry.solUser && entry.password)) {
        throw new Error("credential_shape");
      }
      process.stdout.write(JSON.stringify(await isolationProbe(parsed.accounts)) + "\n");
      return;
    }
    const credential = parsed;
    if (!/^\d{11}$/.test(credential.ruc) || !credential.solUser || !credential.password) throw new Error("credential_shape");
    process.stdout.write(JSON.stringify(await probe(credential)) + "\n");
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error instanceof Error && "code" in error ? error.code : "probe_failed" }) + "\n");
    process.exitCode = 1;
  }
}

void main();
