import assert from "node:assert/strict";
import test from "node:test";
import { logEvent, redactFields, setLogSink } from "./log.js";

test("operational logs never carry secrets, content or full tax identifiers", () => {
  const redacted = redactFields({
    password: "clave-ficticia", solPassword: "x", cookie: "JSESSIONID=abc", token: "t", hc: "h", state: "s",
    datosUrl: "https://example.test/?datos=1", ruc: "20999999991", desAsunto: "Asunto", body: "<p>x</p>",
    authorization: "Bearer y", runId: "0b7a", errorCode: "remote_unavailable", pages: 3, note: "cuenta 20999999991",
  });
  for (const key of ["password", "solPassword", "cookie", "token", "hc", "state", "datosUrl", "ruc", "desAsunto", "body", "authorization"]) {
    assert.equal(redacted[key], "[redacted]", key);
  }
  assert.deepEqual([redacted.runId, redacted.errorCode, redacted.pages], ["0b7a", "remote_unavailable", 3]);
  assert.equal(redacted.note, "cuenta *******9991");
  assert.equal(redactFields({ accountId: "10252431-da1f-43a1-a0b7-7ff2650a8b50" }).accountId, "10252431-da1f-43a1-a0b7-7ff2650a8b50");
  assert.equal(String(redactFields({ note: "x".repeat(500) }).note).length, 121);

  const lines: string[] = [];
  const previous = setLogSink((line) => lines.push(line));
  try { logEvent("info", "inventory_run_finished", { accountId: "a1", cookie: "secret-value" }); }
  finally { setLogSink(previous); }
  const parsed = JSON.parse(lines[0]);
  assert.deepEqual([parsed.level, parsed.event, parsed.accountId, parsed.cookie], ["info", "inventory_run_finished", "a1", "[redacted]"]);
  assert.equal(lines[0].includes("secret-value"), false);
});
