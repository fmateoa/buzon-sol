import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { tryAccountLock } from "../src/account-lock";
import { InventoryRunner } from "../src/inventory";
import { ReadProcessor } from "../src/reading";
import { testDb } from "./db";

const skip = process.env.BUZON_TEST_DB !== "1";

test("the account lock excludes a second holder, is per account and is released normally or after an exception",
  { skip }, async () => {
  const db = await testDb();
  const [a, b] = [randomUUID(), randomUUID()];
  try {
    const first = await tryAccountLock(db, a);
    assert.ok(first);
    assert.equal(await tryAccountLock(db, a), null, "second holder of the same account is refused without waiting");
    const other = await tryAccountLock(db, b);
    assert.ok(other, "another account is independent");
    await other.release();
    await first.release();
    const again = await tryAccountLock(db, a);
    assert.ok(again, "released lock can be taken again");
    await again.release();

    // An exception inside a runner releases the lock: a failing session factory must not leave the account blocked.
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [a, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    const runner = new InventoryRunner(db, () => { throw new Error("session failed"); });
    await assert.rejects(runner.run(a, await runner.createRun(a, "test")), /session failed/);
    const free = await tryAccountLock(db, a);
    assert.ok(free, "the runner released the lock after the exception");
    await free.release();
  } finally {
    await db.destroy();
  }
});

test("inventory and read jobs of one account exclude each other; neither opens a session while the other holds the lock",
  { skip }, async () => {
  const db = await testDb();
  const accountId = randomUUID();
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const inside = new Promise<void>((resolve) => { entered = resolve; });
    const inventory = new InventoryRunner(db, () => ({ async listPage() { entered(); await blocked; return { contentType: "application/json", body: '{"rows":[]}' }; } }));
    const running = inventory.run(accountId, await inventory.createRun(accountId, "test"));
    await inside;

    let opened = 0;
    const reader = new ReadProcessor(db, () => { opened++; throw new Error("unreachable"); });
    await assert.rejects(reader.process(accountId, randomUUID()), (e) => e instanceof AppError && e.code === "conflict_running");
    const second = new InventoryRunner(db, () => { opened++; throw new Error("unreachable"); });
    await assert.rejects(second.run(accountId, await second.createRun(accountId, "test")),
      (e) => e instanceof AppError && e.code === "conflict_running");
    assert.equal(opened, 0);
    release();
    await running;
  } finally {
    await db.destroy();
  }
});
