import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply } from "fastify";

/** Forma mínima de la petición: el monorepo resuelve dos copias de Fastify y sus tipos no se asignan entre sí. */
interface HookRequest { method: string; url: string; headers: Record<string, string | string[] | undefined> }
interface HookReply { status(code: number): { send(payload: unknown): unknown } }

/** Cookie de sesión (HttpOnly) y cookie CSRF (legible por la web, que la devuelve en `X-CSRF-Token`). */
export const SESSION_COOKIE = "bz_session";
export const CSRF_COOKIE = "bz_csrf";
/** El cliente web pide este modo al ingresar: el token viaja solo en la cookie HttpOnly, no en el cuerpo. */
export const COOKIE_MODE_HEADER = "x-session-mode";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function parseCookies(header: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    const name = i > 0 ? part.slice(0, i).trim() : "";
    if (name) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

const secure = () => (process.env.SESSION_COOKIE_SECURE ?? String(process.env.NODE_ENV === "production")) === "true";

function cookie(name: string, value: string, path: string, httpOnly: boolean, expires: Date): string {
  return [`${name}=${value}`, `Path=${path}`, `Expires=${expires.toUTCString()}`, "SameSite=Strict",
    ...(httpOnly ? ["HttpOnly"] : []), ...(secure() ? ["Secure"] : [])].join("; ");
}

export function setSessionCookies(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.header("Set-Cookie", [
    cookie(SESSION_COOKIE, token, "/api/v1", true, expiresAt),
    cookie(CSRF_COOKIE, randomBytes(24).toString("base64url"), "/", false, expiresAt),
  ]);
}

export function clearSessionCookies(reply: FastifyReply): void {
  const past = new Date(0);
  reply.header("Set-Cookie", [cookie(SESSION_COOKIE, "", "/api/v1", true, past), cookie(CSRF_COOKIE, "", "/", false, past)]);
}

function sameValue(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Hook `onRequest`: sin `Authorization`, convierte la cookie de sesión en `Bearer` para que todo el
 * resto de la API siga autenticando igual. Con cookie, los métodos que modifican exigen el doble
 * envío CSRF (cookie + cabecera iguales); `Bearer` explícito no depende de cookies y no lo necesita.
 */
export async function cookieSessionHook(request: HookRequest, reply: HookReply): Promise<unknown> {
  // El login nunca usa una sesión previa: una cookie vencida no debe bloquearlo.
  if (request.headers.authorization || request.url.split("?")[0]!.endsWith("/auth/login")) return;
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return;
  if (!SAFE_METHODS.has(request.method)) {
    const header = request.headers["x-csrf-token"];
    const expected = cookies[CSRF_COOKIE];
    if (typeof header !== "string" || !expected || !sameValue(header, expected)) {
      return reply.status(403).send({ code: "forbidden" });
    }
  }
  request.headers.authorization = `Bearer ${token}`;
}
