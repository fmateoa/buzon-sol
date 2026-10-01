import { limaInstant } from "./schedule.js";

/**
 * SUNAT publishes `dd/mm/yyyy hh:mm:ss` without a zone. The explicit interpretation is America/Lima;
 * callers keep the original text next to the result. Unknown formats return null instead of guessing.
 */
export function parseSunatDateTime(text: unknown): Date | null {
  if (typeof text !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!match) return null;
  const [day, month, year, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return new Date(limaInstant(year, month, day, hour * 60 + minute).getTime() + second * 1000);
}
