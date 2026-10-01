export const INVENTORY_QUEUE = "buzon-inventory";
export const READ_QUEUE = "buzon-read";
export const CONNECTION_QUEUE = "buzon-connection";
export const FILE_QUEUE = "buzon-file";
export const ARCHIVE_QUEUE = "buzon-archive";
/** `deferrals`: times the job was postponed because the account was busy or yielded to a user command. */
export interface InventoryJob {
  accountId: string;
  runId: string;
  deferrals?: number;
}
export interface ReadJob {
  accountId: string;
  eventId: string;
}
export interface ConnectionJob {
  accountId: string;
  testId: string;
  deferrals?: number;
}
export interface FileJob {
  accountId: string;
  fetchId: string;
  deferrals?: number;
}
export interface ArchiveJob {
  accountId: string;
  runId: string;
}
