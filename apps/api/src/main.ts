import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./module";
import { cookieSessionHook } from "./session-cookie";

async function main(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // Request headers and bodies may contain SOL secrets; do not enable request logging.
    logger: ["error", "warn"],
  });
  app.setGlobalPrefix("api/v1");
  app.getHttpAdapter().getInstance().addHook("onRequest", cookieSessionHook);
  await app.listen(Number(process.env.API_PORT ?? 3000), "0.0.0.0");
}

void main();
