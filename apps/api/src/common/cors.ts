/** Forma mínima de la petición/respuesta: el monorepo resuelve dos copias de Fastify y sus tipos no se asignan entre sí. */
interface HookRequest { method: string; headers: Record<string, string | string[] | undefined> }
interface HookReply { header(name: string, value: string): unknown; status(code: number): { send(payload?: unknown): unknown } }

const ALLOWED_HEADERS = "Content-Type, X-CSRF-Token, X-Session-Mode, Authorization, Idempotency-Key";
const EXPOSED_HEADERS = "Content-Disposition";

export function allowedOrigins(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean));
}

/**
 * CORS para la web alojada en otro subdominio. Solo se aceptan orígenes listados de forma exacta en
 * `CORS_ALLOWED_ORIGINS` (nunca `*`, porque se envían cookies). Sin la variable no se agrega ninguna cabecera:
 * el comportamiento de mismo origen no cambia. Se lee en cada petición para poder probarlo sin reiniciar.
 */
export function corsHook(env: Record<string, string | undefined> = process.env) {
  return async (request: HookRequest, reply: HookReply): Promise<unknown> => {
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !allowedOrigins(env).has(origin)) return;
    reply.header("Vary", "Origin");
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Access-Control-Expose-Headers", EXPOSED_HEADERS);
    if (request.method === "OPTIONS" && request.headers["access-control-request-method"]) {
      reply.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      reply.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      reply.header("Access-Control-Max-Age", "600");
      return reply.status(204).send();
    }
  };
}
