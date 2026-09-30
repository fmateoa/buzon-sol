import assert from "node:assert/strict";
import test from "node:test";
import { nextRuns, validateSchedule } from "./schedule.js";

test("Lima slots cross UTC day without leaving the local window", () => {
  const config = validateSchedule({ frequency: "30m", days: ["wed", "thu"], windowStart: "18:30", windowEnd: "19:00" });
  assert.deepEqual(nextRuns(config, new Date("2026-09-30T23:00:00Z"), 3).map((date) => date.toISOString()), [
    "2026-09-30T23:30:00.000Z", "2026-10-01T00:00:00.000Z", "2026-10-01T23:30:00.000Z",
  ]);
});

test("invalid windows and empty days are rejected", () => {
  assert.throws(() => validateSchedule({ frequency: "1h", days: [], windowStart: "09:00", windowEnd: "17:00" }));
  assert.throws(() => validateSchedule({ frequency: "1h", days: ["mon"], windowStart: "18:00", windowEnd: "17:00" }));
});
