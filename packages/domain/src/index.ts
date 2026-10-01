export const PERMISSIONS = [
  "view_mailbox", "read_content", "download_file", "mark_reviewed",
  "run_inventory", "view_audit", "configure_schedule", "manage_accounts",
  "manage_users_roles", "manage_settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Ajustes editables desde Configuraciones. Solo se guardan los que difieren del valor por defecto. */
export const SETTING_DEFINITIONS = {
  "session.absoluteMinutes": { group: "session", unit: "minutes", default: 720, min: 15, max: 43200 },
  "session.idleMinutes": { group: "session", unit: "minutes", default: 60, min: 5, max: 43200 },
  "security.passwordMinLength": { group: "security", unit: "characters", default: 12, min: 8, max: 64 },
  "security.maxFailedLogins": { group: "security", unit: "attempts", default: 5, min: 3, max: 20 },
  "security.lockoutMinutes": { group: "security", unit: "minutes", default: 15, min: 1, max: 1440 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];
export type MailBox = "messages" | "notifications";
export type SyncState = "pending" | "running" | "complete" | "partial" | "retrying" | "paused";
export type ErrorCode =
  | "unauthenticated" | "forbidden" | "not_found" | "needs_credential"
  | "invalid_credential" | "paused" | "remote_session_expired"
  | "remote_unavailable" | "schema_changed" | "incomplete_inventory"
  | "conflict_running" | "validation" | "storage_unavailable";

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message = code) {
    super(message);
    this.name = "AppError";
  }
}

/** An account ID from a request is never evidence of access. */
export function requireAccountAccess(
  granted: readonly Permission[],
  required: Permission,
  allAccounts: boolean,
  assignedAccountIds: readonly string[],
  accountId: string,
): void {
  if (!granted.includes(required) || (!allAccounts && !assignedAccountIds.includes(accountId))) {
    throw new AppError("forbidden");
  }
}

export interface InventoryPageDto {
  accountId: string;
  box: MailBox;
  page: number;
  rowsReceived: number;
  uniqueRows: number;
  declaredRecords: number | null;
  declaredPages: number | null;
  confirmedEmpty: boolean;
}

export interface InventoryRunDto {
  id: string;
  accountId: string;
  state: SyncState;
  resumeFrom: { box: MailBox; page: number } | null;
  pages: InventoryPageDto[];
}

export interface VisibleAccountDto {
  id: string;
  alias: string;
  rucMasked: string;
  active: boolean;
}

export { encryptForWorker, decryptInWorker, envelopeKeyId } from "./secrets.js";
export { nextRuns, validateSchedule, WEEKDAYS, type ScheduleInput, type Frequency, type Weekday } from "./schedule.js";
export { INVENTORY_QUEUE, READ_QUEUE, CONNECTION_QUEUE, FILE_QUEUE, ARCHIVE_QUEUE, type InventoryJob, type ReadJob, type ConnectionJob, type FileJob, type ArchiveJob } from "./jobs.js";
export { redisOptions, redisApiOptions } from "./redis.js";
export { parseSunatDateTime, renderStructuredBody } from "./mail.js";
export { logEvent, redactFields, setLogSink, type LogFields } from "./log.js";
