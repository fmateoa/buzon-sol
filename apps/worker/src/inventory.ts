import { randomUUID } from "node:crypto";
import { AppError, chooseScanKind, logEvent, type MailBox, type ScanKind } from "@buzon-sol/domain";
import {
  parseAlerts, parseFolders, parseLabels, scanBox,
  type InventoryClient,
} from "@buzon-sol/sunat-adapter";
import { DataSource } from "typeorm";
import { boxCode, persistPage, recordFailure, replaceCatalog } from "./inventory-store.js";
import { tryAccountLock } from "./account-lock.js";
import { hasUserDemand } from "./demand.js";

const ALL_BOXES: MailBox[] = ["messages", "notifications"];

/** Normalizes a configured box list to SUNAT order; an empty or unknown list is rejected. */
export function runBoxes(value: unknown): MailBox[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value ?? ALL_BOXES;
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every((box) => box === "messages" || box === "notifications")) {
    throw new AppError("validation");
  }
  return ALL_BOXES.filter((box) => parsed.includes(box));
}

type RunRow = {
  account_id: string; state: string; resume_box: number | null; resume_page: number | null;
  active: number; boxes_json: string | MailBox[] | null; scan_kind: ScanKind; yield_count: number;
};

/** `done`: the run reached its end or failed through an exception; `yielded`: it released the account to a user command and is `pending` again. */
export type RunOutcome = "done" | "yielded";

/** Opens one session for one account. The runner calls it only after taking the account lock and revalidating the run. */
export type InventoryClientFactory = () => InventoryClient | Promise<InventoryClient>;

export class InventoryRunner {
  constructor(private readonly db: DataSource, private readonly clientFactory: InventoryClientFactory) {}

  async createRun(accountId: string, mode: "manual" | "test" | "initial" = "manual", boxes: MailBox[] = ALL_BOXES,
    options: { full?: boolean } = {}): Promise<string> {
    const scope = runBoxes(boxes);
    const rows: { active: number }[] = await this.db.query("SELECT active FROM sunat_accounts WHERE id=?", [accountId]);
    if (!rows.length) throw new AppError("not_found");
    if (!rows[0].active) throw new AppError("paused");
    const id = randomUUID();
    const scanKind = await chooseScanKind((sql, params) => this.db.query(sql, params), accountId, scope, options);
    await this.db.query(
      "INSERT INTO sync_runs (id,account_id,mode,state,resume_box,resume_page,boxes_json,scan_kind) VALUES (?,?,?,?,?,?,?,?)",
      [id, accountId, mode, "pending", boxCode[scope[0]], 1, JSON.stringify(scope), scanKind],
    );
    return id;
  }

  async run(accountId: string, runId: string, maxPages = 500, maxReauth = 2): Promise<RunOutcome> {
    // A connection-scoped MySQL lock survives page transactions and is released on process death.
    const startedAt = Date.now();
    let reauths = 0;
    let client: InventoryClient | undefined;
    const lock = await tryAccountLock(this.db, accountId);
    if (!lock) throw new AppError("conflict_running");
    try {
      const rows: RunRow[] = await this.db.query(`SELECT r.account_id,r.state,r.resume_box,r.resume_page,r.boxes_json,r.scan_kind,r.yield_count,a.active
        FROM sync_runs r JOIN sunat_accounts a ON a.id=r.account_id WHERE r.id=?`, [runId]);
      const run = rows[0];
      if (!run || run.account_id !== accountId) throw new AppError("not_found");
      if (!run.active) throw new AppError("paused");
      if (run.state === "complete") return "done";
      const boxes = runBoxes(run.boxes_json);
      await this.db.query("UPDATE sync_runs SET state='running',error_code=NULL,started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?", [runId]);
      // The session opens only here: job, account and run are valid and no other job of the account is active.
      client = await this.clientFactory();
      // A run resumed after yielding already refreshed them: do not repeat three requests per resumption.
      if (!run.yield_count) await this.refreshAuxiliary(client, accountId, runId);
      let outcome: RunOutcome = "done";
      for (;;) {
        try {
          outcome = await this.scan(client, accountId, runId, boxes, maxPages, run.scan_kind === "incremental");
          break;
        } catch (error) {
          // A bounded number of fresh sessions; the checkpoint makes the retry continue at the pending page.
          if (!(error instanceof AppError) || error.code !== "remote_session_expired" ||
              !client.reauthenticate || reauths >= maxReauth) throw error;
          reauths++;
          await this.db.query("UPDATE sync_runs SET reauth_count=reauth_count+1 WHERE id=?", [runId]);
          await client.reauthenticate();
        }
      }
      if (outcome === "yielded") {
        // The checkpoint is already durable: back to `pending` so the same queued job resumes it once the user command ran.
        await this.db.query("UPDATE sync_runs SET state='pending',yield_count=yield_count+1 WHERE id=? AND account_id=? AND state='running'", [runId, accountId]);
        logEvent("info", "inventory_run_yielded", { accountId, runId, durationMs: Date.now() - startedAt });
        return "yielded";
      }
      await this.db.query("UPDATE sunat_accounts SET sync_failure_streak=0 WHERE id=?", [accountId]);
      await this.logFinished(accountId, runId, startedAt, reauths, null);
      return "done";
    } catch (error) {
      const code = error instanceof AppError ? error.code : "remote_unavailable";
      if (code !== "conflict_running") {
        await this.db.query("UPDATE sync_runs SET state='partial',error_code=? WHERE id=? AND account_id=? AND state='running'", [code, runId, accountId]);
        // A session that never opened keeps the pre-lock policy: the run is partial but the account's failure streak is untouched.
        if (client && ["invalid_credential", "remote_session_expired", "remote_unavailable", "schema_changed", "incomplete_inventory"].includes(code)) {
          await recordFailure(this.db, accountId, code);
        }
        await this.logFinished(accountId, runId, startedAt, reauths, code);
      }
      throw error;
    } finally {
      try { await client?.close?.(); }
      catch { logEvent("warn", "sunat_session_cleanup_failed", { accountId }); }
      await lock.release();
    }
  }

  /**
   * Walks the pending boxes from the checkpoint. After each stored page it asks whether a person is waiting on the
   * account and, if so, stops with `yielded`; an incremental run also ends a box at the first page with nothing new.
   */
  private async scan(client: InventoryClient, accountId: string, runId: string, boxes: MailBox[], maxPages: number,
    incremental: boolean): Promise<RunOutcome> {
    const rows: { resume_box: number | null; resume_page: number | null }[] = await this.db.query(
      "SELECT resume_box,resume_page FROM sync_runs WHERE id=?", [runId]);
    const resumeBox = rows[0]?.resume_box;
    if (resumeBox == null) return "done";
    for (const box of boxes) {
      if (boxCode[box] < resumeBox) continue;
      const startPage = boxCode[box] === resumeBox ? rows[0].resume_page ?? 1 : 1;
      let yielded = false;
      await scanBox(client, box, async (page) => {
        if ((await persistPage(this.db, accountId, runId, boxes, page, incremental)) === "box_done") return "stop";
        if (!page.confirmedEmpty && await hasUserDemand(this.db, accountId)) { yielded = true; return "stop"; }
      }, startPage, maxPages);
      if (yielded) return "yielded";
    }
    return "done";
  }

  /**
   * Folders, labels and alerts are auxiliary (S-09–S-12). A failed or unparsable SUNAT response marks that catalog
   * `unavailable` and never stops or empties the inventory; the stored catalog is replaced only by a parsed response.
   * A MySQL failure while persisting is not a remote failure: it propagates and fails the run, so it is never
   * reported as `unavailable`.
   */
  private async refreshAuxiliary(client: InventoryClient, accountId: string, runId: string): Promise<void> {
    const step = async <T>(column: string, remote: (() => Promise<T>) | null, persist: (value: T) => Promise<void>) => {
      if (!remote) return;
      let state = "ok";
      let value: T | undefined;
      try { value = await remote(); }
      catch { state = "unavailable"; }
      if (state === "ok") await persist(value as T);
      await this.db.query(`UPDATE sync_runs SET ${column}=? WHERE id=?`, [state, runId]);
    };
    await step("folders_state", client.listFolders ? async () => parseFolders(await client.listFolders!()) : null,
      (folders) => replaceCatalog(this.db, "sunat_folders", accountId,
        folders.map((folder) => [folder.code, folder.name, null, folder.messageCount])));
    await step("labels_state", client.visorHtml ? async () => parseLabels(await client.visorHtml!()) : null,
      (labels) => replaceCatalog(this.db, "sunat_labels", accountId,
        labels.map((label) => [label.code, label.name, label.color, label.messageCount])));
    await step("alerts_state", client.consultAlerts ? async () => parseAlerts(await client.consultAlerts!()).alerts : null,
      async (alerts) => { await this.db.query("UPDATE sync_runs SET alerts_json=? WHERE id=?", [JSON.stringify(alerts), runId]); });
  }

  private async logFinished(accountId: string, runId: string, startedAt: number, reauths: number, errorCode: string | null): Promise<void> {
    const pages: { pages: number; received: number | null; unique_rows: number | null }[] = await this.db.query(
      "SELECT COUNT(*) AS pages,SUM(rows_received) AS received,SUM(unique_rows) AS unique_rows FROM sync_pages WHERE run_id=?", [runId]);
    logEvent(errorCode ? "warn" : "info", "inventory_run_finished", {
      accountId, runId, runState: errorCode ? "partial" : "complete", errorCode, durationMs: Date.now() - startedAt,
      pages: Number(pages[0]?.pages ?? 0), rowsReceived: Number(pages[0]?.received ?? 0),
      newRows: Number(pages[0]?.unique_rows ?? 0), reauths,
    });
  }
}
