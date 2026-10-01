import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { logEvent } from "@buzon-sol/domain";
import dataSource from "./db/data-source";
import { validateApiConfig } from "./config";
import { AppModule } from "./module";
import { cookieSessionHook } from "./auth/session-cookie";
import { corsHook } from "./common/cors";

const SHUTDOWN_GRACE_MS = 15_000;

async function main(): Promise<void> {
  validateApiConfig();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // Request headers and bodies may contain SOL secrets; do not enable request logging.
    logger: ["error", "warn"],
  });
  app.setGlobalPrefix("api/v1");
  // CORS primero: el preflight no lleva cookies y debe responderse antes de la autenticación.
  app.getHttpAdapter().getInstance().addHook("onRequest", corsHook());
  app.getHttpAdapter().getInstance().addHook("onRequest", cookieSessionHook);
  await app.listen(Number(process.env.API_PORT ?? 3000), "0.0.0.0");

  // Orden de cierre: dejar de aceptar peticiones y esperar las en curso, luego soltar la conexión MySQL.
  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    const forced = setTimeout(() => { logEvent("error", "api_shutdown_forced"); process.exit(1); }, SHUTDOWN_GRACE_MS);
    forced.unref();
    try {
      await app.close();
      if (dataSource.isInitialized) await dataSource.destroy();
      logEvent("info", "api_stopped");
    } catch {
      logEvent("error", "api_shutdown_failed");
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

main().catch((error) => {
  // Configuration errors carry no secrets; anything else is reported without its message.
  logEvent("error", "api_stopped", { reason: error instanceof Error && /^Invalid /.test(error.message) ? error.message : "unexpected" });
  process.exitCode = 1;
});
