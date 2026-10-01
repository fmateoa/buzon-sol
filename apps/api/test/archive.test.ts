import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import argon2 from "argon2";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

const gates = ["SUNAT_TRANSPORT_VALIDATED", "SUNAT_READ_VALIDATED", "SUNAT_CRON_VALIDATED"] as const;

test("mailbox archive settings, status and multi-account commands respect permissions, scope and gates",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const { default: db } = await import("../src/db/data-source");
  const { AppModule } = await import("../src/module");
  await db.initialize();
  await db.runMigrations();
  const previous = gates.map((name) => process.env[name]);
  for (const name of gates) delete process.env[name];
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.init();
  const http = app.getHttpAdapter().getInstance();
  const request = (method: string, url: string, token?: string, body?: object) => http.inject({
    method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body,
  });
  const suffix = randomUUID().slice(0, 8);
  const password = "test-password-12345";
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const a = randomUUID(), b = randomUUID();
  const user = async (name: string, permissions: string[], accounts: string[] | "all") => {
    const roleId = randomUUID(), userId = randomUUID(), email = `${name}-${suffix}@example.test`;
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,?)", [roleId, `${name} ${suffix}`, accounts === "all"]);
    for (const permission of permissions) await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, permission]);
    if (accounts !== "all") for (const id of accounts) await db.query("INSERT INTO role_sunat_accounts (role_id,account_id) VALUES (?,?)", [roleId, id]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [userId, email, name, hash, "active", roleId]);
    const login = await request("POST", "/api/v1/auth/login", undefined, { email, password });
    return { id: userId, token: login.json().token as string };
  };
  try {
    for (const [id, alias] of [[a, "Empresa A"], [b, "Empresa B"]]) {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [id, `${alias} ${suffix}`, Buffer.from("fictional"), Buffer.from("fictional")]);
    }
    const admin = await user("admin", ["manage_accounts", "view_mailbox", "run_inventory", "read_content", "configure_schedule"], "all");
    const operator = await user("operator", ["view_mailbox", "run_inventory", "read_content"], [a]);
    const viewer = await user("viewer", ["view_mailbox"], [a]);

    // Settings: off by default, admin only, files need content, each account keeps its own.
    const settingsUrl = (id: string) => `/api/v1/admin/accounts/${id}/mailbox-settings`;
    assert.deepEqual((await request("GET", settingsUrl(a), admin.token)).json(),
      { accountId: a, archiveContent: false, archiveFiles: false, archiveBatchSize: 200 });
    assert.equal((await request("GET", settingsUrl(a), operator.token)).statusCode, 403);
    assert.equal((await request("PATCH", settingsUrl(a), operator.token,
      { archiveContent: true, archiveFiles: false, archiveBatchSize: 50 })).statusCode, 403);
    for (const invalid of [{ archiveContent: false, archiveFiles: true, archiveBatchSize: 50 },
      { archiveContent: true, archiveFiles: true, archiveBatchSize: 0 }, { archiveContent: true, archiveFiles: true, archiveBatchSize: 2001 },
      { archiveContent: "yes", archiveFiles: true, archiveBatchSize: 50 }, {}]) {
      assert.equal((await request("PATCH", settingsUrl(a), admin.token, invalid)).statusCode, 400);
    }
    assert.equal((await request("PATCH", settingsUrl(a), admin.token,
      { archiveContent: true, archiveFiles: true, archiveBatchSize: 50 })).statusCode, 204);
    assert.equal((await request("PATCH", settingsUrl(randomUUID()), admin.token,
      { archiveContent: true, archiveFiles: true, archiveBatchSize: 50 })).statusCode, 404);
    assert.deepEqual((await request("GET", settingsUrl(a), admin.token)).json(),
      { accountId: a, archiveContent: true, archiveFiles: true, archiveBatchSize: 50 });
    assert.equal((await request("GET", settingsUrl(b), admin.token)).json().archiveContent, false);
    const audited: { change_json: string | object }[] = await db.query(
      "SELECT change_json FROM audit_events WHERE account_id=? AND object_type='mailbox_settings'", [a]);
    assert.equal(audited.length, 1);

    // Status and listing flags come from persisted rows only.
    const read = randomUUID(), unread = randomUUID(), stored = randomUUID();
    for (const [id, code, state] of [[read, "501", 1], [unread, "502", 0], [stored, "503", 1]] as const) {
      await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,1,?,?,'{}')",
        [id, a, code, state]);
    }
    await db.query("INSERT INTO mail_details (item_id,account_id,original_body,safe_body) VALUES (?,?,'x','<p>x</p>')", [stored, a]);
    await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,'attachment',0,'1','stored')",
      [randomUUID(), stored, a]);
    await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,'attachment',1,'2','available')",
      [randomUUID(), stored, a]);
    const status = await request("GET", `/api/v1/accounts/${a}/archive`, viewer.token);
    assert.equal(status.statusCode, 200);
    assert.deepEqual(status.json().items, { total: 3, readInSunat: 2, unreadInSunat: 1, withContent: 1, pendingContent: 1 });
    assert.deepEqual(status.json().files, { stored: 1, pending: 1, failed: 0 });
    assert.equal(status.json().current, null);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/archive`, viewer.token)).statusCode, 403);
    const mail = await request("GET", `/api/v1/accounts/${a}/mail?content=stored`, viewer.token);
    assert.deepEqual(mail.json().rows.map((row: { id: string; contentStored: boolean; storedFiles: number }) =>
      [row.id, row.contentStored, row.storedFiles]), [[stored, true, 1]]);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail?content=missing`, viewer.token)).json().total, 2);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail?content=other`, viewer.token)).statusCode, 400);

    // Views the mailbox screens need: one item, per-user flags, run status per account and runs of all accounts.
    const one = await request("GET", `/api/v1/accounts/${a}/items/${stored}`, viewer.token);
    assert.deepEqual([one.json().id, one.json().remoteState, one.json().contentStored, one.json().openedByUser, one.json().starred],
      [stored, "read", true, false, false]);
    assert.equal(typeof one.json().firstSeenAt, "string");
    assert.equal((await request("GET", `/api/v1/accounts/${a}/items/${randomUUID()}`, viewer.token)).statusCode, 404);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/items/${stored}`, viewer.token)).statusCode, 403);
    const readEvent = randomUUID(), runRow = randomUUID();
    await db.query(
      `INSERT INTO mail_read_events (id,item_id,account_id,actor_user_id,idempotency_key,status,remote_before,remote_after,update_leido)
       VALUES (?,?,?,?,?,'complete',0,1,true)`, [readEvent, stored, a, operator.id, `key-${readEvent}`]);
    assert.deepEqual((await request("GET", `/api/v1/accounts/${a}/items/${stored}/reads/${readEvent}`, operator.token)).json(),
      { id: readEvent, status: "complete", remoteBefore: 0, remoteAfter: 1, updateLeido: true });
    assert.equal((await request("GET", `/api/v1/accounts/${a}/items/${stored}/reads/${readEvent}`, viewer.token)).statusCode, 403);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/items/${stored}`, operator.token)).json().openedByUser, true);
    await db.query(
      `INSERT INTO sync_runs (id,account_id,mode,state,started_at,finished_at,new_messages,new_notifications,boxes_json)
       VALUES (?,?,'manual','complete',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),2,1,'["messages","notifications"]')`, [runRow, a]);
    const visible = (await request("GET", "/api/v1/accounts", viewer.token)).json() as Record<string, unknown>[];
    assert.deepEqual([visible[0].runState, Number(visible[0].newMessages), Number(visible[0].newNotifications)], ["complete", 2, 1]);
    assert.ok(visible[0].lastCompleteAt);
    const allRuns = await request("GET", "/api/v1/admin/runs", admin.token);
    assert.ok((allRuns.json() as { id: string; accountAlias: string }[]).some((run) => run.id === runRow && run.accountAlias.startsWith("Empresa A")));
    assert.equal((await request("GET", "/api/v1/admin/runs", viewer.token)).statusCode, 403);
    const summary = (await request("GET", `/api/v1/accounts/${a}/summary`, viewer.token)).json();
    assert.deepEqual([summary.pendingReview, summary.failedFiles, summary.newSince], [{ messages: 1, notifications: 0 }, 0, null]);
    const activity = (await request("GET", `/api/v1/accounts/${a}/activity`, viewer.token)).json();
    assert.equal(activity.current.id, runRow);
    assert.ok(Array.isArray(activity.seen));

    // Commands stay closed until the operator opens each gate.
    const archiveUrl = (id: string) => `/api/v1/accounts/${id}/archive`;
    assert.equal((await request("POST", archiveUrl(a), operator.token, {})).json().code, "remote_unavailable");
    assert.equal((await request("POST", "/api/v1/inventory", operator.token)).json().code, "remote_disabled");
    assert.equal((await request("POST", archiveUrl(a), viewer.token, {})).statusCode, 403);
    assert.equal((await request("POST", "/api/v1/inventory", viewer.token)).statusCode, 403);

    process.env.SUNAT_READ_VALIDATED = "true";
    process.env.SUNAT_TRANSPORT_VALIDATED = "true";
    assert.equal((await request("POST", archiveUrl(b), operator.token, {})).statusCode, 403);
    assert.equal((await request("POST", archiveUrl(b), admin.token, {})).json().code, "paused");
    assert.equal((await request("POST", archiveUrl(a), operator.token, {})).json().code, "needs_credential");
    assert.equal((await request("POST", archiveUrl(a), operator.token, { retryFailed: "yes" })).statusCode, 400);
    // Every account reports its own outcome; one without credential does not block the others.
    const all = await request("POST", "/api/v1/inventory", admin.token);
    assert.equal(all.statusCode, 201);
    const mine = (all.json() as { accountId: string; runId: string | null; code: string | null }[])
      .filter((entry) => entry.accountId === a || entry.accountId === b);
    assert.deepEqual(mine.map((entry) => [entry.runId, entry.code]), [[null, "needs_credential"], [null, "needs_credential"]]);
    const scoped = (await request("POST", "/api/v1/inventory", operator.token)).json() as { accountId: string }[];
    assert.deepEqual(scoped.map((entry) => entry.accountId), [a]);

    const credential = async (id: string, state: string) => db.query(
      "INSERT INTO sunat_credentials (id,account_id,version,ciphertext,nonce,key_id,status) VALUES (?,?,1,?,?,?,?)",
      [randomUUID(), id, Buffer.from("fictional"), Buffer.alloc(12), "test", state]);
    await credential(a, "valid");
    await credential(b, "rejected");

    // The schedule can be activated only with the cron gate, a valid credential and a computable next run.
    const schedule = { frequency: "daily", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], windowStart: "08:00", windowEnd: "17:00",
      boxes: ["messages", "notifications"], state: "active", downloadReadAttachments: false, notifyInApp: true,
      notifyDailyEmail: false, remoteEffectAccepted: true };
    const scheduleUrl = (id: string) => `/api/v1/accounts/${id}/schedule`;
    assert.equal((await request("PATCH", scheduleUrl(a), admin.token, schedule)).json().code, "remote_unavailable");
    process.env.SUNAT_CRON_VALIDATED = "true";
    assert.equal((await request("PATCH", scheduleUrl(b), admin.token, schedule)).json().code, "invalid_credential");
    assert.equal((await request("PATCH", scheduleUrl(a), admin.token, schedule)).statusCode, 204);
    const saved: { state: string; next_run_at: Date | null }[] = await db.query(
      "SELECT state,next_run_at FROM sync_schedules WHERE account_id=?", [a]);
    assert.equal(saved[0].state, "active");
    assert.ok(saved[0].next_run_at && saved[0].next_run_at.getTime() > Date.now());
    const shown = (await request("GET", scheduleUrl(a), admin.token)).json();
    assert.equal(shown.nextRuns.length > 0, true);
    assert.equal((await request("PATCH", scheduleUrl(a), admin.token, { ...schedule, state: "paused" })).statusCode, 204);
    const paused: { state: string; next_run_at: Date | null }[] = await db.query(
      "SELECT state,next_run_at FROM sync_schedules WHERE account_id=?", [a]);
    assert.deepEqual([paused[0].state, paused[0].next_run_at], ["paused", null]);

    if (process.env.BUZON_TEST_REDIS === "1") {
      const { Queue } = await import("bullmq");
      const { ARCHIVE_QUEUE, INVENTORY_QUEUE, redisOptions } = await import("@buzon-sol/domain");
      const archiveQueue = new Queue(ARCHIVE_QUEUE, { connection: redisOptions() });
      const inventoryQueue = new Queue(INVENTORY_QUEUE, { connection: redisOptions() });
      try {
        // Earlier failures get a new round only when asked.
        const failedEvent = randomUUID();
        await db.query(
          `INSERT INTO mail_read_events (id,item_id,account_id,idempotency_key,status,origin) VALUES (?,?,?,?,'failed','archive')`,
          [failedEvent, read, a, `archive-${failedEvent}`]);
        const started = await request("POST", archiveUrl(a), operator.token, { retryFailed: true });
        assert.equal(started.statusCode, 201);
        assert.equal(started.json().state, "pending");
        const again = await request("POST", archiveUrl(a), operator.token, {});
        assert.equal(again.json().id, started.json().id);
        const job = await archiveQueue.getJob(started.json().id);
        assert.deepEqual(job?.data, { accountId: a, runId: started.json().id });
        const event: { status: string }[] = await db.query("SELECT status FROM mail_read_events WHERE id=?", [failedEvent]);
        assert.equal(event[0].status, "superseded");
        const current = (await request("GET", archiveUrl(a), viewer.token)).json().current;
        assert.deepEqual([current.id, current.trigger, current.state], [started.json().id, "manual", "pending"]);
        await job?.remove();
        await db.query("UPDATE archive_runs SET state='partial' WHERE id=?", [started.json().id]);

        const runs = ((await request("POST", "/api/v1/inventory", admin.token)).json() as
          { accountId: string; runId: string | null; state: string | null; code: string | null }[])
          .filter((entry) => entry.accountId === a || entry.accountId === b);
        const mineA = runs.find((entry) => entry.accountId === a), mineB = runs.find((entry) => entry.accountId === b);
        assert.deepEqual([mineA?.state, mineA?.code, mineB?.runId, mineB?.code], ["pending", null, null, "invalid_credential"]);
        const inventoryJob = await inventoryQueue.getJob(mineA!.runId!);
        assert.deepEqual(inventoryJob?.data, { accountId: a, runId: mineA!.runId });
        await inventoryJob?.remove();

        // Scan kind. The fixture above is a complete full pass, so this first run is incremental.
        const kindOf = async (id: string) => ((await db.query("SELECT scan_kind FROM sync_runs WHERE id=?", [id])) as { scan_kind: string }[])[0].scan_kind;
        const summaryOf = async () => (await request("GET", `/api/v1/accounts/${a}/summary`, viewer.token)).json().initialLoad;
        assert.equal(await kindOf(mineA!.runId!), "incremental");
        assert.deepEqual(await summaryOf(), { done: true, active: false }, "a run on a loaded account is not an initial load");
        await db.query("UPDATE sync_runs SET state='partial' WHERE id=?", [mineA!.runId]);

        // An account that never completed a full pass starts with a full one and counts as loading until it completes.
        await db.query("UPDATE sync_runs SET scan_kind='incremental' WHERE account_id=? AND state='complete'", [a]);
        const first = await request("POST", `/api/v1/accounts/${a}/inventory`, operator.token, {});
        assert.equal(first.statusCode, 201);
        assert.equal(first.json().scanKind, "full");
        assert.deepEqual(await summaryOf(), { done: false, active: true });
        await (await inventoryQueue.getJob(first.json().id))?.remove();
        await db.query("UPDATE sync_runs SET state='complete',finished_at=UTC_TIMESTAMP(6),boxes_json=? WHERE id=?",
          [JSON.stringify(["messages", "notifications"]), first.json().id]);
        assert.deepEqual(await summaryOf(), { done: true, active: false });

        // With a recent complete full pass the next run is incremental, unless a full one is asked for.
        const incremental = await request("POST", `/api/v1/accounts/${a}/inventory`, operator.token, {});
        assert.equal(incremental.json().scanKind, "incremental");
        assert.equal(await kindOf(incremental.json().id), "incremental");
        await (await inventoryQueue.getJob(incremental.json().id))?.remove();
        await db.query("UPDATE sync_runs SET state='partial' WHERE id=?", [incremental.json().id]);
        const forced = await request("POST", `/api/v1/accounts/${a}/inventory`, operator.token, { full: true });
        assert.equal(forced.json().scanKind, "full");
        assert.equal(await kindOf(forced.json().id), "full");
        assert.equal((await request("POST", `/api/v1/accounts/${a}/inventory`, operator.token, { full: "yes" })).statusCode, 400);
        await (await inventoryQueue.getJob(forced.json().id))?.remove();
        await db.query("UPDATE sync_runs SET state='partial' WHERE id=?", [forced.json().id]);
      } finally {
        await archiveQueue.close();
        await inventoryQueue.close();
      }
    }
  } finally {
    gates.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    // Leave no active fixture behind: later suites on this database count accounts and all-account viewers.
    await db.query("UPDATE sunat_accounts SET active=false WHERE id IN (?,?)", [a, b]);
    await db.query("UPDATE app_users SET status='disabled' WHERE email LIKE ?", [`%-${suffix}@example.test`]);
    await app.close();
    await db.destroy();
  }
});
