import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { SunatHttpSession } from "./http.js";
import { parseAlerts, parseFolders } from "./catalogs.js";

const credential = { ruc: "11111111111", solUser: "TESTUSER", password: "TESTPASS" };
const login = "https://api-seguridad.sunat.gob.pe/v1/clientessol/client/oauth2/loginMenuSol?originalUrl=menu&amp;state=test-state";
const master = "https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/master?hc=TEST_ONLY&token=TEST_ONLY";
const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/html", ...headers } });

test("HTTP session follows SOL login, keeps cookies per origin, and never requests detail", async () => {
  const calls: { host: string; path: string; cookie: string; referer: string | null }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({ host: url.hostname, path: url.pathname, cookie: headers.get("Cookie") ?? "", referer: headers.get("Referer") });
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form method="post" action="j_security_check"></form>', 200,
      { "Set-Cookie": "login=one; Path=/; Secure" });
    if (url.pathname.endsWith("j_security_check")) {
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("Cookie"), "login=one");
      const fields = new URLSearchParams(String(init?.body));
      assert.equal(fields.get("state"), "test-state");
      assert.equal(fields.get("custom_ruc"), credential.ruc);
      return new Response(null, { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/callback?code=TEST_ONLY" } });
    }
    if (url.pathname === "/callback") return new Response(null, { status: 302,
      headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    if (url.pathname.endsWith("MenuInternet.htm") && url.searchParams.get("action") === "buzon") {
      assert.equal(url.searchParams.get("s"), "ww1");
      return new Response(null, { status: 302, headers: { Location: master } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method !== "POST") return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html(
      `<main>Visor</main><script>var listEtiquetas = $.parseJSON('[{"codEtiqueta":"14","descEtiqueta":"Fixture","colorEtiqueta":"#fff","cantEtiqueta":0}]');</script>`, 200,
      { "Set-Cookie": "visor=two; Path=/ol-ti-itvisornoti; Secure" });
    if (url.pathname.endsWith("/visor/listNotiMenPag")) {
      assert.equal(headers.get("Cookie"), "visor=two");
      assert.equal(headers.get("X-Ruc"), credential.ruc);
      assert.equal(headers.get("Referer"), master);
      return new Response(JSON.stringify({ rows: [], records: 0, total: 0 }),
        { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.endsWith("/visor/ajax/listarCarpetas")) return new Response(
      JSON.stringify([{ codCarpeta: "03", nomCarpeta: "Fixture", cantMensajes: 0 }]),
      { headers: { "Content-Type": "application/json" } });
    if (url.pathname.endsWith("/visor/consultarAlertas")) return new Response('{"listaAlertas":[]}',
      { headers: { "Content-Type": "application/json" } });
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") {
      const action = new URLSearchParams(String(init.body)).get("action");
      if (action === "prevApp") return new Response("", { headers: { "Content-Type": "text/plain" } });
      if (action === "salir") return new Response(null, { status: 302, headers: { Location: login.replaceAll("&amp;", "&") } });
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  try {
    assert.equal(await session.testConnection(), "valid");
    assert.equal(parseFolders(await session.listFolders())[0]?.code, "03");
    assert.equal((await session.visorHtml()).contentType, "text/html");
    assert.deepEqual(parseAlerts(await session.consultAlerts()).alerts, []);
  }
  finally { await session.close(); }
  assert.equal(calls.filter((call) => call.path.endsWith("listNotiMenPag")).length, 2);
  assert.equal(calls.filter((call) => call.path.includes("obtenerDetalleNotiMen")).length, 0);
  assert.equal(calls.filter((call) => call.path.endsWith("MenuInternet.htm") && call.host === "e-menu.sunat.gob.pe").length, 5);
});

test("menu alone cannot validate connection", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) return new Response(null, { status: 302,
      headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(`<div>${credential.ruc}</div><iframe id="iframeApplication"></iframe>`);
    throw new Error("Unexpected request");
  };
  await assert.rejects(SunatHttpSession.open(credential, fakeFetch),
    (error) => error instanceof AppError && error.code === "schema_changed");
});

test("expired inventory triggers one fresh login and retries the same page", async () => {
  let logins = 0;
  let lists = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      logins++;
      return new Response(null, { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") {
      return new Response("", { headers: { "Content-Type": "text/plain" } });
    }
    if (url.searchParams.get("action") === "buzon") {
      return new Response(null, { status: 302, headers: { Location: master } });
    }
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/visor/listNotiMenPag")) {
      lists++;
      assert.equal(url.searchParams.get("page"), "3");
      return new Response(JSON.stringify({ rows: lists === 1 ? null : [] }),
        { headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  try { assert.equal(JSON.parse((await session.listPage("messages", 3)).body).rows.length, 0); }
  finally { await session.close(); }
  assert.equal(logins, 2);
  assert.equal(lists, 2);
});

test("concurrent accounts keep separate cookie jars and account headers", async () => {
  const other = { ...credential, ruc: "22222222222" };
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      const ruc = new URLSearchParams(String(init?.body)).get("custom_ruc");
      return new Response(null, { status: 302, headers: {
        Location: `https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon&account=${ruc}`,
        "Set-Cookie": `account=${ruc}; Domain=sunat.gob.pe; Path=/; Secure`,
      } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") {
      return new Response("", { headers: { "Content-Type": "text/plain" } });
    }
    if (url.searchParams.get("action") === "buzon") return new Response(null,
      { status: 302, headers: { Location: master } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${url.searchParams.get("account")}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/visor/listNotiMenPag")) {
      const ruc = headers.get("X-Ruc");
      assert.equal(headers.get("Cookie"), `account=${ruc}`);
      return new Response('{"rows":[]}', { headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected request");
  };
  const sessions = await Promise.all([credential, other].map((item) => SunatHttpSession.open(item, fakeFetch)));
  try { assert.deepEqual(await Promise.all(sessions.map((session) => session.testConnection())), ["valid", "valid"]); }
  finally { await Promise.all(sessions.map((session) => session.close())); }
});

test("explicit detail parses files and never retries an uncertain read", async () => {
  let detailCalls = 0;
  let logins = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      logins++;
      return new Response(null, { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") return new Response("", { status: 200 });
    if (url.searchParams.get("action") === "buzon") return new Response(null, { status: 302, headers: { Location: master } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/visor/obtenerDetalleNotiMen")) {
      detailCalls++;
      assert.equal(url.searchParams.get("codigoMensaje"), "123");
      assert.equal(url.searchParams.get("tipoMsj"), "2");
      if (detailCalls === 2) return html("<html>login</html>");
      return new Response(JSON.stringify({ msjMensaje: "{}", indTexto: 3, updateLeido: false,
        url: "/cl-ti-iagenerador/gendocS01Alias?accion=genhtml&iddoc=fixture",
        listAttach: [{ codArchivo: null, numId: 55 }, { codArchivo: 0, nomArchivo: "fixture.pdf" }] }),
      { headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  try {
    const detail = await session.readDetail("notifications", "123");
    assert.equal(detail.indTexto, "3");
    assert.equal(detail.generatedUrl?.startsWith("https://ww1.sunat.gob.pe/cl-ti-iagenerador/gendocS01Alias?"), true);
    assert.deepEqual(detail.files.map((file) => [file.kind, file.codArchivo]),
      [["generated_document", null], ["attachment", "0"]]);
    await assert.rejects(session.readDetail("notifications", "123"),
      (error) => error instanceof AppError && error.code === "remote_session_expired");
  } finally { await session.close(); }
  assert.equal(detailCalls, 2);
  assert.equal(logins, 1);
});

test("attachment zero and generated HTML follow their own detail in the same session", async () => {
  const sequence: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) return new Response(null,
      { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") return new Response("", { status: 200 });
    if (url.searchParams.get("action") === "buzon") return new Response(null, { status: 302, headers: { Location: master } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/visor/obtenerDetalleNotiMen")) {
      sequence.push("detail");
      if (url.searchParams.get("codigoMensaje") === "456") return new Response(JSON.stringify({
        msjMensaje: "Fixture", updateLeido: false,
        listAttach: [{ codArchivo: 0 }, { codArchivo: 0 }],
      }), { headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ msjMensaje: "<p>Fixture</p>", updateLeido: false,
        url: "/cl-ti-iagenerador/gendocS01Alias?accion=genhtml&iddoc=fixture",
        listAttach: [{ codArchivo: 0, nomArchivo: "fixture.pdf" }, { codArchivo: null, numId: 55 }] }),
      { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.endsWith(`/visor/bajarArchivo/0/0/0/${credential.ruc}`)) {
      sequence.push("attachment");
      return new Response("%PDF-fixture", { headers: { "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=fixture.pdf" } });
    }
    if (url.pathname.endsWith("/cl-ti-iagenerador/gendocS01Alias")) {
      sequence.push("generated");
      return html("<html><body>Fixture</body></html>");
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  try {
    const attachment = await session.fetchAttachment("messages", "123", "0");
    assert.equal(attachment.contentType, "application/pdf");
    assert.equal(attachment.filename, "fixture.pdf");
    assert.equal(attachment.bytes.subarray(0, 5).toString(), "%PDF-");
    const generated = await session.fetchGeneratedDocument("messages", "123", "55");
    assert.equal(generated.verifiedGeneratedDocument, true);
    assert.deepEqual(sequence, ["detail", "attachment", "detail", "generated"]);
    await assert.rejects(session.fetchAttachment("messages", "456", "0"),
      (error) => error instanceof AppError && error.code === "schema_changed");
  } finally { await session.close(); }
});

test("remote filters use observed parameters; label queries drop box and folder", async () => {
  const queries: URLSearchParams[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      return new Response(null, { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") return new Response("", { headers: { "Content-Type": "text/plain" } });
    if (url.searchParams.get("action") === "buzon") return new Response(null, { status: 302, headers: { Location: master } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/visor/listNotiMenPag")) {
      queries.push(url.searchParams);
      return new Response(JSON.stringify({ rows: [] }), { headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  try {
    await session.listPage("messages", 1, { desAsunto: "ñandú", tipoOrden: "NO_LEIDOS" });
    await session.listPage("notifications", 1, { codEtiqueta: "07" });
  } finally { await session.close(); }
  assert.equal(queries[0]?.get("des_asunto"), "ñandú");
  assert.equal(queries[0]?.get("tipoOrden"), "NO_LEIDOS");
  assert.equal(queries[0]?.get("tipoMsj"), "1");
  assert.equal(queries[1]?.get("codEtiqueta"), "07");
  assert.equal(queries[1]?.get("tipoMsj"), "");
  assert.equal(queries[1]?.get("codCarpeta"), "");
});

test("rejected SOL credential ends at the error page and is invalid_credential, not schema_changed", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      return new Response(null, { status: 302, headers: { Location: "https://api-seguridad.sunat.gob.pe/v1/clientessol/client/oauth2/error" } });
    }
    if (url.pathname.endsWith("/error")) return html("<p>error</p>");
    throw new Error("Unexpected request");
  };
  await assert.rejects(SunatHttpSession.open(credential, fakeFetch),
    (error) => error instanceof AppError && error.code === "invalid_credential");
});

test("close replays the menu's remote exit: prevApp, gettime.pl, visor logout POST, then salir", async () => {
  const calls: string[] = [];
  let logoutBody = "";
  const logoutPath = "/ol-ti-itvisornoti/visor/master?logout";
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "www.sunat.gob.pe") return html(`<a href="${login}">Buzón</a>`);
    if (url.pathname.endsWith("loginMenuSol")) return html('<form action="j_security_check"></form>');
    if (url.pathname.endsWith("j_security_check")) {
      return new Response(null, { status: 302, headers: { Location: "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?exe=buzon" } });
    }
    if (url.pathname.endsWith("MenuInternet.htm") && init?.method === "POST") {
      const action = new URLSearchParams(String(init.body)).get("action") ?? "";
      calls.push(action);
      if (action === "prevApp" && calls.filter((c) => c === "prevApp").length === 2) {
        return new Response(logoutPath, { headers: { "Content-Type": "text/plain" } });
      }
      return new Response("", { headers: { "Content-Type": "text/plain" } });
    }
    if (url.searchParams.get("action") === "buzon") return new Response(null, { status: 302, headers: { Location: master } });
    if (url.pathname.endsWith("MenuInternet.htm")) return html(
      `<div>${credential.ruc}</div><script>function cargaBuzon(){logoutAndLoad('MenuInternet.htm?action=buzon');}</script>`);
    if (url.pathname.endsWith("/visor/master") && !url.search.includes("logout")) return html("<main>Visor</main>");
    if (url.pathname.endsWith("/time/gettime.pl")) {
      calls.push("gettime");
      assert.equal(url.searchParams.get("a"), "o");
      assert.equal(url.searchParams.get("u"), logoutPath);
      assert.equal(url.hostname, "ww1.sunat.gob.pe");
      return html("<html></html>");
    }
    if (url.pathname.endsWith("/visor/master") && url.search === "?logout") {
      calls.push("visor-logout");
      assert.equal(init?.method, "POST");
      logoutBody = String(init?.body);
      assert.equal(new Headers(init?.headers).get("X-Requested-With"), "XMLHttpRequest");
      return new Response("", { headers: { "Content-Type": "text/plain" } });
    }
    throw new Error("Unexpected request");
  };
  const session = await SunatHttpSession.open(credential, fakeFetch);
  await session.close();
  assert.deepEqual(calls, ["prevApp", "prevApp", "gettime", "visor-logout", "salir"]);
  assert.equal(logoutBody, "logout");
});
