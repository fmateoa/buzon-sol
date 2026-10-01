import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkerConfig } from "./config.js";

const base = { ENABLE_SUNAT_JOBS: "true", SUNAT_TRANSPORT_VALIDATED: "true", SOL_PRIVATE_KEY_PEM: "pem" };

test("worker stays idle and needs no secrets when SUNAT jobs are not enabled", () => {
  assert.equal(loadWorkerConfig({}).enabled, false);
  assert.equal(loadWorkerConfig({ ENABLE_SUNAT_JOBS: "false", SUNAT_TRANSPORT_VALIDATED: "true" }).enabled, false);
});

test("gates accept only an explicit true; anything else is a deployment error", () => {
  assert.equal(loadWorkerConfig({ ...base, SUNAT_CRON_VALIDATED: "false" }).cron, false);
  for (const value of ["TRUE", "1", "yes"]) {
    assert.throws(() => loadWorkerConfig({ ...base, SUNAT_READ_VALIDATED: value }), /Invalid SUNAT_READ_VALIDATED/);
    assert.throws(() => loadWorkerConfig({ ...base, ENABLE_SUNAT_JOBS: value }), /Invalid ENABLE_SUNAT_JOBS/);
  }
});

test("invalid gate combinations are rejected before anything is opened", () => {
  assert.throws(() => loadWorkerConfig({ ENABLE_SUNAT_JOBS: "true" }), /explicitly validated capability/);
  assert.throws(() => loadWorkerConfig({ ...base, SUNAT_TRANSPORT_VALIDATED: undefined, SUNAT_CONNECTION_CLIENT_READY: "true", SUNAT_CRON_VALIDATED: "true" }), /cron requires/);
  assert.throws(() => loadWorkerConfig({ ...base, SUNAT_FILE_CLIENT_READY: "true" }), /files require/);
});

test("secrets are required only for the capabilities that use them", () => {
  assert.throws(() => loadWorkerConfig({ ...base, SOL_PRIVATE_KEY_PEM: undefined }), /SOL_PRIVATE_KEY_PEM required/);
  const files = { ...base, SUNAT_READ_VALIDATED: "true", SUNAT_FILE_CLIENT_READY: "true" };
  assert.throws(() => loadWorkerConfig(files), /S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY required/);
  assert.equal(loadWorkerConfig({ ...files, S3_ENDPOINT: "e", S3_BUCKET: "b", S3_ACCESS_KEY: "a", S3_SECRET_KEY: "s" }).files, true);
  assert.equal(loadWorkerConfig({ ...base, SUNAT_READ_VALIDATED: "true" }).reading, true);
});

test("intervals must be integers of at least ten seconds", () => {
  assert.throws(() => loadWorkerConfig({ ...base, RECOVERY_INTERVAL_MS: "500" }), /Invalid RECOVERY_INTERVAL_MS/);
  assert.equal(loadWorkerConfig({ ...base, SCHEDULER_INTERVAL_MS: "20000" }).schedulerMs, 20_000);
});

test("error messages never include configured values", () => {
  assert.throws(() => loadWorkerConfig({ ...base, SUNAT_READ_VALIDATED: "super-secret" }), (error: Error) => !error.message.includes("super-secret"));
});
