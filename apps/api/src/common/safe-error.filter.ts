import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { QueryFailedError } from "typeorm";
import { AppError, logEvent } from "@buzon-sol/domain";

const STATUS: Record<string, number> = {
  unauthenticated: 401, forbidden: 403, not_found: 404, validation: 400,
  conflict_running: 409, needs_credential: 409, invalid_credential: 409,
  paused: 409, incomplete_inventory: 409, remote_session_expired: 502,
  remote_unavailable: 502, schema_changed: 502, storage_unavailable: 503,
};

/** Registrado globalmente (APP_FILTER): cubre todo controller, incluido health. Solo emite `{ code }`. */
@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (error instanceof AppError) {
      reply.status(STATUS[error.code] ?? 500).send({ code: error.code });
    } else if (error instanceof HttpException) {
      reply.status(error.getStatus()).send({ code: error.getStatus() < 500 ? "validation" : "internal" });
    } else if (error instanceof QueryFailedError && (error.driverError as { errno?: number }).errno === 1062) {
      reply.status(400).send({ code: "validation" });
    } else {
      // Never log SQL, request bodies, headers or remote URLs from unexpected errors.
      logEvent("error", "api_unexpected_error");
      reply.status(500).send({ code: "internal" });
    }
  }
}
