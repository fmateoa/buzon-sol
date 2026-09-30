import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AppError } from "@buzon-sol/domain";
import { type SunatHttpSession } from "@buzon-sol/sunat-adapter";
import { SunatFileClient } from "../src/sunat-file-client";
import { testDb } from "./db";

test("file client resolves the scoped item before reopening detail and downloading",
  { skip: process.env.BUZON_TEST_DB !== "1" }, async () => {
  const db = await testDb();
  const accountId = randomUUID(), itemId = randomUUID();
  const calls: string[] = [];
  const session = {
    async fetchAttachment(box: string, code: string, file: string) {
      calls.push(`${box}:${code}:${file}`);
      return { status: 200, contentType: "application/pdf", bytes: Buffer.from("%PDF-fixture") };
    },
    async fetchGeneratedDocument(box: string, code: string, numId: string) {
      calls.push(`${box}:${code}:${numId}`);
      return { status: 200, contentType: "text/html", bytes: Buffer.from("<p>Fixture</p>"), verifiedGeneratedDocument: true };
    },
    async close() { calls.push("close"); },
  } as unknown as SunatHttpSession;
  const client = new SunatFileClient(db, session);
  try {
    await db.query("INSERT INTO sunat_accounts (id,alias,ruc_ciphertext,sol_user_ciphertext) VALUES (?,?,?,?)",
      [accountId, "Fixture", Buffer.from("fictional"), Buffer.from("fictional")]);
    await db.query("INSERT INTO mail_items (id,account_id,tipo_msj,cod_mensaje,ind_estado,row_json) VALUES (?,?,?,?,?,?)",
      [itemId, accountId, 2, "123", 1, JSON.stringify({ codMensaje: 123 })]);
    assert.equal((await client.fetch(accountId, itemId, "attachment", "0", null)).contentType, "application/pdf");
    assert.equal((await client.fetch(accountId, itemId, "generated_document", null, "55")).verifiedGeneratedDocument, true);
    await assert.rejects(client.fetch(randomUUID(), itemId, "attachment", "0", null),
      (error) => error instanceof AppError && error.code === "schema_changed");
    await client.close();
    assert.deepEqual(calls, ["notifications:123:0", "notifications:123:55", "close"]);
  } finally { await db.destroy(); }
});
