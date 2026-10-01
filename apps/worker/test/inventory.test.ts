import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError, type MailBox } from "@buzon-sol/domain";
import { InventoryRunner } from "../src/inventory";
import { testDb } from "./db";

const json = (rows: object[]) => ({ contentType: "application/json", body: JSON.stringify({ total: 1, records: 2, rows }) });

test("persisted checkpoint resumes failed page without duplicate mail", { timeout: 10000, skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID();
  const calls: string[] = [];
  let failOnce = true;
  const runner = new InventoryRunner(db, () => ({ async listPage(box: MailBox, page: number) {
    calls.push(`${box}:${page}`);
    if (box === "messages" && page === 1) return json([{ codMensaje: 1, indEstado: 0 }, { codMensaje: 2, indEstado: 0 }]);
    if (box === "messages" && page === 2) {
      if (failOnce) { failOnce = false; throw new AppError("remote_unavailable"); }
      return json([{ codMensaje: 2, indEstado: 0 }, { codMensaje: 3, indEstado: 1, fecPublica: "29/09/2026 18:23:54",
        codUsremisor: "EMISOR_FICTICIO", codEtiqueta: "01", codCarpeta: null, cantidadArchAdj: 2 }]);
    }
    if (box === "notifications" && page === 1) return json([{ codMensaje: 4, indEstado: 0 }]);
    return json([]);
  } }));
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    const runId = await runner.createRun(accountId, "test");
    await assert.rejects(runner.run(accountId, runId), (error) => error instanceof AppError && error.code === "remote_unavailable");
    const partial: { state: string; resume_box: number; resume_page: number }[] = await db.query(
      "SELECT state,resume_box,resume_page FROM sync_runs WHERE id=?", [runId]);
    assert.deepEqual([partial[0].state, partial[0].resume_box, partial[0].resume_page], ["partial", 1, 2]);
    // A crashed process could leave this state; the released connection lock permits recovery.
    await db.query("UPDATE sync_runs SET state='running' WHERE id=?", [runId]);
    await runner.run(accountId, runId);
    await runner.run(accountId, runId);
    const count: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM mail_items WHERE account_id=?", [accountId]);
    assert.equal(Number(count[0].n), 4);
    const normalized: { published_at: Date; sender_text: string; label_code: string; folder_code: string | null; attachment_count: number }[] =
      await db.query("SELECT published_at,sender_text,label_code,folder_code,attachment_count FROM mail_items WHERE account_id=? AND cod_mensaje=?", [accountId, "3"]);
    assert.deepEqual([new Date(normalized[0].published_at).toISOString(), normalized[0].sender_text, normalized[0].label_code,
      normalized[0].folder_code, normalized[0].attachment_count], ["2026-09-29T23:23:54.000Z", "EMISOR_FICTICIO", "01", null, 2]);
    const pages: { page_number: number; unique_rows: number; confirmed_empty: number }[] = await db.query(
      "SELECT page_number,unique_rows,confirmed_empty FROM sync_pages WHERE run_id=? ORDER BY tipo_msj,page_number", [runId]);
    assert.deepEqual(pages.map((p) => p.unique_rows), [2, 1, 0, 1, 0]);
    assert.equal(calls.filter((call) => call === "messages:1").length, 1);
    const completed: { state: string; resume_page: number | null }[] = await db.query(
      "SELECT state,resume_page FROM sync_runs WHERE id=?", [runId]);
    assert.deepEqual([completed[0].state, completed[0].resume_page], ["complete", null]);
    let releasePage!: () => void;
    let pageEntered!: () => void;
    const entered = new Promise<void>((resolve) => { pageEntered = resolve; });
    const blocked = new Promise<void>((resolve) => { releasePage = resolve; });
    const slow = new InventoryRunner(db, () => ({ async listPage() {
      pageEntered();
      await blocked;
      return json([]);
    } }));
    const secondRun = await slow.createRun(accountId, "test");
    const running = slow.run(accountId, secondRun);
    const first = await Promise.race([entered.then(() => "entered"), running.then(() => "completed")]);
    assert.equal(first, "entered");
    await assert.rejects(slow.run(accountId, secondRun),
      (error) => error instanceof AppError && error.code === "conflict_running");
    releasePage();
    await running;
    const adminRole = randomUUID(), adminId = randomUUID();
    await db.query("INSERT INTO roles (id,name,all_accounts) VALUES (?,?,true)", [adminRole, `Worker admin ${adminRole}`]);
    await db.query("INSERT INTO role_permissions (role_id,permission) VALUES (?,?)", [adminRole, "manage_accounts"]);
    await db.query("INSERT INTO app_users (id,email,name,password_hash,status,role_id) VALUES (?,?,?,?,?,?)",
      [adminId, `worker-${adminId}@example.test`, "Fixture", "fixture-hash", "active", adminRole]);
    await db.query("INSERT INTO sync_schedules (id,account_id,frequency,days_json,window_start,window_end,boxes_json,state) VALUES (?,?,?,?,?,?,?,?)",
      [randomUUID(), accountId, "daily", JSON.stringify(["mon"]), "08:00:00", "17:00:00", JSON.stringify(["messages"]), "active"]);
    const failing = new InventoryRunner(db, () => ({ async listPage() { throw new AppError("remote_unavailable"); } }));
    for (let attempt = 0; attempt < 3; attempt++) {
      const failedRun = await failing.createRun(accountId, "test");
      await assert.rejects(failing.run(accountId, failedRun));
    }
    const paused: { state: string; pause_reason: string }[] = await db.query("SELECT state,pause_reason FROM sync_schedules WHERE account_id=?", [accountId]);
    assert.deepEqual([paused[0].state, paused[0].pause_reason], ["paused", "repeated_failures"]);
    const notices: { n: number }[] = await db.query("SELECT COUNT(*) AS n FROM in_app_notices WHERE account_id=? AND user_id=?", [accountId, adminId]);
    assert.equal(Number(notices[0].n), 1);
    await db.query("UPDATE sunat_accounts SET active=false WHERE id=?", [accountId]);
    await assert.rejects(runner.createRun(accountId), (error) => error instanceof AppError && error.code === "paused");
  } finally {
    await db.destroy();
  }
});
