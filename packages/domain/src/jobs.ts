export const INVENTORY_QUEUE = "buzon-inventory";
export const READ_QUEUE = "buzon-read";
export const CONNECTION_QUEUE = "buzon-connection";
export const FILE_QUEUE = "buzon-file";
export interface InventoryJob {
  accountId: string;
  runId: string;
}
export interface ReadJob {
  accountId: string;
  eventId: string;
}
export interface ConnectionJob {
  accountId: string;
  testId: string;
}
export interface FileJob {
  accountId: string;
  fetchId: string;
}
