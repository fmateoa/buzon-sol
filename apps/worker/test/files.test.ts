import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { FileProcessor, type FileResponse } from "../src/files";
import { testDb } from "./db";

test("invalid MIME is not stored; codArchivo zero stays scoped by item and account", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID(), firstItem = randomUUID(), secondItem = randomUUID();
  const firstFile = randomUUID(), secondFile = randomUUID();
  const stored = new Map<string, Buffer>();
  let response: FileResponse = { status: 200, contentType: "text/html", bytes: Buffer.from("<html>login</html>") };
  let fetches = 0;
  const processor = new FileProcessor(db, { async fetch() { fetches++; return response; } },
    { async put(key, bytes) { stored.set(key, bytes); } });
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    for (const [itemId, fileId, code] of [[firstItem, firstFile, "101"], [secondItem, secondFile, "102"]]) {
      await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
        [itemId, accountId, 1, code, 1, JSON.stringify({ codMensaje: code })]);
      await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
        [fileId, itemId, accountId, "attachment", 0, "0", "available"]);
    }
    await assert.rejects(processor.process(accountId, firstFile), (error) => error instanceof AppError && error.code === "schema_changed");
    assert.equal(stored.size, 0);
    response = { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };
    await processor.process(accountId, firstFile);
    await processor.process(accountId, secondFile);
    await processor.process(accountId, firstFile);
    assert.equal(fetches, 3);
    assert.deepEqual([...stored.keys()].sort(),
      [`${accountId}/${firstItem}/${firstFile}`, `${accountId}/${secondItem}/${secondFile}`].sort());
    const generatedId = randomUUID();
    await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,num_id,state) VALUES (?,?,?,?,?,?,?)",
      [generatedId, firstItem, accountId, "generated_document", 0, "fictional-doc", "available"]);
    response = { status: 200, contentType: "text/html", bytes: Buffer.from("<p>Ficticio</p><script>bad()</script>"), verifiedGeneratedDocument: true };
    await processor.process(accountId, generatedId);
    assert.equal(stored.get(`${accountId}/${firstItem}/${generatedId}`)?.includes(Buffer.from("<script>")), false);
    const assets: { state: string; sha256: string; size_bytes: string }[] = await db.query(
      "SELECT state,sha256,size_bytes FROM file_assets WHERE account_id=? ORDER BY item_id", [accountId]);
    assert.equal(assets.every((asset) => asset.state === "stored" && asset.sha256.length === 64 && Number(asset.size_bytes) > 0), true);
  } finally {
    await db.destroy();
  }
});

test("codArchivo zero fetches for one account are serialized", { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID(), itemId = randomUUID(), fileId = randomUUID();
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const fetching = new Promise<void>((resolve) => { entered = resolve; });
  const processor = new FileProcessor(db, { async fetch() {
    entered();
    await blocked;
    return { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7\nfictional") };
  } }, { async put() {} });
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [itemId, accountId, 1, "999002", 1, JSON.stringify({ codMensaje: "999002" })]);
    await db.query("INSERT INTO file_assets (id,item_id,account_id,kind,position_index,cod_archivo,state) VALUES (?,?,?,?,?,?,?)",
      [fileId, itemId, accountId, "attachment", 0, "0", "available"]);
    const first = processor.process(accountId, fileId);
    await fetching;
    await assert.rejects(processor.process(accountId, fileId),
      (error) => error instanceof AppError && error.code === "conflict_running");
    release();
    await first;
  } finally {
    release();
    await db.destroy();
  }
});
