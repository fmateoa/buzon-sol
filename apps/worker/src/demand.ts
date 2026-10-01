import { DataSource } from "typeorm";

/** A person who asked for something stops waiting after this long; older rows are leftovers, not demand. */
const DEMAND_WINDOW_MINUTES = 10;

/**
 * Whether a user is waiting on this account for a read, a file or a connection test. Long background work (the
 * inventory) asks this between pages and releases the account when it is true, so a click is never stuck behind an
 * 18-minute walk of a large mailbox. Persisted state only: it never contacts SUNAT, and system work (archive batches,
 * P-03 downloads) does not count because nobody is waiting on it.
 */
export async function hasUserDemand(db: DataSource, accountId: string): Promise<boolean> {
  const rows: unknown[] = await db.query(
    `(SELECT 1 AS waiting FROM mail_read_events
        WHERE account_id=? AND origin='user' AND status='pending'
          AND created_at>UTC_TIMESTAMP(6) - INTERVAL ${DEMAND_WINDOW_MINUTES} MINUTE LIMIT 1)
     UNION ALL
     (SELECT 1 FROM file_fetches
        WHERE account_id=? AND origin='user' AND status IN ('pending','fetching')
          AND created_at>UTC_TIMESTAMP(6) - INTERVAL ${DEMAND_WINDOW_MINUTES} MINUTE LIMIT 1)
     UNION ALL
     (SELECT 1 FROM connection_tests
        WHERE account_id=? AND status='pending'
          AND created_at>UTC_TIMESTAMP(6) - INTERVAL ${DEMAND_WINDOW_MINUTES} MINUTE LIMIT 1)
     LIMIT 1`, [accountId, accountId, accountId]);
  return rows.length > 0;
}
