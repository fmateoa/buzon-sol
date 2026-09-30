/**
 * Structured operational log. Only whitelisted-by-shape values leave the process: known secret or content keys are
 * replaced, strings are length-limited, and standalone digit runs that could be a RUC or document number are
 * masked (UUID segments are kept).
 */
const forbiddenKey = /pass|clave|secret|token|cookie|authorization|^hc$|^state$|datos|ruc|sol_?user|subject|asunto|body|cuerpo|url|referer|header|html|detail|mensaje$|des[A-Z_]/i;
const maxText = 120;

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;
export type LogSink = (line: string) => void;

function clean(key: string, value: LogValue): LogValue {
  if (value === undefined || value === null || typeof value === "boolean") return value;
  if (forbiddenKey.test(key)) return "[redacted]";
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const masked = value.replace(/(?<![0-9A-Za-z-])\d{8,}(?![0-9A-Za-z-])/g,(digits) => `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`);
  return masked.length > maxText ? `${masked.slice(0, maxText)}…` : masked;
}

export function redactFields(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, clean(key, value)]));
}

let sink: LogSink = (line) => process.stdout.write(`${line}\n`);

/** Tests replace the sink to assert on emitted lines. */
export function setLogSink(next: LogSink): LogSink {
  const previous = sink;
  sink = next;
  return previous;
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  sink(JSON.stringify({ at: new Date().toISOString(), level, event, ...redactFields(fields) }));
}
