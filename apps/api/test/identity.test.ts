import "reflect-metadata";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import argon2 from "argon2";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

test("API enforces account scope and immediate revocation", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const { default: db } = await import("../src/db/data-source");
  const { AppModule } = await import("../src/module");
  await db.initialize();
  await db.runMigrations();
  const adminRole = randomUUID(), adminId = randomUUID(), a = randomUUID(), b = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `admin-${suffix}@example.test`;
  const analystEmail = `analyst-${suffix}@example.test`;
  const readerEmail = `reader-${suffix}@example.test`;
  const password = "test-password-12345";
  const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.SOL_PUBLIC_KEY_PEM = keyPair.publicKey.export({ format: "pem", type: "spki" }).toString();
  process.env.SOL_KEY_ID = "test-v1";
  process.env.ACCOUNT_FINGERPRINT_KEY_B64 = randomBytes(32).toString("base64");
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.init();
  const http = app.getHttpAdapter().getInstance();
  const request = (method: string, url: string, token?: string, body?: object) => http.inject({
    method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body,
  });
  try {
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [adminRole, `Admin test ${suffix}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "manage_users_roles"]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "manage_accounts"]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "configure_schedule"]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "read_content"]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "view_audit"]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "run_inventory"]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [adminId, adminEmail, "Admin", await argon2.hash(password, { type: argon2.argon2id }), "active", adminRole]);
    for (const [id, alias] of [[a, "A"], [b, "B"]]) {
      await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
        [id, alias, Buffer.from("fictional"), Buffer.from("fictional")]);
    }
    const itemId = randomUUID(), aItemId = randomUUID();
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [itemId, b, 1, "fictional-item", 0, JSON.stringify({ desAsunto: "Ficticio" })]);
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [aItemId, a, 1, "fictional-item-a", 0, JSON.stringify({ desAsunto: "Ficticio A" })]);

    const adminLogin = await request("POST", "/api/v1/auth/login", undefined, { email: adminEmail.toUpperCase(), password });
    assert.equal(adminLogin.statusCode, 201);
    const adminToken: string = adminLogin.json().token;
    const readUrl = `/api/v1/accounts/${b}/items/${itemId}/read`;
    const readHeaders = { authorization: `Bearer ${adminToken}`, "idempotency-key": "fictional-key-123" };
    if (process.env.BUZON_TEST_REDIS === "1") {
      const { Queue, QueueEvents } = await import("bullmq");
      const { READ_QUEUE, redisOptions } = await import("@buzon-sol/domain");
      const { startReadWorker } = await import("../../worker/src/read-queue");
      process.env.SUNAT_READ_VALIDATED = "true";
      const queue = new Queue(READ_QUEUE, { connection: redisOptions() });
      const events = new QueueEvents(READ_QUEUE, { connection: redisOptions() });
      let worker: ReturnType<typeof startReadWorker> | undefined;
      try {
        await events.waitUntilReady();
        const read1 = await http.inject({ method: "POST", url: readUrl, headers: readHeaders });
        const read2 = await http.inject({ method: "POST", url: readUrl, headers: readHeaders });
        assert.equal(read1.statusCode, 201);
        assert.equal(read1.json().id, read2.json().id);
        const job = await queue.getJob(read1.json().id);
        assert.ok(job);
        worker = startReadWorker(db, () => ({
          async readDetail() { return { body: "<p>Ficticio</p><script>bad()</script>", updateLeido: true }; },
          async observeState() { return 1; },
        }));
        await job.waitUntilFinished(events, 10_000);
        const detail = await request("GET", `/api/v1/accounts/${b}/items/${itemId}/detail`, adminToken);
        assert.equal(detail.statusCode, 200);
        assert.equal(detail.body.includes("<script>"), false);
      } finally {
        if (worker) await worker.close();
        await events.close();
        await queue.close();
        delete process.env.SUNAT_READ_VALIDATED;
      }
    } else {
      assert.equal((await http.inject({ method: "POST", url: readUrl, headers: readHeaders })).json().code, "remote_unavailable");
    }
    const accountResponse = await request("POST", "/api/v1/admin/accounts", adminToken,
      { alias: "Ficticia", ruc: "99999999999", solUser: "USUARIO_FICTICIO" });
    assert.equal(accountResponse.statusCode, 201);
    const createdAccountId: string = accountResponse.json().id;
    assert.equal((await request("POST", `/api/v1/admin/accounts/${createdAccountId}/credential`, adminToken,
      { solPassword: "clave-ficticia" })).statusCode, 204);
    const connectionUrl = `/api/v1/admin/accounts/${createdAccountId}/connection-tests`;
    if (process.env.BUZON_TEST_REDIS === "1") {
      const { Queue, QueueEvents } = await import("bullmq");
      const { CONNECTION_QUEUE, redisOptions } = await import("@buzon-sol/domain");
      const { startConnectionWorker } = await import("../../worker/src/connection-queue");
      process.env.SUNAT_CONNECTION_CLIENT_READY = "true";
      process.env.SOL_PRIVATE_KEY_PEM = keyPair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
      const queue = new Queue(CONNECTION_QUEUE, { connection: redisOptions() });
      const events = new QueueEvents(CONNECTION_QUEUE, { connection: redisOptions() });
      let worker: ReturnType<typeof startConnectionWorker> | undefined;
      try {
        await events.waitUntilReady();
        const requested = await request("POST", connectionUrl, adminToken);
        assert.equal(requested.statusCode, 201);
        const job = await queue.getJob(requested.json().id);
        assert.ok(job);
        let calls = 0;
        worker = startConnectionWorker(db, (credential) => {
          assert.equal(credential.password, "clave-ficticia");
          assert.equal(credential.ruc, "99999999999");
          return { async testConnection() { calls++; return "valid"; } };
        });
        await job.waitUntilFinished(events, 10_000);
        assert.equal(calls, 1);
        const result = await request("GET", `${connectionUrl}/${requested.json().id}`, adminToken);
        assert.equal(result.json().status, "valid");
        assert.equal(result.body.includes("clave-ficticia"), false);
        assert.equal((await request("GET", `${connectionUrl}/${requested.json().id}`)).statusCode, 401);
        const credentialStatus: { status: string }[] = await db.query(
          "SELECT status FROM sunat_credentials WHERE account_id=? ORDER BY version DESC LIMIT 1", [createdAccountId]);
        assert.equal(credentialStatus[0].status, "valid");
      } finally {
        if (worker) await worker.close();
        await events.close();
        await queue.close();
        delete process.env.SUNAT_CONNECTION_CLIENT_READY;
        delete process.env.SOL_PRIVATE_KEY_PEM;
      }
    } else {
      assert.equal((await request("POST", connectionUrl, adminToken)).json().code, "remote_unavailable");
    }
    const adminAccounts = await request("GET", "/api/v1/admin/accounts", adminToken);
    assert.equal(adminAccounts.statusCode, 200);
    assert.equal(adminAccounts.body.includes("clave-ficticia"), false);
    assert.equal(adminAccounts.body.includes("99999999999"), false);
    const saved: { ciphertext: Buffer }[] = await db.query(
      "SELECT ciphertext FROM sunat_credentials WHERE account_id=?", [createdAccountId]);
    const { decryptInWorker } = await import("@buzon-sol/domain");
    assert.equal(decryptInWorker(saved[0].ciphertext, keyPair.privateKey.export({ format: "pem", type: "pkcs8" }).toString()), "clave-ficticia");
    const auditSecrets: { change_json: unknown }[] = await db.query(
      "SELECT change_json FROM audit_events WHERE account_id=?", [createdAccountId]);
    assert.equal(JSON.stringify(auditSecrets).includes("clave-ficticia"), false);
    const schedule = { frequency: "daily", days: ["mon"], windowStart: "08:00", windowEnd: "17:00",
      boxes: ["messages"], state: "disabled", downloadReadAttachments: false,
      notifyInApp: true, notifyDailyEmail: false, remoteEffectAccepted: false };
    assert.equal((await request("PATCH", `/api/v1/accounts/${createdAccountId}/schedule`, adminToken, schedule)).statusCode, 204);
    assert.equal((await request("GET", `/api/v1/accounts/${createdAccountId}/schedule`, adminToken)).json().state, "disabled");
    assert.equal((await request("PATCH", `/api/v1/accounts/${createdAccountId}/schedule`, adminToken,
      { ...schedule, state: "active" })).json().code, "remote_unavailable");
    assert.equal((await request("POST", `/api/v1/accounts/${createdAccountId}/inventory`, adminToken)).json().code, "remote_unavailable");
    if (process.env.BUZON_TEST_REDIS === "1") {
      const { Queue, QueueEvents } = await import("bullmq");
      const { INVENTORY_QUEUE, redisOptions } = await import("@buzon-sol/domain");
      const { startInventoryWorker } = await import("../../worker/src/queue");
      await db.query("UPDATE sunat_credentials SET status='valid' WHERE account_id=?", [createdAccountId]);
      process.env.SUNAT_TRANSPORT_VALIDATED = "true";
      const queue = new Queue(INVENTORY_QUEUE, { connection: redisOptions() });
      const events = new QueueEvents(INVENTORY_QUEUE, { connection: redisOptions() });
      let worker: ReturnType<typeof startInventoryWorker> | undefined;
      try {
        await events.waitUntilReady();
        const first = await request("POST", `/api/v1/accounts/${createdAccountId}/inventory`, adminToken);
        const second = await request("POST", `/api/v1/accounts/${createdAccountId}/inventory`, adminToken);
        assert.equal(first.statusCode, 201);
        assert.equal(first.json().id, second.json().id);
        const job = await queue.getJob(first.json().id);
        assert.ok(job);
        worker = startInventoryWorker(db, () => ({ async listPage() {
          return { contentType: "application/json", body: '{"rows":[],"total":0,"records":0}' };
        } }));
        await job.waitUntilFinished(events, 10_000);
        const summary = await request("GET", `/api/v1/accounts/${createdAccountId}/summary`, adminToken);
        // This admin role has no view_mailbox permission; the run itself is complete in storage.
        assert.equal(summary.statusCode, 403);
        const run: { state: string }[] = await db.query("SELECT state FROM sync_runs WHERE id=?", [first.json().id]);
        assert.equal(run[0].state, "complete");
        const partialId = randomUUID(), competingId = randomUUID();
        await db.query("INSERT INTO sync_runs (id,account_id,mode,state) VALUES (?,?,?,?)",
          [partialId, createdAccountId, "manual", "partial"]);
        await db.query("INSERT INTO sync_runs (id,account_id,mode,state) VALUES (?,?,?,?)",
          [competingId, createdAccountId, "manual", "pending"]);
        assert.equal((await request("POST", `/api/v1/accounts/${createdAccountId}/runs/${partialId}/resume`, adminToken)).json().code,
          "conflict_running");
        await db.query("UPDATE sync_runs SET state='partial' WHERE id=?", [competingId]);
      } finally {
        if (worker) await worker.close();
        await events.close();
        await queue.close();
        delete process.env.SUNAT_TRANSPORT_VALIDATED;
      }
    }
    const roleResponse = await request("POST", "/api/v1/roles", adminToken,
      { name: `Analista ${suffix}`, permissions: ["view_mailbox", "mark_reviewed"], allAccounts: false, accountIds: [a] });
    assert.equal(roleResponse.statusCode, 201);
    const duplicateRole = await request("POST", "/api/v1/roles", adminToken,
      { name: `Analista ${suffix}`, permissions: ["view_mailbox", "mark_reviewed"], allAccounts: false, accountIds: [a] });
    assert.deepEqual(duplicateRole.json(), { code: "validation" });
    const roleId: string = roleResponse.json().id;
    const userResponse = await request("POST", "/api/v1/users", adminToken,
      { name: "Analista", email: analystEmail, password, roleId });
    assert.equal(userResponse.statusCode, 201);
    const userId: string = userResponse.json().id;
    const login = await request("POST", "/api/v1/auth/login", undefined, { email: analystEmail, password });
    assert.equal(login.statusCode, 201);
    const token: string = login.json().token;

    const secondRole = await request("POST", "/api/v1/roles", adminToken,
      { name: `Consulta B ${suffix}`, permissions: ["view_mailbox", "download_file"], allAccounts: false, accountIds: [b] });
    assert.equal(secondRole.statusCode, 201);
    const secondUser = await request("POST", "/api/v1/users", adminToken,
      { name: "Consulta B", email: readerEmail, password, roleId: secondRole.json().id });
    assert.equal(secondUser.statusCode, 201);
    const secondLogin = await request("POST", "/api/v1/auth/login", undefined, { email: readerEmail, password });
    const secondToken: string = secondLogin.json().token;

    const accounts = await request("GET", "/api/v1/accounts", token);
    assert.deepEqual(accounts.json().map((row: { id: string }) => row.id), [a]);

    // Management views consumed by the frontend adapter.
    type Listed = Record<string, unknown> & { id: string };
    const list = async (url: string, bearer = adminToken): Promise<Listed[]> => (await request("GET", url, bearer)).json();
    assert.equal(accounts.json()[0].scheduleState, "disabled");
    const me = (await request("GET", "/api/v1/auth/me", token)).json();
    assert.deepEqual([me.roleName, me.preferences], [`Analista ${suffix}`, { readWarningEnabled: true }]);
    assert.equal((await request("PATCH", "/api/v1/auth/me/preferences", token, { readWarningEnabled: "no" })).statusCode, 400);
    assert.equal((await request("PATCH", "/api/v1/auth/me/preferences", token, { readWarningEnabled: false })).statusCode, 204);
    assert.equal((await request("GET", "/api/v1/auth/me", token)).json().preferences.readWarningEnabled, false);
    const listedUser = (await list("/api/v1/users")).find((row) => row.id === userId);
    assert.equal(listedUser?.roleName, `Analista ${suffix}`);
    assert.ok(listedUser?.lastLoginAt);
    assert.equal((await list("/api/v1/roles")).find((row) => row.id === roleId)?.userCount, 1);
    assert.equal((await request("GET", "/api/v1/admin/account-options", secondToken)).statusCode, 403);
    assert.deepEqual((await list("/api/v1/admin/account-options")).find((row) => row.id === createdAccountId),
      { id: createdAccountId, alias: "Ficticia" });
    assert.equal((await request("GET", `/api/v1/admin/accounts/${a}/users`, token)).statusCode, 403);
    const accountUserIds = (await list(`/api/v1/admin/accounts/${a}/users`)).map((row) => row.id);
    assert.deepEqual([accountUserIds.includes(userId), accountUserIds.includes(adminId), accountUserIds.includes(secondUser.json().id)],
      [true, true, false]);
    assert.equal((await request("PATCH", `/api/v1/admin/accounts/${createdAccountId}`, adminToken, { alias: "Ficticia" })).statusCode, 204);
    const listedAccount = (await list("/api/v1/admin/accounts")).find((row) => row.id === createdAccountId);
    assert.deepEqual([listedAccount?.solUserMasked, listedAccount?.credentialStatus, listedAccount?.scheduleState],
      // The Redis branch above marks the credential valid to exercise a queued inventory.
      ["US***", process.env.BUZON_TEST_REDIS === "1" ? "valid" : "untested", "disabled"]);
    assert.ok(listedAccount?.credentialSavedAt && listedAccount.createdAt && Number(listedAccount.userCount) >= 1);
    const auditRows = await list("/api/v1/audit");
    assert.ok(auditRows.some((row) => row.objectType === "role" && row.objectName === `Analista ${suffix}` && row.actorName === "Admin"));
    assert.ok(auditRows.some((row) => row.objectType === "account" && row.accountAlias === "Ficticia"));
    assert.equal((await request("GET", `/api/v1/accounts/${b}/mail`, token)).statusCode, 403);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail`, token)).statusCode, 200);
    const reviewUrl = `/api/v1/accounts/${a}/items/${aItemId}/review`;
    assert.equal((await request("PATCH", reviewUrl, token, { reviewed: true })).statusCode, 204);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail`, token)).json().rows[0].reviewed, true);
    assert.equal((await request("PATCH", reviewUrl, token, { reviewed: false })).statusCode, 204);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail`, token)).json().rows[0].reviewed, false);
    assert.equal((await request("PATCH", `/api/v1/accounts/${b}/items/${itemId}/review`, token, { reviewed: true })).statusCode, 403);
    assert.equal((await request("PATCH", `/api/v1/accounts/${a}/items/${itemId}/review`, token, { reviewed: true })).statusCode, 404);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail?limit=0`, token)).statusCode, 400);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail?offset=1`, token)).json().rows.length, 0);
    const reviewedAudit: { action: string }[] = await db.query("SELECT action FROM audit_events WHERE actor_user_id=? AND object_id=?", [userId, aItemId]);
    assert.equal(reviewedAudit.filter((event) => event.action === "set_reviewed").length, 2);
    const completeRun = randomUUID(), partialRun = randomUUID(), laterItem = randomUUID();
    await db.query(
      `INSERT INTO sync_runs (id,account_id,mode,state,started_at,finished_at)
       VALUES (?,?,?,'complete',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))`, [completeRun, a, "test"]);
    await db.query(
      `INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json,first_seen_at)
       VALUES (?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 1 SECOND))`,
      [laterItem, a, 1, "fictional-later", 1, JSON.stringify({ desAsunto: "Ficticio posterior" })]);
    await db.query(
      `INSERT INTO sync_runs (id,account_id,mode,state,started_at)
       VALUES (?,?,?,'partial',DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 2 SECOND))`, [partialRun, a, "test"]);
    const partialSummary = (await request("GET", `/api/v1/accounts/${a}/summary`, token)).json();
    assert.equal(partialSummary.verified, false);
    assert.equal(partialSummary.boxes.messages.uniqueCount, 2);
    assert.equal(partialSummary.boxes.messages.lastVerifiedCount, 1);
    const pendingRun = randomUUID();
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state) VALUES (?,?,?,'pending')", [pendingRun, a, "manual"]);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/summary`, token)).json().state, "pending");
    assert.equal((await request("GET", `/api/v1/accounts/${a}/activity`, token)).json().current.id, pendingRun);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/summary`, token)).statusCode, 200);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/summary`, token)).statusCode, 403);
    const [n1, n2, n3] = [randomUUID(), randomUUID(), randomUUID()];
    for (const [id, code, state, subject, sender, text, at, label] of [
      [n1, "fictional-n1", 0, "Resolución 50% ficticia", "EMISOR_X", "29/09/2026 18:23:54", "2026-09-29 23:23:54", "01"],
      [n2, "fictional-n2", 1, "Aviso ficticio", "EMISOR_Y", "30/09/2026 00:30:00", "2026-09-30 05:30:00", "02"],
      [n3, "fictional-n3", 2, null, null, null, null, null],
    ] as const) await db.query(
      `INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,subject_text,sender_text,
        published_at_text,published_at,label_code,row_json) VALUES (?,?,2,?,?,?,?,?,?,?,?)`,
      [id, a, code, state, subject, sender, text, at, label, "{}"]);
    const mail = async (query: string) => {
      const response = await request("GET", `/api/v1/accounts/${a}/mail?box=notifications&${query}`, token);
      assert.equal(response.statusCode, 200, query);
      const page: { rows: { id: string; box: string; remoteState: string; publishedAt: string | null }[]; total: number } = response.json();
      return { ids: page.rows.map((row) => row.id), total: page.total, rows: page.rows };
    };
    const byDate = await mail("");
    assert.deepEqual([byDate.ids, byDate.total], [[n2, n1, n3], 3]);
    assert.deepEqual(byDate.rows.map((row) => [row.box, row.remoteState]),
      [["notifications", "read"], ["notifications", "unread"], ["notifications", "read"]]);
    assert.equal(byDate.rows[1].publishedAt, "2026-09-29T23:23:54.000Z");
    assert.deepEqual((await mail("direction=asc")).ids, [n1, n2, n3]);
    assert.deepEqual((await mail("state=unread")).ids, [n1]);
    assert.deepEqual((await mail("state=read")).total, 2);
    assert.deepEqual((await mail("q=50%25")).ids, [n1]);
    assert.deepEqual((await mail("q=_")).total, 2);
    assert.deepEqual((await mail("dateFrom=2026-09-30&dateTo=2026-09-30")).ids, [n2]);
    assert.deepEqual((await mail("dateTo=2026-09-29")).ids, [n1]);
    assert.deepEqual((await mail("label=01")).ids, [n1]);
    assert.deepEqual((await mail("review=pending&limit=1&offset=1")).ids, [n1]);
    assert.equal((await mail("review=reviewed")).total, 0);
    await db.query("INSERT INTO sunat_labels (account_id,code,name,color,message_count) VALUES (?,?,?,?,?)",
      [a, "99", "ETIQUETA FICTICIA", "#00afff", 1]);
    const labelCatalog = await request("GET", `/api/v1/accounts/${a}/labels`, token);
    assert.equal(labelCatalog.statusCode, 200);
    assert.deepEqual(labelCatalog.json().items, [{ code: "99", name: "ETIQUETA FICTICIA", color: "#00afff", messageCount: 1 }]);
    assert.deepEqual((await request("GET", `/api/v1/accounts/${a}/folders`, token)).json().items, []);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/labels`, token)).statusCode, 403);
    await db.query("INSERT INTO in_app_notices (id,account_id,user_id,kind,payload_json) VALUES (?,?,?,?,?)",
      [randomUUID(), a, userId, "new_mail", JSON.stringify({ messages: 2, notifications: 0 })]);
    const newMail = (await request("GET", "/api/v1/notices", token)).json()
      .filter((notice: { kind: string }) => notice.kind === "new_mail");
    assert.deepEqual(newMail.map((notice: { counts: unknown }) => notice.counts), [{ messages: 2, notifications: 0 }]);
    for (const bad of ["box=x", "dateFrom=2026-02-31", "sort=codMensaje", "direction=up", "limit=201"]) {
      assert.equal((await request("GET", `/api/v1/accounts/${a}/mail?${bad}`, token)).statusCode, 400, bad);
    }
    assert.equal((await request("GET", "/api/v1/audit", token)).statusCode, 403);
    assert.equal((await http.inject({ method: "POST", url: readUrl,
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "fictional-key-456" } })).statusCode, 403);
    assert.equal((await request("GET", `/api/v1/accounts/${a}/mail`, secondToken)).statusCode, 403);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/mail`, secondToken)).statusCode, 200);
    const noticeId = randomUUID();
    await db.query("INSERT INTO in_app_notices (id,account_id,user_id,kind) VALUES (?,?,?,?)",
      [noticeId, b, secondUser.json().id, "sync_paused"]);
    assert.equal((await request("GET", "/api/v1/notices", secondToken)).json().some((notice: { id: string }) => notice.id === noticeId), true);
    assert.equal((await request("POST", `/api/v1/notices/${noticeId}/read`, secondToken)).statusCode, 204);
    assert.equal((await request("GET", "/api/v1/audit.csv", adminToken)).statusCode, 200);
    const auditCsv = (await request("GET", "/api/v1/audit.csv", adminToken)).body;
    assert.equal(auditCsv.includes("clave-ficticia"), false);
    if (process.env.BUZON_TEST_S3 === "1") {
      const { S3Storage } = await import("@buzon-sol/storage");
      const fileId = randomUUID();
      const objectKey = `${b}/${itemId}/${fileId}`;
      const bytes = Buffer.from("%PDF-1.7\nfictional");
      await new S3Storage().put(objectKey, bytes, "application/pdf");
      await db.query(
        "INSERT INTO file_assets (id,item_id,account_id,kind,position_index,object_key,mime_type,size_bytes,sha256,state) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [fileId, itemId, b, "attachment", 0, objectKey, "application/pdf", bytes.length, "0".repeat(64), "stored"],
      );
      const url = `/api/v1/accounts/${b}/files/${fileId}`;
      const downloaded = await request("GET", url, secondToken);
      assert.equal(downloaded.statusCode, 200);
      assert.deepEqual(downloaded.rawPayload, bytes);
      assert.equal((await request("GET", url)).statusCode, 401);
      assert.equal((await request("GET", url, token)).statusCode, 403);
      if (process.env.BUZON_TEST_REDIS === "1") {
        const { Queue, QueueEvents } = await import("bullmq");
        const { FILE_QUEUE, redisOptions } = await import("@buzon-sol/domain");
        const { startFileWorker } = await import("../../worker/src/file-queue");
        const fetchedId = randomUUID();
        await db.query(
          "INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
          [fetchedId, itemId, b, "attachment", 1, "0", "available"]);
        const fetchUrl = `/api/v1/accounts/${b}/files/${fetchedId}/fetch`;
        assert.equal((await request("POST", fetchUrl, secondToken)).json().code, "remote_unavailable");
        process.env.SUNAT_FILE_CLIENT_READY = "true";
        const queue = new Queue(FILE_QUEUE, { connection: redisOptions() });
        const events = new QueueEvents(FILE_QUEUE, { connection: redisOptions() });
        let worker: ReturnType<typeof startFileWorker> | undefined;
        let calls = 0;
        try {
          await events.waitUntilReady();
          assert.equal((await request("POST", fetchUrl, token)).statusCode, 403);
          const unreadItem = randomUUID(), unreadFile = randomUUID();
          await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
            [unreadItem, b, 1, "fictional-unread-file", 0, JSON.stringify({ codMensaje: "fictional-unread-file" })]);
          await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
            [unreadFile, unreadItem, b, "attachment", 0, "0", "available"]);
          assert.equal((await request("POST", `/api/v1/accounts/${b}/files/${unreadFile}/fetch`, secondToken)).statusCode, 403);
          const fetch = await request("POST", fetchUrl, secondToken);
          assert.equal(fetch.statusCode, 201);
          const repeat = await request("POST", fetchUrl, secondToken);
          assert.equal(repeat.json().id, fetch.json().id);
          const job = await queue.getJob(fetch.json().id);
          assert.ok(job);
          worker = startFileWorker(db, () => ({ async fetch(_account, _item, _kind, code) {
            assert.equal(code, "0");
            calls++;
            return { status: 200, contentType: "application/pdf", bytes };
          } }));
          await job.waitUntilFinished(events, 10_000);
          assert.equal(calls, 1);
          const fetchStatus = await request("GET", `${fetchUrl}es/${fetch.json().id}`, secondToken);
          assert.equal(fetchStatus.json().status, "complete");
          assert.deepEqual((await request("GET", `/api/v1/accounts/${b}/files/${fetchedId}`, secondToken)).rawPayload, bytes);
        } finally {
          if (worker) await worker.close();
          await events.close();
          await queue.close();
          delete process.env.SUNAT_FILE_CLIENT_READY;
        }
      }
      assert.equal((await request("PATCH", `/api/v1/roles/${secondRole.json().id}`, adminToken,
        { name: `Consulta B ${suffix}`, permissions: ["view_mailbox"], allAccounts: false, accountIds: [b] })).statusCode, 204);
      assert.equal((await request("GET", url, secondToken)).statusCode, 403);
    }
    assert.equal((await request("GET", "/api/v1/admin/accounts", token)).statusCode, 403);

    assert.equal((await request("PATCH", `/api/v1/roles/${roleId}`, adminToken,
      { name: `Analista ${suffix}`, permissions: ["view_mailbox"], allAccounts: false, accountIds: [a, b] })).statusCode, 204);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/mail`, token)).statusCode, 200);
    assert.equal((await request("PATCH", `/api/v1/roles/${roleId}`, adminToken,
      { name: `Analista ${suffix}`, permissions: [], allAccounts: false, accountIds: [a, b] })).statusCode, 204);
    assert.equal((await request("GET", `/api/v1/accounts/${b}/mail`, token)).statusCode, 403);

    assert.equal((await request("PATCH", `/api/v1/users/${userId}/status`, adminToken, { status: "disabled" })).statusCode, 204);
    assert.equal((await request("GET", "/api/v1/auth/me", token)).statusCode, 401);
    await db.query("UPDATE sync_schedules SET state='active' WHERE account_id=?", [createdAccountId]);
    assert.equal((await request("PATCH", `/api/v1/admin/accounts/${createdAccountId}/active`, adminToken, { active: false })).statusCode, 204);
    const savedSchedule: { state: string }[] = await db.query("SELECT state FROM sync_schedules WHERE account_id=?", [createdAccountId]);
    assert.equal(savedSchedule[0].state, "disabled");
    assert.equal((await request("POST", "/api/v1/auth/logout", secondToken)).statusCode, 204);
    assert.equal((await request("GET", "/api/v1/auth/me", secondToken)).statusCode, 401);
    const audit: { action: string; object_type: string }[] = await db.query(
      "SELECT action,object_type FROM audit_events WHERE actor_user_id=? ORDER BY created_at", [adminId]);
    assert.equal(audit.filter((e) => e.object_type === "role").length, process.env.BUZON_TEST_S3 === "1" ? 5 : 4);
    assert.equal(audit.filter((e) => e.object_type === "user" && e.action === "disable").length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});
