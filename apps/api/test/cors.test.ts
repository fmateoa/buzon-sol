import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { corsHook } from "../src/common/cors";
import { setSessionCookies } from "../src/auth/session-cookie";

const WEB = "https://buzon.example.com";
const app = (env: Record<string, string | undefined>) => {
  const f = Fastify();
  f.addHook("onRequest", corsHook(env));
  f.get("/x", async () => ({ ok: true }));
  f.post("/set", async (_req, reply) => { setSessionCookies(reply, "t".repeat(43), new Date(Date.now() + 60_000)); return {}; });
  return f;
};

test("sin CORS_ALLOWED_ORIGINS no se agrega ninguna cabecera CORS", async () => {
  const res = await app({}).inject({ method: "GET", url: "/x", headers: { origin: WEB } });
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("solo el origen listado recibe credenciales; otro origen no", async () => {
  const f = app({ CORS_ALLOWED_ORIGINS: `${WEB}, https://otro.example.com` });
  const ok = await f.inject({ method: "GET", url: "/x", headers: { origin: WEB } });
  assert.equal(ok.headers["access-control-allow-origin"], WEB);
  assert.equal(ok.headers["access-control-allow-credentials"], "true");
  assert.match(String(ok.headers.vary), /Origin/);
  const bad = await f.inject({ method: "GET", url: "/x", headers: { origin: "https://malo.example.com" } });
  assert.equal(bad.headers["access-control-allow-origin"], undefined);
  assert.equal((await f.inject({ method: "GET", url: "/x", headers: { origin: `${WEB}.malo.com` } })).headers["access-control-allow-origin"], undefined);
});

test("el preflight responde 204 con métodos y cabeceras del cliente web", async () => {
  const res = await app({ CORS_ALLOWED_ORIGINS: WEB }).inject({
    method: "OPTIONS", url: "/api/v1/accounts",
    headers: { origin: WEB, "access-control-request-method": "POST", "access-control-request-headers": "x-csrf-token,content-type" },
  });
  assert.equal(res.statusCode, 204);
  assert.match(String(res.headers["access-control-allow-headers"]), /X-CSRF-Token/);
  assert.match(String(res.headers["access-control-allow-methods"]), /PATCH/);
});

test("SESSION_COOKIE_DOMAIN comparte solo la cookie CSRF con el subdominio de la web", async () => {
  const previous = process.env.SESSION_COOKIE_DOMAIN;
  process.env.SESSION_COOKIE_DOMAIN = ".example.com";
  try {
    const set = (await app({}).inject({ method: "POST", url: "/set" })).headers["set-cookie"] as string[];
    assert.match(set.find((c) => c.startsWith("bz_csrf="))!, /Domain=example\.com/);
    assert.doesNotMatch(set.find((c) => c.startsWith("bz_session="))!, /Domain=/);
  } finally {
    if (previous === undefined) delete process.env.SESSION_COOKIE_DOMAIN; else process.env.SESSION_COOKIE_DOMAIN = previous;
  }
});
