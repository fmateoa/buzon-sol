import { logEvent } from "@buzon-sol/domain";

type Env = Record<string, string | undefined>;

const SUNAT_GATES = ["ENABLE_SUNAT_JOBS", "SUNAT_TRANSPORT_VALIDATED", "SUNAT_READ_VALIDATED", "SUNAT_CONNECTION_CLIENT_READY",
  "SUNAT_FILE_CLIENT_READY", "SUNAT_CRON_VALIDATED", "SUNAT_PASSIVE_START_VALIDATED"];

const port = (env: Env, name: string, fallback: number): void => {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`Invalid ${name}`);
};

/**
 * Valida al arrancar la API lo que de otro modo fallaría en la primera petición. Los errores nombran variables,
 * nunca valores. Las puertas SUNAT solo valen con `"true"` explícito; cualquier otro valor (salvo `"false"`) es un error.
 * Las pruebas construyen `AppModule` directamente y no pasan por aquí.
 */
export function validateApiConfig(env: Env = process.env): void {
  port(env, "API_PORT", 3000);
  port(env, "DB_PORT", 3306);
  for (const name of SUNAT_GATES) {
    const value = env[name];
    if (value !== undefined && value !== "" && value !== "true" && value !== "false") throw new Error(`Invalid ${name}`);
  }
  const missing = ["SOL_PUBLIC_KEY_PEM", "SOL_KEY_ID", "ACCOUNT_FINGERPRINT_KEY_B64"].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Invalid configuration: ${missing.join(", ")} required`);
  if (Buffer.from(env.ACCOUNT_FINGERPRINT_KEY_B64 ?? "", "base64").length < 32) throw new Error("Invalid ACCOUNT_FINGERPRINT_KEY_B64");
  if (env.REDIS_URL) {
    try {
      const { protocol } = new URL(env.REDIS_URL);
      if (protocol !== "redis:" && protocol !== "rediss:") throw new Error();
    } catch { throw new Error("Invalid REDIS_URL"); }
  }
  // El worker es el único que abre la Clave SOL. Si el despliegue comparte el entorno con la API, se avisa.
  if (env.SOL_PRIVATE_KEY_PEM) logEvent("warn", "api_has_worker_private_key");
}
