import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { InventoryRunner } from "../src/inventory";
import { testDb } from "./db";

const folders = readFileSync(join(__dirname, "../../../packages/domain/fixtures/folders.json"), "utf8");
const empty = { contentType: "application/json", body: '{"rows":[]}' };

test("a MySQL failure while replacing a catalog fails the run; it is not reported as an unavailable SUNAT catalog",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID();
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    await db.query("INSERT INTO sunat_folders (account_id,code,name,message_count) VALUES (?,?,?,?)", [accountId, "77", "Existente", 1]);
    const runner = new InventoryRunner(db, () => ({
      async listPage() { return empty; },
      async listFolders() { return { contentType: "application/json", body: folders }; },
    }));
    const runId = await runner.createRun(accountId, "test");

    const transaction = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>;
    let failed = false;
    (db as { transaction: unknown }).transaction = async (...args: unknown[]) => {
      if (!failed) { failed = true; throw new Error("mysql went away"); }
      return transaction(...args);
    };
    try { await assert.rejects(runner.run(accountId, runId), /mysql went away/); }
    finally { (db as { transaction: unknown }).transaction = transaction; }

    const run = (await db.query("SELECT state,folders_state FROM sync_runs WHERE id=?", [runId]))[0];
    assert.equal(run.state, "partial");
    assert.notEqual(run.folders_state, "unavailable");
    const kept = await db.query("SELECT code FROM sunat_folders WHERE account_id=?", [accountId]);
    assert.deepEqual(kept.map((row: { code: string }) => row.code), ["77"], "the stored catalog is untouched");

    // The same run resumes: the catalog now persists and the run completes.
    await runner.run(accountId, runId);
    const codes = (await db.query("SELECT code FROM sunat_folders WHERE account_id=? ORDER BY code", [accountId]))
      .map((row: { code: string }) => row.code);
    assert.deepEqual(codes, ["03", "91"]);
  } finally {
    await db.destroy();
  }
});

test("an unparsable SUNAT catalog is unavailable and keeps the stored one while the inventory completes",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID();
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    await db.query("INSERT INTO sunat_folders (account_id,code,name,message_count) VALUES (?,?,?,?)", [accountId, "77", "Existente", 1]);
    const runner = new InventoryRunner(db, () => ({
      async listPage() { return empty; },
      async listFolders() { return { contentType: "text/html", body: "<html>login</html>" }; },
    }));
    const runId = await runner.createRun(accountId, "test");
    await runner.run(accountId, runId);
    const run = (await db.query("SELECT state,folders_state FROM sync_runs WHERE id=?", [runId]))[0];
    assert.deepEqual([run.state, run.folders_state], ["complete", "unavailable"]);
    assert.equal((await db.query("SELECT code FROM sunat_folders WHERE account_id=?", [accountId])).length, 1);
  } finally {
    await db.destroy();
  }
});
