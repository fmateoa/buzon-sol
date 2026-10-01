import assert from "node:assert/strict";
import test from "node:test";
import { every } from "./loop.js";

test("a loop never overlaps itself and stop() waits for the pass in flight", async () => {
  let running = 0, maxRunning = 0, passes = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const stop = every(10, async () => {
    running++; maxRunning = Math.max(maxRunning, running); passes++;
    await gate;
    running--;
  });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(passes, 1);
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(stopped, false);
  release();
  await stopping;
  assert.equal(running, 0);
  assert.equal(maxRunning, 1);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(passes, 1);
});
