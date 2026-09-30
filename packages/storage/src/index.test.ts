import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { S3Storage } from "./index.js";

test("private S3 object round trip", { skip: process.env.BUZON_TEST_S3 !== "1" }, async () => {
  const store = new S3Storage();
  const key = `fixture/${randomUUID()}`;
  const bytes = Buffer.from("%PDF-1.7\nfictional");
  await store.put(key, bytes, "application/pdf");
  const chunks: Buffer[] = [];
  for await (const chunk of await store.get(key)) chunks.push(Buffer.from(chunk));
  assert.deepEqual(Buffer.concat(chunks), bytes);
});
