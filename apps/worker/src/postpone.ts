import { DelayedError, type Job } from "bullmq";
import { AppError } from "@buzon-sol/domain";

/** Pause between attempts of a job that found its account busy or yielded it to a user command. */
export const BUSY_RETRY_MS = 5_000;
/** The inventory waits a little longer when the account is busy: user commands must get through first. */
export const INVENTORY_RETRY_MS = 15_000;
/** After yielding, the inventory gives the waiting command time to take the account (its jobs retry every 5 s). */
export const INVENTORY_YIELD_MS = 20_000;
/** Postponements tolerated for a busy account: 5 min for a user command, 15 min for the inventory. */
export const MAX_COMMAND_DEFERRALS = 60;
export const MAX_INVENTORY_DEFERRALS = 60;

/**
 * Moves the same job (same id, so orphan recovery still finds it) back to the delayed set. `count: false` is for a
 * deliberate yield, which must not eat the budget meant for a busy account. Never returns: BullMQ requires the
 * processor to throw `DelayedError` after `moveToDelayed`.
 */
export async function postpone(job: Job<{ deferrals?: number }>, token: string | undefined, delayMs: number,
  options: { count?: boolean } = {}): Promise<never> {
  if (options.count !== false) await job.updateData({ ...job.data, deferrals: (job.data.deferrals ?? 0) + 1 });
  await job.moveToDelayed(Date.now() + delayMs, token);
  throw new DelayedError();
}

/** True for the one failure that means "someone else holds the account": waiting is the right answer, failing is not. */
export const isBusy = (error: unknown): boolean => error instanceof AppError && error.code === "conflict_running";
