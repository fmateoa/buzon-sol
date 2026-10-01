import "reflect-metadata";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import test from "node:test";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

const ID = "00000000-0000-4000-8000-000000000001";
// Tabla de rutas publicada en openapi.yaml: separar los controllers por capacidad no puede añadir ni perder ninguna.
const ROUTES: [string, string][] = [
  ["GET", "/health"],
  ["POST", "/auth/login"], ["POST", "/auth/logout"], ["POST", "/auth/activity"], ["GET", "/auth/me"], ["PATCH", "/auth/me/preferences"],
  ["GET", "/accounts"], ["GET", "/admin/accounts"], ["GET", "/admin/account-options"], ["POST", "/admin/accounts"],
  ["PATCH", `/admin/accounts/${ID}`], ["GET", `/admin/accounts/${ID}/users`], ["PATCH", `/admin/accounts/${ID}/active`],
  ["POST", `/admin/accounts/${ID}/credential`], ["POST", `/admin/accounts/${ID}/connection-tests`],
  ["GET", `/admin/accounts/${ID}/connection-tests/${ID}`], ["GET", `/admin/accounts/${ID}/mailbox-settings`],
  ["PATCH", `/admin/accounts/${ID}/mailbox-settings`],
  ["GET", `/accounts/${ID}/schedule`], ["PATCH", `/accounts/${ID}/schedule`],
  ["GET", `/accounts/${ID}/mail`], ["GET", `/accounts/${ID}/items/${ID}`], ["GET", `/accounts/${ID}/items/${ID}/reads/${ID}`],
  ["PATCH", `/accounts/${ID}/items/${ID}/review`], ["POST", `/accounts/${ID}/items/${ID}/read`], ["GET", `/accounts/${ID}/items/${ID}/detail`],
  ["GET", `/accounts/${ID}/files/${ID}`], ["POST", `/accounts/${ID}/files/${ID}/fetch`], ["GET", `/accounts/${ID}/files/${ID}/fetches/${ID}`],
  ["GET", `/accounts/${ID}/activity`], ["GET", `/accounts/${ID}/folders`], ["GET", `/accounts/${ID}/labels`], ["GET", `/accounts/${ID}/summary`],
  ["POST", `/accounts/${ID}/inventory`], ["POST", "/inventory"], ["POST", `/accounts/${ID}/runs/${ID}/resume`],
  ["GET", `/accounts/${ID}/archive`], ["POST", `/accounts/${ID}/archive`],
  ["GET", "/admin/runs"], ["GET", "/admin/settings"], ["PATCH", "/admin/settings"], ["GET", "/audit"], ["GET", "/audit.csv"],
  ["GET", "/notices"], ["POST", `/notices/${ID}/read`],
  ["GET", "/users"], ["POST", "/users"], ["PATCH", `/users/${ID}/status`], ["PATCH", `/users/${ID}`],
  ["GET", "/roles"], ["POST", "/roles"], ["PATCH", `/roles/${ID}`],
];

test("HTTP boundary keeps the route table and validates inputs before reaching services", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const { default: db } = await import("../src/db/data-source");
  const { AppModule } = await import("../src/module");
  await db.initialize();
  await db.runMigrations();
  process.env.SOL_PUBLIC_KEY_PEM = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "pem", type: "spki" }).toString();
  process.env.SOL_KEY_ID = "test-v1";
  process.env.ACCOUNT_FINGERPRINT_KEY_B64 = randomBytes(32).toString("base64");
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.init();
  const http = app.getHttpAdapter().getInstance();
  await http.ready();
  const call = (method: string, url: string, payload?: object) => http.inject({ method: method as "GET", url: `/api/v1${url}`, payload });
  try {
    for (const [method, path] of ROUTES) {
      // Sin sesión una ruta existente responde 401 (o 400 por cuerpo inválido); solo una inexistente responde 404.
      assert.notEqual((await call(method, path)).statusCode, 404, `${method} ${path}`);
    }
    assert.equal((await call("GET", "/health")).json().status, "ok");
    const ready = await call("GET", "/health/ready");
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().checks.database, "ok");

    // Cuerpo inválido: 400 estable, sin detalle del validador.
    for (const [method, url, body] of [
      ["POST", "/auth/login", { email: 1, password: "x" }],
      ["POST", "/auth/login", { email: "a@b.cc" }],
      ["PATCH", "/auth/me/preferences", { readWarningEnabled: "true" }],
      ["PATCH", `/admin/accounts/${ID}/active`, { active: 1 }],
      ["PATCH", `/admin/accounts/${ID}/mailbox-settings`, { archiveContent: true, archiveFiles: false, archiveBatchSize: "50" }],
      ["PATCH", `/admin/accounts/${ID}/mailbox-settings`, { archiveContent: true, archiveFiles: false, archiveBatchSize: 2001 }],
      ["POST", `/accounts/${ID}/archive`, { retryFailed: "yes" }],
      ["PATCH", "/admin/settings", { values: [] }],
      ["POST", "/roles", { name: "R", permissions: ["no_such_permission"], allAccounts: false, accountIds: [] }],
      ["PATCH", `/users/${ID}/status`, { status: "deleted" }],
      ["PATCH", `/accounts/${ID}/items/${ID}/review`, { reviewed: "false" }],
    ] as [string, string, object][]) {
      const response = await call(method, url, body);
      assert.equal(response.statusCode, 400, `${method} ${url}`);
      assert.deepEqual(response.json(), { code: "validation" });
    }
    assert.deepEqual((await call("GET", `/accounts/${ID}/mail?q=a&q=b`)).json(), { code: "validation" });

    // Un cuerpo válido llega al servicio: sin sesión responde 401. Los campos no declarados se descartan.
    assert.equal((await call("PATCH", "/auth/me/preferences", { readWarningEnabled: true })).statusCode, 401);
    assert.equal((await call("POST", `/accounts/${ID}/archive`)).statusCode, 401);
    assert.equal((await call("POST", "/auth/login", { email: "nobody@example.test", password: "x", extra: "ignored" })).statusCode, 401);
    assert.equal((await call("GET", `/accounts/${ID}/mail?limit=5&state=read`)).statusCode, 401);
    assert.equal((await call("GET", "/admin/runs")).statusCode, 401);
  } finally {
    await app.close();
    await db.destroy();
  }
});
