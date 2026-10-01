import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import argon2 from "argon2";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

test("Settings drive session idle expiry, login lockout and password length", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const { default: db } = await import("../src/db/data-source");
  const { AppModule } = await import("../src/module");
  await db.initialize();
  await db.runMigrations();
  const suffix = randomUUID().slice(0, 8);
  const password = "test-password-12345";
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const [adminRole, plainRole, adminId, plainId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const adminEmail = `settings-admin-${suffix}@example.test`;
  const plainEmail = `settings-plain-${suffix}@example.test`;
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.init();
  const http = app.getHttpAdapter().getInstance();
  const request = (method: string, url: string, token?: string, body?: object) => http.inject({
    method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body,
  });
  const login = async (email: string, pass = password) => request("POST", "/api/v1/auth/login", undefined, { email, password: pass });
  const defaults = {
    "session.absoluteMinutes": 720, "session.idleMinutes": 60, "security.passwordMinLength": 12,
    "security.maxFailedLogins": 5, "security.lockoutMinutes": 15,
  };
  try {
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [adminRole, `Settings admin ${suffix}`]);
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [plainRole, `Settings plain ${suffix}`]);
    for (const permission of ["manage_settings", "manage_users_roles"]) {
      await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, permission]);
    }
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [plainRole, "view_mailbox"]);
    for (const [id, email, roleId] of [[adminId, adminEmail, adminRole], [plainId, plainEmail, plainRole]]) {
      await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [id, email, "Ficticio", hash, "active", roleId]);
    }
    await request("PATCH", "/api/v1/admin/settings", undefined, { values: defaults });

    const adminLogin = await login(adminEmail);
    assert.equal(adminLogin.statusCode, 201);
    const adminToken: string = adminLogin.json().token;
    const plainToken: string = (await login(plainEmail)).json().token;

    // Permission and shape
    assert.equal((await request("GET", "/api/v1/admin/settings", plainToken)).statusCode, 403);
    assert.equal((await request("PATCH", "/api/v1/admin/settings", plainToken, { values: { "session.idleMinutes": 10 } })).statusCode, 403);
    const listed = await request("GET", "/api/v1/admin/settings", adminToken);
    assert.equal(listed.statusCode, 200);
    const byKey = Object.fromEntries(listed.json().map((s: { key: string; value: number }) => [s.key, s.value]));
    assert.deepEqual(byKey, defaults);

    // Validation: unknown key, out of range, non-integer, idle above absolute, empty
    for (const values of [
      { "nope": 1 }, { "session.idleMinutes": 1 }, { "session.idleMinutes": 10.5 }, { "session.idleMinutes": "10" },
      { "session.absoluteMinutes": 30 }, {},
    ]) {
      assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, { values })).statusCode, 400, JSON.stringify(values));
    }
    assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, [])).statusCode, 400);

    // Idle expiry: an old session dies, a recently active one is refreshed
    assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, { values: { "session.idleMinutes": 5 } })).statusCode, 204);
    const audit: { change_json: string | object }[] = await db.query(
      "SELECT change_json FROM audit_events WHERE actor_user_id=? AND object_type='settings'", [adminId]);
    assert.equal(audit.length, 1);
    const change = typeof audit[0].change_json === "string" ? JSON.parse(audit[0].change_json) : audit[0].change_json;
    assert.deepEqual(change, { "session.idleMinutes": { from: 60, to: 5 } });
    const idleLogin = (await login(plainEmail)).json().token;
    await db.query("UPDATE app_sessions SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 MINUTE) WHERE user_id=?", [plainId]);
    // Background requests authenticate but do not keep the session alive; only the activity ping does.
    assert.equal((await request("GET", "/api/v1/auth/me", idleLogin)).statusCode, 200);
    const stale: { n: number }[] = await db.query(
      "SELECT COUNT(*) AS n FROM app_sessions WHERE user_id=? AND last_seen_at<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE)", [plainId]);
    assert.ok(Number(stale[0].n) >= 1);
    assert.equal((await request("POST", "/api/v1/auth/activity", idleLogin)).statusCode, 204);
    const touched: { fresh: number }[] = await db.query(
      "SELECT COUNT(*) AS fresh FROM app_sessions WHERE user_id=? AND last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE)", [plainId]);
    assert.ok(Number(touched[0].fresh) >= 1);
    await db.query("UPDATE app_sessions SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 10 MINUTE) WHERE user_id=?", [plainId]);
    assert.equal((await request("GET", "/api/v1/auth/me", idleLogin)).statusCode, 401);

    // Absolute duration is stamped at login
    assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, { values: { "session.absoluteMinutes": 30, "session.idleMinutes": 15 } })).statusCode, 204);
    const shortLogin = await login(plainEmail);
    const minutes = (new Date(shortLogin.json().expiresAt).getTime() - Date.now()) / 60_000;
    assert.ok(minutes > 29 && minutes <= 30, `expiresAt in ${minutes} min`);

    // Lockout after N failures; a correct password does not bypass it; expiry restores access
    assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, { values: { "security.maxFailedLogins": 3, "security.lockoutMinutes": 1 } })).statusCode, 204);
    for (let i = 0; i < 3; i++) assert.equal((await login(plainEmail, "wrong-password-xyz")).statusCode, 401);
    assert.equal((await login(plainEmail)).statusCode, 401);
    const locked: { n: number }[] = await db.query(
      "SELECT COUNT(*) AS n FROM audit_events WHERE actor_user_id=? AND action='failure'", [plainId]);
    assert.equal(Number(locked[0].n), 1);
    await db.query("UPDATE app_users SET locked_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=?", [plainId]);
    assert.equal((await login(plainEmail, "wrong-password-xyz")).statusCode, 401);
    const afterExpiry: { failed_logins: number; locked_until: Date | null }[] = await db.query(
      "SELECT failed_logins,locked_until FROM app_users WHERE id=?", [plainId]);
    assert.equal(afterExpiry[0].failed_logins, 1);
    assert.equal(afterExpiry[0].locked_until, null);
    assert.equal((await login(plainEmail)).statusCode, 201);
    const reset: { failed_logins: number }[] = await db.query("SELECT failed_logins FROM app_users WHERE id=?", [plainId]);
    assert.equal(reset[0].failed_logins, 0);

    // Password minimum applies to new users
    assert.equal((await request("PATCH", "/api/v1/admin/settings", adminToken, { values: { "security.passwordMinLength": 20 } })).statusCode, 204);
    const newUser = (name: string, pass: string) => request("POST", "/api/v1/users", adminToken,
      { name, email: `${name}-${suffix}@example.test`, password: pass, roleId: plainRole });
    assert.equal((await newUser("corta", "a".repeat(19))).statusCode, 400);
    assert.equal((await newUser("larga", "a".repeat(20))).statusCode, 201);
  } finally {
    await request("PATCH", "/api/v1/admin/settings", (await login(adminEmail)).json().token, { values: defaults });
    await app.close();
    await db.destroy();
  }
});
