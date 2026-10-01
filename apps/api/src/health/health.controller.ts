import { Controller, Get, Inject, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { DataSource } from "typeorm";
import { DB } from "../common/tokens";
import { pingRedis } from "../common/job-queue";

const CHECK_TIMEOUT_MS = 2_000;

/** Un chequeo con tope de tiempo; el motivo del fallo (host, credenciales, SQL) nunca sale de aquí. */
async function check(probe: () => Promise<unknown>): Promise<"ok" | "down"> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS); }),
    ]);
    return "ok";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

/** Redis solo es imprescindible cuando alguna puerta SUNAT encola trabajo; con todas apagadas la API sirve sin él. */
const redisRequired = (): boolean =>
  ["SUNAT_TRANSPORT_VALIDATED", "SUNAT_READ_VALIDATED", "SUNAT_CONNECTION_CLIENT_READY", "SUNAT_FILE_CLIENT_READY"]
    .some((name) => process.env[name] === "true");

@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: DataSource) {}

  /** Liveness: el proceso responde. No toca ninguna dependencia. */
  @Get()
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Readiness: puede servir su función esencial (MySQL y, si hay trabajo remoto habilitado, Redis). */
  @Get("ready")
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const database = await check(() => this.db.query("SELECT 1"));
    const redis = redisRequired() ? await check(pingRedis) : "skipped" as const;
    const ready = database === "ok" && redis !== "down";
    if (!ready) reply.status(503);
    return { status: ready ? "ok" : "unavailable", checks: { database, redis } };
  }
}
