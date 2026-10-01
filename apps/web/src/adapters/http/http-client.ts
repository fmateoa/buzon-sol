import { AppError, type AppErrorCode } from "@/domain/adapter";

/** Códigos del backend (`{ code }`) que la interfaz sabe explicar. El resto se trata como error inesperado. */
const KNOWN_CODES: ReadonlySet<string> = new Set<AppErrorCode>([
	"unauthenticated",
	"forbidden",
	"not_found",
	"needs_credential",
	"invalid_credential",
	"paused",
	"remote_session_expired",
	"remote_unavailable",
	"remote_disabled",
	"schema_changed",
	"incomplete_inventory",
	"conflict_running",
	"validation",
]);

/**
 * Misma origen por defecto (`/api/v1`, con proxy). Con la API en otro subdominio, `VITE_API_URL`
 * (origen sin barra final, p. ej. `https://api.buzon.example.com`) se fija al compilar la web.
 */
export const apiBaseUrl = (): string => `${String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api/v1`;

const CSRF_COOKIE = "bz_csrf";

/** Valor de la cookie CSRF (la de sesión es HttpOnly y JavaScript no puede leerla). */
const csrfToken = (): string | null => {
	if (typeof document === "undefined") return null;
	const entry = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
	return entry ? entry.slice(CSRF_COOKIE.length + 1) : null;
};

/**
 * Cliente de `/api/v1`. La sesión viaja en una cookie HttpOnly que fija la API al ingresar
 * (`X-Session-Mode: cookie`): JavaScript nunca ve el token y recargar la página no cierra la
 * sesión. Los POST/PATCH devuelven la cookie CSRF en `X-CSRF-Token`.
 */
export class HttpClient {
	constructor(private readonly baseUrl = apiBaseUrl()) {}

	private async fail(response: Response): Promise<never> {
		const code = await response
			.json()
			.then((payload: { code?: unknown }) => payload.code)
			.catch(() => undefined);
		if (typeof code === "string" && KNOWN_CODES.has(code)) throw new AppError(code as AppErrorCode);
		throw new Error(`HTTP ${response.status}`);
	}

	/** Archivo guardado, entregado por el proxy autenticado de la API (nunca una URL de SUNAT). */
	async blob(path: string): Promise<Blob> {
		const response = await fetch(`${this.baseUrl}${path}`, { method: "GET", cache: "no-store", credentials: "include" });
		if (!response.ok) return this.fail(response);
		return response.blob();
	}

	async request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
		const headers: Record<string, string> = { ...extraHeaders };
		const csrf = method === "GET" ? null : csrfToken();
		if (csrf) headers["X-CSRF-Token"] = csrf;
		// Sin cuerpo no se declara JSON: Fastify rechaza un cuerpo JSON vacío.
		if (body !== undefined) headers["Content-Type"] = "application/json";
		const response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", credentials: "include" });
		if (response.ok) {
			if (response.status === 204) return undefined as T;
			return (response.headers.get("content-type") ?? "").includes("json") ? ((await response.json()) as T) : ((await response.text()) as T);
		}
		return this.fail(response);
	}

	get = <T>(path: string) => this.request<T>("GET", path);
	post = <T>(path: string, body?: unknown, headers?: Record<string, string>) => this.request<T>("POST", path, body, headers);
	patch = <T>(path: string, body?: unknown) => this.request<T>("PATCH", path, body);
}
