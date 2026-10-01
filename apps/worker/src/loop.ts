/** Runs `task` now and then every `ms`, never overlapping itself. `stop()` waits for a pass already in flight. */
export function every(ms: number, task: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | null = null;
  const tick = () => {
    if (current) return;
    current = task().finally(() => { current = null; });
  };
  tick();
  const timer = setInterval(tick, ms);
  return async () => {
    clearInterval(timer);
    await current;
  };
}
