import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AppError, setLogSink, type MailBox } from "@buzon-sol/domain";
import type { InventoryClient } from "@buzon-sol/sunat-adapter";
import { InventoryRunner } from "../src/inventory";
import { planReadAttachmentDownloads } from "../src/read-attachments";
import { FileFetchProcessor } from "../src/file-fetch";
import { testDb } from "./db";

const fixture = (name: string) => readFileSync(join(__dirname, "../../../packages/domain/fixtures", name), "utf8");
const page = (rows: object[]) => ({ contentType: "application/json", body: JSON.stringify({ total: 1, records: 1, rows }) });
const empty = page([]);

async function account(db: Awaited<ReturnType<typeof testDb>>): Promise<string> {
  const id = randomUUID();
  await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
    [id, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
  return id;
}

test("configured boxes, auxiliary catalogs, bounded reauthentication and new-item notices",
  { timeout: 15000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const lines: string[] = [];
  const previousSink = setLogSink((line) => lines.push(line));
  try {
    const accountId = await account(db);
    const roleId = randomUUID(), viewerId = randomUUID(), outsiderRole = randomUUID(), outsiderId = randomUUID();
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,false)", [roleId, `Viewer ${roleId}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [roleId, "view_mailbox"]);
    await db.query("INSERT INTO role_sunat_accounts (role_id,account_id) VALUES (?,?)", [roleId, accountId]);
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,false)", [outsiderRole, `Outsider ${outsiderRole}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [outsiderRole, "view_mailbox"]);
    for (const [id, role] of [[viewerId, roleId], [outsiderId, outsiderRole]]) {
      await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
        [id, `features-${id}@example.test`, "Fixture", "fixture-hash", "active", role]);
    }

    // 1. Only notifications are configured; catalogs succeed, alerts fail without stopping the run.
    const calls: string[] = [];
    const first: InventoryClient = {
      async listPage(box: MailBox, number: number) {
        calls.push(`${box}:${number}`);
        return number === 1 ? page([{ codMensaje: 10, indTipmsj: 2, indEstado: 0 }]) : empty;
      },
      async listFolders() { return { contentType: "application/json", body: fixture("folders.json") }; },
      async visorHtml() { return { contentType: "text/html", body: fixture("visor-master.html") }; },
      async consultAlerts() { return { contentType: "text/html", body: "<html>login</html>" }; },
    };
    const runner = new InventoryRunner(db, () => first);
    const firstRun = await runner.createRun(accountId, "test", ["notifications"]);
    await runner.run(accountId, firstRun);
    assert.equal(calls.some((call) => call.startsWith("messages")), false);
    const firstState: { state: string; folders_state: string; labels_state: string; alerts_state: string; new_notifications: number | null }[] =
      await db.query("SELECT state,folders_state,labels_state,alerts_state,new_notifications FROM sync_runs WHERE id=?", [firstRun]);
    assert.deepEqual(firstState[0], { state: "complete", folders_state: "ok", labels_state: "ok", alerts_state: "unavailable", new_notifications: null });
    const labels: { code: string; color: string }[] = await db.query("SELECT code,color FROM sunat_labels WHERE account_id=? ORDER BY code", [accountId]);
    assert.deepEqual(labels.map((label) => label.code), ["10", "99"]);
    assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM sunat_folders WHERE account_id=?", [accountId]))[0].n), 2);
    // The first complete run is the baseline: no "new" notice.
    assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM in_app_notices WHERE account_id=?", [accountId]))[0].n), 0);

    // 2. Session expires mid-run: one reauthentication resumes at the pending page; a failed catalog keeps the old one.
    let expired = false, reauths = 0;
    const second: InventoryClient = {
      async listPage(box: MailBox, number: number) {
        if (box === "messages" && number === 1) return page([{ codMensaje: 1, indTipmsj: 1, indEstado: 0 }]);
        if (box === "messages" && number === 2 && !expired) { expired = true; return { contentType: "text/html", body: "<html></html>" }; }
        if (box === "notifications" && number === 1) return page([{ codMensaje: 10, indTipmsj: 2, indEstado: 0 }, { codMensaje: 11, indTipmsj: 2, indEstado: 0 }]);
        return empty;
      },
      async visorHtml() { throw new AppError("remote_unavailable"); },
      async reauthenticate() { reauths++; },
    };
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondRunner = new InventoryRunner(db, () => second);
    const secondRun = await secondRunner.createRun(accountId, "test");
    await secondRunner.run(accountId, secondRun);
    const secondState: { state: string; reauth_count: number; labels_state: string; new_messages: number; new_notifications: number }[] =
      await db.query("SELECT state,reauth_count,labels_state,new_messages,new_notifications FROM sync_runs WHERE id=?", [secondRun]);
    assert.deepEqual(secondState[0], { state: "complete", reauth_count: 1, labels_state: "unavailable", new_messages: 1, new_notifications: 1 });
    assert.equal(reauths, 1);
    assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM sunat_labels WHERE account_id=?", [accountId]))[0].n), 2);
    const notices: { user_id: string; kind: string; payload_json: string | Record<string, unknown> }[] = await db.query(
      "SELECT user_id,kind,payload_json FROM in_app_notices WHERE account_id=?", [accountId]);
    assert.deepEqual(notices.map((notice) => [notice.user_id, notice.kind]), [[viewerId, "new_mail"]]);
    const payload = typeof notices[0].payload_json === "string" ? JSON.parse(notices[0].payload_json) : notices[0].payload_json;
    assert.deepEqual(payload, { runId: secondRun, messages: 1, notifications: 1 });

    // 3. Repeated expiry stops after the bound and leaves a resumable partial run.
    const always: InventoryClient = {
      async listPage() { return { contentType: "text/html", body: "<html></html>" }; },
      async reauthenticate() {},
    };
    const thirdRunner = new InventoryRunner(db, () => always);
    const thirdRun = await thirdRunner.createRun(accountId, "test");
    await assert.rejects(thirdRunner.run(accountId, thirdRun, 500, 2),
      (error) => error instanceof AppError && error.code === "remote_session_expired");
    const third: { state: string; reauth_count: number }[] = await db.query("SELECT state,reauth_count FROM sync_runs WHERE id=?", [thirdRun]);
    assert.deepEqual([third[0].state, third[0].reauth_count], ["partial", 2]);

    const finished = lines.map((line) => JSON.parse(line)).filter((entry) => entry.event === "inventory_run_finished");
    assert.equal(finished.length, 3);
    assert.deepEqual(finished.map((entry) => entry.runState), ["complete", "complete", "partial"]);
    assert.equal(lines.some((line) => line.includes("ETIQUETA") || line.includes("fictional")), false);
  } finally {
    setLogSink(previousSink);
    await db.destroy();
  }
});

test("P-03 queues downloads only for read items with stored detail and rechecks before the remote call",
  { timeout: 15000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const previousGate = process.env.SUNAT_FILE_CLIENT_READY;
  try {
    const accountId = await account(db);
    const readItem = randomUUID(), unreadItem = randomUUID(), noDetailItem = randomUUID();
    for (const [id, code, state] of [[readItem, "p3-read", 1], [unreadItem, "p3-unread", 0], [noDetailItem, "p3-nodetail", 1]] as const) {
      await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,1,?,?,'{}')",
        [id, accountId, code, state]);
    }
    for (const item of [readItem, unreadItem]) {
      await db.query("INSERT INTO mail_details (item_id,account_id,original_body,safe_body) VALUES (?,?,?,?)", [item, accountId, "x", "x"]);
    }
    const files: Record<string, string> = {};
    for (const item of [readItem, unreadItem, noDetailItem]) {
      files[item] = randomUUID();
      await db.query(
        "INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,'attachment',0,'123','available')",
        [files[item], item, accountId]);
    }
    await db.query(
      `INSERT INTO sync_schedules (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state,download_read_attachments)
       VALUES (?,?,'daily','["mon"]','08:00:00','17:00:00','["messages"]','disabled',true)`, [randomUUID(), accountId]);
    const runId = randomUUID();
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state) VALUES (?,?,'scheduled','complete')", [runId, accountId]);
    const queued: string[] = [];
    const enqueue = async (_account: string, fetchId: string) => { queued.push(fetchId); };

    delete process.env.SUNAT_FILE_CLIENT_READY;
    assert.equal(await planReadAttachmentDownloads(db, accountId, runId, enqueue), 0);
    process.env.SUNAT_FILE_CLIENT_READY = "true";
    assert.equal(await planReadAttachmentDownloads(db, accountId, runId, enqueue), 1);
    assert.equal(await planReadAttachmentDownloads(db, accountId, runId, enqueue), 0);
    const fetches: { id: string; file_id: string; actor_user_id: string | null; origin: string }[] = await db.query(
      "SELECT id,file_id,actor_user_id,origin FROM file_fetches WHERE account_id=?", [accountId]);
    assert.deepEqual(fetches.map((fetch) => [fetch.file_id, fetch.actor_user_id, fetch.origin]), [[files[readItem], null, "schedule"]]);

    // The schedule stops opting in before the job runs: the worker rechecks and never calls SUNAT.
    await db.query("UPDATE sync_schedules SET download_read_attachments=false WHERE account_id=?", [accountId]);
    let remoteCalls = 0;
    const processor = new FileFetchProcessor(db, () => ({ async fetch() { remoteCalls++; throw new Error("unreachable"); } }),
      { async put() {} });
    await assert.rejects(processor.process(accountId, fetches[0].id), (error) => error instanceof AppError && error.code === "forbidden");
    assert.equal(remoteCalls, 0);
    const denied: { status: string }[] = await db.query("SELECT status FROM file_fetches WHERE id=?", [fetches[0].id]);
    assert.equal(denied[0].status, "denied");

    const manualRun = randomUUID();
    await db.query("UPDATE sync_schedules SET download_read_attachments=true WHERE account_id=?", [accountId]);
    await db.query("INSERT INTO sync_runs (id,account_id,mode,state) VALUES (?,?,'manual','complete')", [manualRun, accountId]);
    assert.equal(await planReadAttachmentDownloads(db, accountId, manualRun, enqueue), 0);
  } finally {
    if (previousGate === undefined) delete process.env.SUNAT_FILE_CLIENT_READY;
    else process.env.SUNAT_FILE_CLIENT_READY = previousGate;
    await db.destroy();
  }
});
