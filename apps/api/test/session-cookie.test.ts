import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { clearSessionCookies, cookieSessionHook, parseCookies, setSessionCookies } from "../src/session-cookie";

const app = () => {
  const f = Fastify();
  f.addHook("onRequest", cookieSessionHook);
  f.get("/x", async (req) => ({ auth: req.headers.authorization ?? null }));
  f.post("/x", async (req) => ({ auth: req.headers.authorization ?? null }));
  f.post("/auth/login", async (req) => ({ auth: req.headers.authorization ?? null }));
  f.post("/set", async (_req, reply) => { setSessionCookies(reply, "t".repeat(43), new Date(Date.now() + 60_000)); return {}; });
  f.post("/clear", async (_req, reply) => { clearSessionCookies(reply); return {}; });
  return f;
};

test("parseCookies lee pares y tolera basura", () => {
  assert.deepEqual(parseCookies("a=1; b=2=3; =x; c"), { a: "1", b: "2=3" });
  assert.deepEqual(parseCookies(undefined), {});
});

test("la cookie de sesión se convierte en Bearer; los POST exigen CSRF", async () => {
  const f = app();
  const cookie = "bz_session=tok; bz_csrf=abc";
  assert.equal((await f.inject({ method: "GET", url: "/x", headers: { cookie } })).json().auth, "Bearer tok");
  assert.equal((await f.inject({ method: "POST", url: "/x", headers: { cookie } })).statusCode, 403);
  assert.equal((await f.inject({ method: "POST", url: "/x", headers: { cookie, "x-csrf-token": "otro" } })).statusCode, 403);
  const ok = await f.inject({ method: "POST", url: "/x", headers: { cookie, "x-csrf-token": "abc" } });
  assert.equal(ok.json().auth, "Bearer tok");
});

test("Bearer explícito, sin cookie y login no se tocan", async () => {
  const f = app();
  assert.equal((await f.inject({ method: "POST", url: "/x", headers: { authorization: "Bearer z", cookie: "bz_session=tok" } })).json().auth, "Bearer z");
  assert.equal((await f.inject({ method: "GET", url: "/x" })).json().auth, null);
  assert.equal((await f.inject({ method: "POST", url: "/auth/login", headers: { cookie: "bz_session=vieja" } })).json().auth, null);
});

test("las cookies de sesión son HttpOnly y SameSite=Strict; la CSRF es legible; logout las borra", async () => {
  const f = app();
  const set = (await f.inject({ method: "POST", url: "/set" })).headers["set-cookie"] as string[];
  const session = set.find((c) => c.startsWith("bz_session="))!, csrf = set.find((c) => c.startsWith("bz_csrf="))!;
  assert.match(session, /HttpOnly/); assert.match(session, /SameSite=Strict/); assert.match(session, /Path=\/api\/v1/);
  assert.doesNotMatch(csrf, /HttpOnly/);
  const cleared = (await f.inject({ method: "POST", url: "/clear" })).headers["set-cookie"] as string[];
  assert.ok(cleared.every((c) => /Expires=Thu, 01 Jan 1970/.test(c)));
});
