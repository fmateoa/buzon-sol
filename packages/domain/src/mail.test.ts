import assert from "node:assert/strict";
import test from "node:test";
import { parseSunatDateTime, renderStructuredBody } from "./mail.js";

test("SUNAT dates are read as America/Lima and unknown formats are not guessed", () => {
  assert.equal(parseSunatDateTime("29/09/2026 18:23:54")?.toISOString(), "2026-09-29T23:23:54.000Z");
  assert.equal(parseSunatDateTime("31/12/2026 23:00:00")?.toISOString(), "2027-01-01T04:00:00.000Z");
  assert.equal(parseSunatDateTime("01/10/2026")?.toISOString(), "2026-10-01T05:00:00.000Z");
  for (const value of ["2026-09-29 18:23:54", "31/02/2026 10:00:00", "29/13/2026", "", null, 42]) {
    assert.equal(parseSunatDateTime(value), null);
  }
});

test("a JSON body becomes a table of escaped text with SUNAT's encoded values decoded", () => {
  const html = renderStructuredBody(JSON.stringify({
    des_tip_doc: "Resoluci%26%23243;n ficticia", razon_social: "EMPRESA &amp; <b>DEMO</b>", otro_campo: "100% real", vacio: "", nulo: null, numero: 7,
    oculto: "<script>bad()</script>",
  }));
  assert.equal(html, "<table><tbody><tr><th>Tipo de documento</th><td>Resolución ficticia</td></tr>" +
    "<tr><th>Razón social</th><td>EMPRESA &amp; &lt;b&gt;DEMO&lt;/b&gt;</td></tr><tr><th>otro_campo</th><td>100% real</td></tr>" +
    "<tr><th>numero</th><td>7</td></tr><tr><th>oculto</th><td>&lt;script&gt;bad()&lt;/script&gt;</td></tr></tbody></table>");
  assert.equal(renderStructuredBody("no es json"), null);
  assert.equal(renderStructuredBody("[1,2]"), null);
  assert.equal(renderStructuredBody("{}"), null);
});
