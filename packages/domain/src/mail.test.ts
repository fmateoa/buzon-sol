import assert from "node:assert/strict";
import test from "node:test";
import { parseSunatDateTime } from "./mail.js";

test("SUNAT dates are read as America/Lima and unknown formats are not guessed", () => {
  assert.equal(parseSunatDateTime("29/09/2026 18:23:54")?.toISOString(), "2026-09-29T23:23:54.000Z");
  assert.equal(parseSunatDateTime("31/12/2026 23:00:00")?.toISOString(), "2027-01-01T04:00:00.000Z");
  assert.equal(parseSunatDateTime("01/10/2026")?.toISOString(), "2026-10-01T05:00:00.000Z");
  for (const value of ["2026-09-29 18:23:54", "31/02/2026 10:00:00", "29/13/2026", "", null, 42]) {
    assert.equal(parseSunatDateTime(value), null);
  }
});
