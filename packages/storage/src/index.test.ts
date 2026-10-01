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
  // S3Mock ignores authentication; set BUZON_TEST_S3_PRIVATE=1 against a real S3/MinIO to prove the bucket is private.
  if (process.env.BUZON_TEST_S3_PRIVATE === "1") {
    const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`);
    assert.equal(anonymous.status, 403);
    assert.equal((await anonymous.text()).includes("fictional"), false);
  }
});
