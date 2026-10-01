import { DataSource } from "typeorm";
import { AppError, logEvent, type ErrorCode, type MailBox } from "@buzon-sol/domain";
import { S3Storage } from "@buzon-sol/storage";
import { type DetailFile } from "./detail-store.js";
import { storeFile, type FileResponse, type ObjectStore } from "./files.js";
import { tryAccountLock } from "./account-lock.js";
import {
  MAX_FAILURES, closeFileFetch, closeReadEvent, completeRead, countRemaining, filesGate, finishRun, loadItemState,
  loadRetryableAssets, loadRun, openFileFetch, openReadEvent, rejectCredential, saveCounters, selectCandidates,
  startRun, stopAfterUnexpectedRead, type Candidate, type Counters,
} from "./archive-store.js";

export interface ArchiveDetail {
  body: string;
  indTexto?: string | null;
  updateLeido: boolean | null;
  generatedUrl?: string | null;
  files?: DetailFile[];
}
/** One SUNAT session of one account. Downloads follow the detail they belong to, in the same session. */
export interface ArchiveClient {
  readDetail(box: MailBox, codMensaje: string): Promise<ArchiveDetail>;
  downloadAttachment(codArchivo: string): Promise<FileResponse>;
  downloadGeneratedDocument(generatedUrl: string): Promise<FileResponse>;
  close?(): Promise<void>;
}
export type ArchiveClientFactory = (accountId: string) => ArchiveClient | Promise<ArchiveClient>;
export interface ArchiveOutcome { state: "complete" | "partial"; remaining: number; progressed: boolean }

const codeOf = (error: unknown): ErrorCode => error instanceof AppError ? error.code : "remote_unavailable";

/**
 * Stores the content and files of items already read in SUNAT: the coordinator of one bounded batch and one session.
 * Every `readDetail` call, including the reopening before a `codArchivo=0` download, is preceded by its own durable
 * `mail_read_events` row with `origin='archive'`, and any `updateLeido=true` stops the batch and switches the archive
 * off. SQL lives in `archive-store.ts`; planning and recovery of batches in `archive-plan.ts`.
 */
export class ArchiveProcessor {
  constructor(private readonly db: DataSource, private readonly clientFactory: ArchiveClientFactory,
    private store?: ObjectStore) {}

  async process(accountId: string, runId: string): Promise<ArchiveOutcome | null> {
    const startedAt = Date.now();
    const counters: Counters = { itemsDone: 0, itemsFailed: 0, filesStored: 0, filesFailed: 0 };
    const lock = await tryAccountLock(this.db, accountId);
    if (!lock) {
      await this.finish(accountId, runId, counters, startedAt, "conflict_running", false);
      throw new AppError("conflict_running");
    }
    let client: ArchiveClient | undefined;
    try {
      const run = await loadRun(this.db, accountId, runId);
      if (!run) throw new AppError("not_found");
      // `running` with the lock free is a batch whose process died: it continues, since every step is idempotent.
      if (run.state !== "pending" && run.state !== "running") return null;
      try {
        if (process.env.SUNAT_READ_VALIDATED !== "true") throw new AppError("remote_unavailable");
        if (!run.active || !run.archive_content) throw new AppError("paused");
        const files = Boolean(run.archive_files) && filesGate();
        await startRun(this.db, accountId, runId);
        const candidates = await selectCandidates(this.db, accountId, files, run.archive_batch_size);
        let abort: ErrorCode | null = null;
        if (candidates.length) {
          client = await this.clientFactory(accountId);
          abort = await this.archiveItems(accountId, runId, candidates, client, files, counters);
        }
        return await this.finish(accountId, runId, counters, startedAt, abort, files);
      } catch (error) {
        const code = codeOf(error);
        if (code === "invalid_credential") await rejectCredential(this.db, accountId);
        await this.finish(accountId, runId, counters, startedAt, code, false);
        throw error;
      }
    } finally {
      try { await client?.close?.(); }
      catch { logEvent("warn", "sunat_session_cleanup_failed", { accountId }); }
      await lock.release();
    }
  }

  /**
   * One `readDetail` with its intent committed first. The event is closed here when the request fails; on success
   * the caller closes it (with the stored detail for the item's own request, alone for a reopening).
   */
  private async requestDetail(accountId: string, item: Candidate, box: MailBox, remoteBefore: number,
    client: ArchiveClient): Promise<{ detail: ArchiveDetail; eventId: string }> {
    const eventId = await openReadEvent(this.db, accountId, item.id, remoteBefore);
    try { return { detail: await client.readDetail(box, item.cod_mensaje), eventId }; }
    catch (error) {
      // An expired session says nothing about the item; any other failure counts against it.
      await closeReadEvent(this.db, eventId, codeOf(error) === "remote_session_expired" ? "aborted" : "failed");
      throw error;
    }
  }

  /** Returns the error that stopped the batch, or null when every candidate was attempted. */
  private async archiveItems(accountId: string, runId: string, candidates: Candidate[], client: ArchiveClient,
    files: boolean, counters: Counters): Promise<ErrorCode | null> {
    let consecutive = 0;
    for (const item of candidates) {
      // The account may be disabled or opt out while the batch runs, and the stored state is rechecked per item.
      const current = await loadItemState(this.db, accountId, item.id);
      if (!current || !current.active || !current.archive_content) return "paused";
      if (Number(current.ind_estado) === 0) continue;
      const box: MailBox = Number(item.tipo_msj) === 1 ? "messages" : "notifications";
      let requested: { detail: ArchiveDetail; eventId: string };
      try { requested = await this.requestDetail(accountId, item, box, current.ind_estado, client); }
      catch (error) {
        const code = codeOf(error);
        if (code === "remote_session_expired" || code === "invalid_credential") return code;
        counters.itemsFailed++;
        if (++consecutive >= MAX_FAILURES) return code;
        await saveCounters(this.db, runId, counters);
        continue;
      }
      consecutive = 0;
      const { detail, eventId } = requested;
      await completeRead(this.db, accountId, item.id, eventId, detail);
      counters.itemsDone++;
      if (detail.updateLeido === true) {
        await this.stopAfterUnexpectedRead(accountId, runId, item.id);
        return "schema_changed";
      }
      // Re-read per item: switching `archive_files` off during a batch stops the next downloads.
      if (files && current.archive_files) {
        const stopped = await this.archiveFiles(accountId, runId, item, box, detail, client, counters);
        if (stopped) return stopped;
      }
      await saveCounters(this.db, runId, counters);
    }
    return null;
  }

  private async archiveFiles(accountId: string, runId: string, item: Candidate, box: MailBox, detail: ArchiveDetail,
    client: ArchiveClient, counters: Counters): Promise<ErrorCode | null> {
    const assets = await loadRetryableAssets(this.db, accountId, item.id);
    const announced = detail.files ?? [];
    const store = this.store ??= new S3Storage();
    // `codArchivo=0` is resolved by SUNAT from the detail just opened, so that download directly follows its detail.
    let detailIsLatest = true;
    for (const asset of assets) {
      const fetchId = await openFileFetch(this.db, accountId, asset.id);
      let code: ErrorCode | null = null;
      let unexpectedRead = false;
      try {
        await storeFile(this.db, store, accountId, asset, async () => {
          if (asset.kind === "generated_document") {
            const matches = announced.filter((file) => file.kind === "generated_document" && (file.numId ?? null) === asset.num_id);
            if (!detail.generatedUrl || matches.length !== 1) throw new AppError("schema_changed");
            detailIsLatest = false;
            return client.downloadGeneratedDocument(detail.generatedUrl);
          }
          const fileCode = asset.cod_archivo;
          const matches = announced.filter((file) => file.kind === "attachment" && String(file.codArchivo) === fileCode);
          if (!fileCode || matches.length !== 1) throw new AppError("schema_changed");
          if (fileCode === "0" && !detailIsLatest) {
            // The reopening is a detail request like any other: recheck, record its intent, and honour `updateLeido`.
            const state = await loadItemState(this.db, accountId, item.id);
            if (!state || !state.active || !state.archive_content || !state.archive_files || Number(state.ind_estado) === 0) {
              throw new AppError("paused");
            }
            const reopened = await this.requestDetail(accountId, item, box, state.ind_estado, client);
            await closeReadEvent(this.db, reopened.eventId, "complete", reopened.detail.updateLeido);
            if (reopened.detail.updateLeido === true) {
              unexpectedRead = true;
              await this.stopAfterUnexpectedRead(accountId, runId, item.id);
              throw new AppError("schema_changed");
            }
          }
          detailIsLatest = false;
          return client.downloadAttachment(fileCode);
        });
        counters.filesStored++;
      } catch (error) {
        code = codeOf(error);
        counters.filesFailed++;
      }
      await closeFileFetch(this.db, fetchId, code);
      if (unexpectedRead) return "schema_changed";
      if (code === "storage_unavailable" || code === "remote_session_expired" || code === "paused") return code;
    }
    return null;
  }

  private async finish(accountId: string, runId: string, counters: Counters, startedAt: number,
    errorCode: ErrorCode | null, files: boolean): Promise<ArchiveOutcome> {
    const remaining = await countRemaining(this.db, accountId, files);
    const state = await finishRun(this.db, accountId, runId, counters, errorCode, remaining);
    logEvent(errorCode ? "warn" : "info", "archive_run_finished", { accountId, runId, runState: state, errorCode,
      durationMs: Date.now() - startedAt, ...counters, remaining });
    return { state, remaining, progressed: counters.itemsDone + counters.filesStored > 0 };
  }

  private async stopAfterUnexpectedRead(accountId: string, runId: string, itemId: string): Promise<void> {
    await stopAfterUnexpectedRead(this.db, accountId, runId, itemId);
    logEvent("error", "archive_unexpected_read", { accountId, runId });
  }
}
