import assert from "node:assert/strict";
import test from "node:test";
import { main } from "./main.js";

test("worker refuses SUNAT jobs without a validated capability", async () => {
  const previous = process.env.ENABLE_SUNAT_JOBS;
  process.env.ENABLE_SUNAT_JOBS = "true";
  try {
    await assert.rejects(main(), /explicitly validated capability/);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_SUNAT_JOBS;
    else process.env.ENABLE_SUNAT_JOBS = previous;
  }
});

test("cron cannot start without validated inventory transport", async () => {
  const prior = Object.fromEntries(["ENABLE_SUNAT_JOBS", "SUNAT_CONNECTION_CLIENT_READY", "SUNAT_TRANSPORT_VALIDATED", "SUNAT_CRON_VALIDATED"]
    .map((key) => [key, process.env[key]]));
  try {
    process.env.ENABLE_SUNAT_JOBS = "true";
    process.env.SUNAT_CONNECTION_CLIENT_READY = "true";
    process.env.SUNAT_CRON_VALIDATED = "true";
    delete process.env.SUNAT_TRANSPORT_VALIDATED;
    await assert.rejects(main(), /cron requires validated inventory transport/);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("reading cannot start without validated inventory transport", async () => {
  const prior = Object.fromEntries(["ENABLE_SUNAT_JOBS", "SUNAT_CONNECTION_CLIENT_READY", "SUNAT_TRANSPORT_VALIDATED", "SUNAT_READ_VALIDATED"]
    .map((key) => [key, process.env[key]]));
  try {
    process.env.ENABLE_SUNAT_JOBS = "true";
    process.env.SUNAT_CONNECTION_CLIENT_READY = "true";
    process.env.SUNAT_READ_VALIDATED = "true";
    delete process.env.SUNAT_TRANSPORT_VALIDATED;
    await assert.rejects(main(), /reading requires validated inventory transport/);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("files cannot start before reading and inventory validation", async () => {
  const prior = Object.fromEntries(["ENABLE_SUNAT_JOBS", "SUNAT_CONNECTION_CLIENT_READY", "SUNAT_TRANSPORT_VALIDATED",
    "SUNAT_READ_VALIDATED", "SUNAT_FILE_CLIENT_READY"].map((key) => [key, process.env[key]]));
  try {
    process.env.ENABLE_SUNAT_JOBS = "true";
    process.env.SUNAT_CONNECTION_CLIENT_READY = "true";
    process.env.SUNAT_TRANSPORT_VALIDATED = "true";
    process.env.SUNAT_FILE_CLIENT_READY = "true";
    delete process.env.SUNAT_READ_VALIDATED;
    await assert.rejects(main(), /files require validated reading and inventory/);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
