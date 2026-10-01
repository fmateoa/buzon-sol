import type { MailBox } from "./index.js";

/**
 * `full` walks every page of a box. `incremental` relies on SUNAT listing newest first with stable pages (observed on
 * a 3 333-message box: page 1 holds the latest publications, the last page 2011) and stops at the first page whose
 * rows are all stored and unchanged. A change deep in the listing (an old item read in the SUNAT portal) is only
 * seen by a full pass, so a full pass is forced when none has completed recently.
 */
export type ScanKind = "full" | "incremental";

/** Days after which a complete full pass is considered stale and the next run must be full again. */
export const FULL_RECONCILE_DAYS = 7;

export type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

/**
 * Chooses the scan kind of a new run. Incremental is allowed only when every box of the run is covered by a complete
 * full pass of the account newer than `reconcileDays`; a partial full pass never counts, because it leaves holes
 * that an early stop would never fill. Pure SQL through the given `query`, so the API and the worker share it.
 */
export async function chooseScanKind(
  query: Query, accountId: string, boxes: readonly MailBox[],
  options: { full?: boolean; now?: Date; reconcileDays?: number } = {},
): Promise<ScanKind> {
  if (options.full) return "full";
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - (options.reconcileDays ?? FULL_RECONCILE_DAYS) * 86_400_000);
  for (const box of boxes) {
    const covered = await query(
      `SELECT 1 AS ok FROM sync_runs WHERE account_id=? AND state='complete' AND scan_kind='full'
         AND finished_at>? AND (boxes_json IS NULL OR JSON_CONTAINS(boxes_json, ?)) LIMIT 1`,
      [accountId, since, JSON.stringify(box)]);
    if (!covered.length) return "full";
  }
  return "incremental";
}
