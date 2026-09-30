import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { parseAlerts, parseFolders, parseLabels } from "./catalogs.js";

const fixture = (name: string) => readFileSync(join(__dirname, "../../domain/fixtures", name), "utf8");
const isCode = (code: string) => (error: unknown) => error instanceof AppError && error.code === code;

test("folders accept an empty catalog and unknown codes; malformed rows are schema changes", () => {
  assert.deepEqual(parseFolders({ contentType: "application/json", body: "[]" }), []);
  assert.deepEqual(parseFolders({ contentType: "application/json;charset=UTF-8", body: fixture("folders.json") }), [
    { code: "03", name: "Carpeta ficticia A", messageCount: 0 },
    { code: "91", name: "Carpeta ficticia B", messageCount: 4 },
  ]);
  assert.throws(() => parseFolders({ contentType: "text/html", body: "<html>login</html>" }), isCode("remote_session_expired"));
  assert.throws(() => parseFolders({ contentType: "application/json", body: "[{\"codCarpeta\":\"03\"}]" }), isCode("schema_changed"));
  assert.throws(() => parseFolders({ contentType: "application/json", body: "{\"rows\":[]}" }), isCode("schema_changed"));
});

test("labels are read from visor HTML without executing it and keep unknown codes", () => {
  const labels = parseLabels({ contentType: "text/html;charset=ISO-8859-1", body: fixture("visor-master.html") });
  assert.deepEqual(labels, [
    { code: "10", name: "ETIQUETA FICTICIA A", color: "#ce0d0e", messageCount: 3 },
    { code: "99", name: "ETIQUETA [NUEVA] FICTICIA", color: "#00afff", messageCount: 0 },
  ]);
  assert.throws(() => parseLabels({ contentType: "text/html", body: "<html><script>var x = 1;</script></html>" }), isCode("schema_changed"));
  assert.throws(() => parseLabels({ contentType: "text/html", body: "<script>var listEtiquetas = [{codEtiqueta:'10'}];</script>" }),
    isCode("schema_changed"));
  assert.throws(() => parseLabels({ contentType: "application/json", body: "[]" }), isCode("schema_changed"));
});

test("alerts keep the raw list and reject other shapes", () => {
  assert.deepEqual(parseAlerts({ contentType: "application/json", body: "{\"listaAlertas\":[]}" }), { alerts: [] });
  assert.equal(parseAlerts({ contentType: "application/json", body: "{\"listaAlertas\":[{\"x\":1}]}" }).alerts.length, 1);
  assert.throws(() => parseAlerts({ contentType: "application/json", body: "{\"listaAlertas\":null}" }), isCode("schema_changed"));
});
