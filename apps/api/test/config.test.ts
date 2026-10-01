import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { validateApiConfig } from "../src/config";

const valid = {
  SOL_PUBLIC_KEY_PEM: "pem", SOL_KEY_ID: "v1", ACCOUNT_FINGERPRINT_KEY_B64: randomBytes(32).toString("base64"),
};

test("API refuses to start without the encryption material it needs for accounts", () => {
  assert.doesNotThrow(() => validateApiConfig(valid));
  assert.throws(() => validateApiConfig({}), /SOL_PUBLIC_KEY_PEM, SOL_KEY_ID, ACCOUNT_FINGERPRINT_KEY_B64 required/);
  assert.throws(() => validateApiConfig({ ...valid, ACCOUNT_FINGERPRINT_KEY_B64: "c2hvcnQ=" }), /Invalid ACCOUNT_FINGERPRINT_KEY_B64/);
});

test("API rejects malformed ports, URLs and gates without echoing their values", () => {
  assert.throws(() => validateApiConfig({ ...valid, API_PORT: "abc" }), /Invalid API_PORT/);
  assert.throws(() => validateApiConfig({ ...valid, DB_PORT: "70000" }), /Invalid DB_PORT/);
  assert.throws(() => validateApiConfig({ ...valid, REDIS_URL: "http://secret-host" }), (error: Error) => /Invalid REDIS_URL/.test(error.message) && !error.message.includes("secret-host"));
  assert.throws(() => validateApiConfig({ ...valid, SUNAT_READ_VALIDATED: "1" }), /Invalid SUNAT_READ_VALIDATED/);
  assert.doesNotThrow(() => validateApiConfig({ ...valid, SUNAT_READ_VALIDATED: "false", REDIS_URL: "rediss://user:pw@host:6380" }));
});

test("readiness reports MySQL down as 503 without leaking why; liveness never touches dependencies", async () => {
  const { HealthController } = await import("../src/health/health.controller");
  const failing = new HealthController({ query: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:3306 user=buzon"); } } as never);
  assert.deepEqual(failing.health(), { status: "ok" });
  let status = 200;
  const reply = { status(code: number) { status = code; return this; } };
  const body = await failing.ready(reply as never);
  assert.equal(status, 503);
  assert.deepEqual(body, { status: "unavailable", checks: { database: "down", redis: "skipped" } });
  const working = await new HealthController({ query: async () => [{ 1: 1 }] } as never).ready({ status() { throw new Error("must not fail"); } } as never);
  assert.deepEqual(working, { status: "ok", checks: { database: "ok", redis: "skipped" } });
});
