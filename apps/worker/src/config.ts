export interface WorkerConfig {
  /** `ENABLE_SUNAT_JOBS`: sin ella el proceso queda ocioso y no abre MySQL ni Redis. */
  enabled: boolean;
  connection: boolean;
  transport: boolean;
  reading: boolean;
  files: boolean;
  cron: boolean;
  recoveryMs: number;
  schedulerMs: number;
}

type Env = Record<string, string | undefined>;

/** Una puerta vale solo con `"true"` explícito; `"false"` o ausente la apaga. Cualquier otro valor es un error de despliegue. */
function gate(env: Env, name: string): boolean {
  const value = env[name];
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`Invalid ${name}`);
}

function interval(env: Env, name: string, fallback: number): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 10_000) throw new Error(`Invalid ${name}`);
  return value;
}

function require(env: Env, names: string[], reason: string): void {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Invalid configuration: ${missing.join(", ")} required for ${reason}`);
}

/**
 * Valida la configuración del worker antes de abrir ninguna conexión. Los mensajes llevan solo nombres de variables,
 * nunca sus valores. Los secretos se exigen solo para las capacidades habilitadas.
 */
export function loadWorkerConfig(env: Env = process.env): WorkerConfig {
  const enabled = gate(env, "ENABLE_SUNAT_JOBS");
  const empty = { enabled: false, connection: false, transport: false, reading: false, files: false, cron: false,
    recoveryMs: 0, schedulerMs: 0 };
  if (!enabled) return empty;
  const transport = gate(env, "SUNAT_TRANSPORT_VALIDATED"), reading = gate(env, "SUNAT_READ_VALIDATED");
  const connection = gate(env, "SUNAT_CONNECTION_CLIENT_READY"), files = gate(env, "SUNAT_FILE_CLIENT_READY");
  const cron = gate(env, "SUNAT_CRON_VALIDATED");
  if (!connection && !transport) throw new Error("SUNAT jobs need an explicitly validated capability");
  if (cron && !transport) throw new Error("SUNAT cron requires validated inventory transport");
  if (reading && !transport) throw new Error("SUNAT reading requires validated inventory transport");
  if (files && (!reading || !transport)) throw new Error("SUNAT files require validated reading and inventory");
  const recoveryMs = interval(env, "RECOVERY_INTERVAL_MS", 300_000);
  const schedulerMs = interval(env, "SCHEDULER_INTERVAL_MS", 60_000);
  // Todo trabajo remoto abre la Clave SOL de una cuenta; el worker es el único con la clave privada.
  require(env, ["SOL_PRIVATE_KEY_PEM"], "SUNAT jobs");
  if (files) require(env, ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"], "SUNAT file storage");
  return { enabled, connection, transport, reading, files, cron, recoveryMs, schedulerMs };
}
