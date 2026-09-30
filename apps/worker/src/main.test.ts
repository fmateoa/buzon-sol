import assert from "node:assert/strict";
import test from "node:test";
import { main } from "./main.js";

test("worker refuses real SUNAT jobs before validation", async () => {
  const previous = process.env.ENABLE_SUNAT_JOBS;
  process.env.ENABLE_SUNAT_JOBS = "true";
  try {
    await assert.rejects(main(), /not implemented or validated/);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_SUNAT_JOBS;
    else process.env.ENABLE_SUNAT_JOBS = previous;
  }
});
