import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountId, FileId, ItemId, RoleId } from "@/domain/types";
import { HttpAdapter } from "./http-adapter";

type Handler = (body: unknown, headers: Record<string, string>) => { status?: number; json?: unknown };

/** API simulada: una tabla `MÉTODO ruta` → respuesta, y el registro de lo que se pidió. */
const mockApi = (routes: Record<string, Handler>) => {
	const calls: { key: string; body: unknown; headers: Record<string, string> }[] = [];
	vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
		const key = `${init.method} ${url.replace("/api/v1", "")}`;
		const body = init.body ? JSON.parse(init.body as string) : undefined;
		const headers = init.headers as Record<string, string>;
		calls.push({ key, body, headers });
		const { status = 200, json } = routes[key]?.(body, headers) ?? { status: 404, json: { code: "not_found" } };
		return new Response(json === undefined ? null : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
	});
	return calls;
};

const ME = { id: "u1", email: "admin@empresa-demo.test", name: "Admin Demo", roleId: "r1", roleName: "Administrador", permissions: ["view_mailbox", "manage_users_roles", "permiso_desconocido"], preferences: { readWarningEnabled: true }, policy: { passwordMinLength: 14 } };
const SESSION_ROUTES: Record<string, Handler> = {
	"POST /auth/login": (_body, headers) => (headers["X-Session-Mode"] === "cookie" ? { status: 201, json: { expiresAt: "2026-10-01T12:00:00Z" } } : { status: 400, json: { code: "validation" } }),
	"GET /auth/me": () => ({ json: ME }),
	"GET /accounts": () => ({ json: [{ id: "a1", alias: "Cuenta Demo", active: 1, rucMasked: "*******0001", scheduleState: "paused", pauseReason: "remote_effect_not_accepted" }] }),
};

const signedIn = async (routes: Record<string, Handler> = {}) => {
	const calls = mockApi({ ...SESSION_ROUTES, ...routes });
	const adapter = new HttpAdapter();
	await adapter.login("admin@empresa-demo.test", "contraseña-ficticia");
	return { adapter, calls };
};

afterEach(() => vi.unstubAllGlobals());

describe("HttpAdapter · sesión", () => {
	it("tras recargar pregunta a la API: la cookie decide, y un 401 es sesión nula", async () => {
		const calls = mockApi({ "GET /auth/me": () => ({ status: 401, json: { code: "unauthenticated" } }) });
		expect(await new HttpAdapter().getSession()).toBeNull();
		expect(calls).toHaveLength(1);
		mockApi(SESSION_ROUTES);
		expect(await new HttpAdapter().getSession()).toMatchObject({ user: { name: "Admin Demo" } });
	});

	it("el ingreso pide sesión por cookie y no maneja token en JavaScript", async () => {
		const { calls } = await signedIn();
		expect(calls[0]?.headers).toMatchObject({ "X-Session-Mode": "cookie" });
		expect(calls.some((c) => "Authorization" in c.headers)).toBe(false);
	});

	it("arma la sesión con permisos conocidos y cuentas visibles", async () => {
		mockApi(SESSION_ROUTES);
		const result = await new HttpAdapter().login("admin@empresa-demo.test", "contraseña-ficticia");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.permissions).toEqual(["view_mailbox", "manage_users_roles"]);
		expect(result.data.user.roleName).toBe("Administrador");
		expect(result.data.visibleAccounts[0]).toMatchObject({ id: "a1", active: true, rucMasked: "*******0001", connection: { scheduleState: "paused", pauseReason: "manual" } });
	});

	it("credenciales rechazadas dan un único mensaje", async () => {
		mockApi({ "POST /auth/login": () => ({ status: 401, json: { code: "unauthenticated" } }) });
		const result = await new HttpAdapter().login("nadie@empresa-demo.test", "x");
		expect(result).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
	});

	it("un 401 posterior se informa como sesión terminada", async () => {
		const { adapter } = await signedIn({ "GET /users": () => ({ status: 401, json: { code: "unauthenticated" } }) });
		await expect(adapter.listUsers({ filters: { name: "", email: "", roleName: "", status: "all" }, sort: null, page: 1, pageSize: 20 })).rejects.toMatchObject({ code: "unauthenticated" });
	});
});

describe("HttpAdapter · gestión", () => {
	it("distingue consultas desactivadas de una falla de SUNAT", async () => {
		const { adapter } = await signedIn({ "POST /accounts/a1/inventory": () => ({ status: 503, json: { code: "remote_disabled" } }) });
		expect(await adapter.startInventory("a1" as AccountId)).toMatchObject({ ok: false, error: { code: "remote_disabled" } });
	});

	it("probar conexión encola la prueba y espera el resultado del worker", async () => {
		const finishedAt = new Date().toISOString();
		const states = ["testing", "valid"];
		const { adapter, calls } = await signedIn({
			"POST /admin/accounts/a1/connection-tests": () => ({ status: 201, json: { id: "t1", status: "pending" } }),
			"GET /admin/accounts/a1/connection-tests/t1": () => ({ json: { id: "t1", status: states.shift(), errorCode: null, finishedAt } }),
			"POST /admin/accounts/a2/connection-tests": () => ({ status: 201, json: { id: "t2", status: "pending" } }),
			"GET /admin/accounts/a2/connection-tests/t2": () => ({ json: { id: "t2", status: "invalid", errorCode: "invalid_credential", finishedAt } }),
			"POST /admin/accounts/a3/connection-tests": () => ({ status: 502, json: { code: "remote_unavailable" } }),
			"POST /admin/accounts/a4/connection-tests": () => ({ status: 201, json: { id: "t4", status: "pending" } }),
			"GET /admin/accounts/a4/connection-tests/t4": () => ({ json: { id: "t4", status: "failed", errorCode: "schema_changed", finishedAt } }),
		});
		Object.assign(adapter, { pollMs: 1 });
		expect(await adapter.testConnection("a1" as AccountId)).toEqual({ ok: true, data: { accepted: true, autoOpenedFirstItem: false, testedAt: finishedAt } });
		expect(calls.filter((c) => c.key === "GET /admin/accounts/a1/connection-tests/t1")).toHaveLength(2);
		expect(await adapter.testConnection("a2" as AccountId)).toMatchObject({ ok: true, data: { accepted: false } });
		expect(await adapter.testConnection("a3" as AccountId)).toMatchObject({ ok: false, error: { code: "remote_unavailable" } });
		expect(await adapter.testConnection("a4" as AccountId)).toMatchObject({ ok: false, error: { code: "schema_changed" } });
	});

	it("el alta de usuario exige contraseña inicial y la envía una sola vez", async () => {
		const user = { id: "u2", email: "nuevo@empresa-demo.test", name: "Nuevo", status: "active", roleId: "r1", roleName: "Administrador", lastLoginAt: null };
		const { adapter, calls } = await signedIn({ "POST /users": () => ({ status: 201, json: { id: "u2" } }), "GET /users": () => ({ json: [user] }) });
		const input = { name: " Nuevo ", email: "nuevo@empresa-demo.test", roleId: "r1" as RoleId };
		expect(await adapter.createUser(input)).toMatchObject({ ok: false, error: { code: "validation", fields: { password: expect.any(String) } } });
		expect(calls.some((c) => c.key === "POST /users")).toBe(false);
		const created = await adapter.createUser({ ...input, password: "contraseña-inicial-ficticia" });
		expect(created).toMatchObject({ ok: true, data: { id: "u2", status: "active", lastActivityAt: null } });
		expect(calls.find((c) => c.key === "POST /users")?.body).toEqual({ name: "Nuevo", email: "nuevo@empresa-demo.test", roleId: "r1", password: "contraseña-inicial-ficticia" });
	});

	it("cuenta sin programación devuelve valores iniciales y no permite activarla", async () => {
		const { adapter, calls } = await signedIn();
		const schedule = await adapter.getSchedule("a1" as AccountId);
		expect(schedule).toMatchObject({ accountId: "a1", state: "disabled", nextRuns: [] });
		const { nextRuns: _nextRuns, pauseReason: _pauseReason, ...config } = schedule;
		// Activar se envía al servidor: sin las puertas de cron y transporte responde `remote_unavailable`.
		expect(await adapter.saveSchedule({ ...config, state: "active" })).toMatchObject({ ok: false, error: { code: "not_found" } });
		expect(calls.filter((c) => c.key === "PATCH /accounts/a1/schedule")).toHaveLength(1);
	});

	it("la auditoría traduce acciones y nunca muestra identificadores crudos como nombre", async () => {
		const at = new Date().toISOString();
		const { adapter } = await signedIn({
			"GET /audit": () => ({
				json: [
					{ id: "e1", at, action: "login", objectType: "user", actorName: "Admin Demo", accountAlias: null, objectName: "Admin Demo" },
					{ id: "e2", at, action: "credential", objectType: "credential", actorName: "Admin Demo", accountAlias: "Cuenta Demo", objectName: null },
					{ id: "e3", at, action: "schedule_due", objectType: "sync_run", actorName: null, accountAlias: "Cuenta Demo", objectName: null },
				],
			}),
		});
		const page = await adapter.listAudit({ filters: { action: "all", objectType: "all", actor: "all", range: "7d" }, sort: { column: "actor", direction: "asc" }, page: 1, pageSize: 20 });
		expect(page.rows.map((e) => [e.actor, e.action, e.objectType, e.objectLabel])).toEqual([
			["Admin Demo", "session", "user", "Admin Demo"],
			["Admin Demo", "credential", "credential", "Credencial · Cuenta Demo"],
			["Sistema", "inventory", "run", "Consulta · Cuenta Demo"],
		]);
		const filtered = await adapter.listAudit({ filters: { action: "credential", objectType: "all", actor: "all", range: "all" }, sort: null, page: 1, pageSize: 20 });
		expect(filtered.total).toBe(1);
	});
});

describe("HttpAdapter · buzón", () => {
	const at = "2026-09-30T15:00:00.000Z";
	const row = (over: Record<string, unknown> = {}) => ({
		id: "i1", box: "messages", remoteState: "unread", subject: "Aviso &amp; constancia", sender: "SUNAT", publishedAtText: "30/09/2026 10:00:00", publishedAt: at, firstSeenAt: at,
		folderCode: null, labelCode: "16", labelName: "AVISOS", attachmentCount: 1, starred: false, urgent: true, reviewed: false, reviewedAt: null, contentStored: false, openedByUser: false, ...over,
	});
	const runDto = (over: Record<string, unknown> = {}) => ({ id: "r1", mode: "manual", state: "running", startedAt: at, finishedAt: null, resumeBox: 2, resumePage: 3, errorCode: null, boxes: '["messages","notifications"]', newMessages: null, newNotifications: null, ...over });
	const summary = { state: "running", verified: false, pendingReview: { messages: 2, notifications: 0 }, failedFiles: 1, newSince: at, boxes: { messages: { uniqueCount: 50, unreadInSunat: 7 }, notifications: { uniqueCount: 5, unreadInSunat: 0 } } };
	const activity = (over: Record<string, unknown> = {}) => ({
		current: runDto(over),
		pages: [{ tipoMsj: 1, pagesScanned: 3, received: 50, declaredRecords: 40, declaredPages: 2 }, { tipoMsj: 2, pagesScanned: 2, received: 30, declaredRecords: 30, declaredPages: 9 }],
		seen: [{ tipoMsj: 1, seen: 50 }, { tipoMsj: 2, seen: 28 }],
		history: [runDto(over), runDto({ id: "r0", state: "partial", errorCode: "remote_unavailable", resumeBox: 1, resumePage: 4 })],
	});
	const READ_ROUTES = {
		"GET /accounts/a1/summary": () => ({ json: summary }),
		"GET /accounts/a1/activity": () => ({ json: activity() }),
	};

	it("la bandeja traduce filtros, filas y cobertura sin pedir detalle", async () => {
		const { adapter, calls } = await signedIn({ ...READ_ROUTES, "GET /accounts/a1/mail?box=messages&offset=25&limit=25&state=read&review=pending&content=stored&q=aviso&label=16&sort=subject&direction=asc": () => ({ json: { rows: [row({ contentStored: true })], total: 26 } }) });
		const page = await adapter.listMail("a1" as AccountId, "messages", { filters: { query: " aviso ", state: "all", folder: null, tag: "16", dateFrom: null, dateTo: null, review: "pending" }, sort: { column: "subject", direction: "asc" }, page: 2, pageSize: 25 });
		expect(page).toMatchObject({ total: 26, page: 2, coverage: { state: "complete", uniqueCount: 50, verified: false, pagesScanned: 3, declaredBySunat: 40 } });
		expect(page.rows[0]).toMatchObject({ subject: "Aviso & constancia", tag: { code: "16", name: "AVISOS", known: true }, remoteState: "unconfirmed", urgent: true, folderCode: "00", attachmentCountDeclared: 1 });
		expect(calls.some((c) => c.key.includes("/detail") || c.key.includes("/read"))).toBe(false);
	});

	it("resumen y actividad se arman con el estado persistido de la cuenta", async () => {
		const { adapter } = await signedIn({
			...READ_ROUTES,
			"GET /accounts/a1/schedule": () => ({ status: 403, json: { code: "forbidden" } }),
			"GET /accounts/a1/mail?seenAfter=2026-09-30T15%3A00%3A00.000Z&sort=firstSeenAt&limit=20": () => ({ json: { rows: [row({ id: "i9" })], total: 1 } }),
		});
		const result = await adapter.getSummary("a1" as AccountId);
		expect(result.boxes.messages).toMatchObject({ unreadInSunat: 7, pendingReview: 2 });
		expect(result.newItems.map((i) => i.id)).toEqual(["i9"]);
		expect(result.pending.map((p) => p.kind)).toEqual(["failed_downloads", "pending_review"]);
		expect(result.scheduleText).toBe("En pausa");
		const activityView = await adapter.getActivity("a1" as AccountId);
		expect(activityView.currentRun).toMatchObject({ id: "r1", state: "running", resultText: "En curso" });
		expect(activityView.progress).toMatchObject([
			{ box: "messages", state: "complete", pagesScanned: 3, found: 50, unique: 50, declaredMatches: false },
			{ box: "notifications", state: "running", pagesScanned: 2, estimatedPages: 9, found: 30, unique: 28, duplicatesSkipped: 2 },
		]);
		expect(activityView.history[1]).toMatchObject({ state: "partial", resumeFrom: { box: "messages", page: 4 }, resultText: "Incompleta · SUNAT no respondió", pauseReason: "remote_unavailable" });
	});

	it("leer encola una sola intención, espera al worker y no llama a SUNAT si ya hay contenido", async () => {
		const states = ["calling", "complete"];
		let stored = false;
		const detail = { bodyHtml: "<p>Ficticio</p>", fetchedAt: at, files: [{ id: "f1", kind: "attachment", name: "constancia", mimeType: "application/pdf", sizeBytes: "2048", state: "available" }] };
		const { adapter, calls } = await signedIn({
			"GET /accounts/a1/items/i1": () => ({ json: row({ contentStored: stored, remoteState: stored ? "read" : "unread" }) }),
			"POST /accounts/a1/items/i1/read": () => ({ status: 201, json: { id: "e1", status: "pending" } }),
			"GET /accounts/a1/items/i1/reads/e1": () => {
				const status = states.shift();
				stored = status === "complete";
				return { json: { id: "e1", status } };
			},
			"GET /accounts/a1/items/i1/detail": () => ({ json: detail }),
		});
		Object.assign(adapter, { pollMs: 1 });
		const first = await adapter.readContent("a1" as AccountId, "i1" as ItemId, "clave-de-idempotencia");
		expect(first).toMatchObject({ ok: true, data: { remoteCallMade: true, remoteState: "read", readEventId: "e1", bodyHtml: "<p>Ficticio</p>", files: [{ id: "f1", sizeBytes: 2048, state: { status: "available" } }] } });
		expect(calls.find((c) => c.key === "POST /accounts/a1/items/i1/read")?.headers["Idempotency-Key"]).toBe("clave-de-idempotencia");
		const again = await adapter.readContent("a1" as AccountId, "i1" as ItemId, "otra-clave-distinta");
		expect(again).toMatchObject({ ok: true, data: { remoteCallMade: false } });
		expect(calls.filter((c) => c.key === "POST /accounts/a1/items/i1/read")).toHaveLength(1);
	});

	it("descargar obtiene el archivo en la cuenta y luego lo pide al proxy autenticado", async () => {
		let state = "available";
		const { adapter, calls } = await signedIn({
			"GET /accounts/a1/items/i1/detail": () => ({ json: { bodyHtml: "", fetchedAt: at, files: [{ id: "f1", kind: "attachment", name: "constancia", mimeType: "application/pdf", sizeBytes: 2048, state }] } }),
			"POST /accounts/a1/files/f1/fetch": () => ({ status: 201, json: { id: "q1", status: "pending" } }),
			"GET /accounts/a1/files/f1/fetches/q1": () => {
				state = "stored";
				return { json: { id: "q1", status: "complete", errorCode: null } };
			},
			"GET /accounts/a1/files/f1": () => ({ json: {} }),
			"POST /accounts/a1/files/f2/fetch": () => ({ status: 403, json: { code: "forbidden" } }),
		});
		Object.assign(adapter, { pollMs: 1 });
		const saved = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:ficticio");
		const progress: number[] = [];
		const result = await adapter.downloadFile("a1" as AccountId, "i1" as ItemId, "f1" as FileId, (p) => progress.push(p));
		expect(result).toMatchObject({ ok: true, data: { id: "f1", name: "constancia", state: { status: "stored" } } });
		expect(progress.at(-1)).toBe(100);
		expect(saved).toHaveBeenCalledTimes(1);
		saved.mockRestore();
		expect(calls.map((c) => c.key).filter((k) => k.includes("/files/"))).toEqual(["POST /accounts/a1/files/f1/fetch", "GET /accounts/a1/files/f1/fetches/q1", "GET /accounts/a1/files/f1"]);
		expect(await adapter.downloadFile("a1" as AccountId, "i1" as ItemId, "f9" as FileId)).toMatchObject({ ok: false, error: { code: "not_found" } });
	});

	it("inventario de una o todas las cuentas, archivo y su configuración usan sus rutas", async () => {
		const settings = { accountId: "a1", archiveContent: true, archiveFiles: false, archiveBatchSize: 50 };
		const archive = { settings, items: { total: 10, readInSunat: 6, unreadInSunat: 4, withContent: 2, pendingContent: 4 }, files: { stored: 1, pending: 0, failed: 0 }, current: { id: "x1", trigger: "inventory", state: "running", errorCode: null, itemsDone: 2, itemsFailed: 0, filesStored: 1, filesFailed: 0, remaining: null, startedAt: at, finishedAt: null }, history: [] };
		const { adapter, calls } = await signedIn({
			"GET /accounts/a1/activity": () => ({ json: activity({ id: "r5", state: "pending" }) }),
			"POST /accounts/a1/inventory": () => ({ status: 201, json: { id: "r5", state: "pending" } }),
			"POST /inventory": () => ({ status: 201, json: [{ accountId: "a1", runId: "r5", state: "pending", code: null }, { accountId: "a2", runId: null, state: null, code: "needs_credential" }] }),
			"GET /accounts/a1/archive": () => ({ json: archive }),
			"POST /accounts/a1/archive": () => ({ status: 201, json: { id: "x1", state: "pending" } }),
			"GET /admin/accounts/a1/mailbox-settings": () => ({ json: settings }),
			"PATCH /admin/accounts/a1/mailbox-settings": () => ({ status: 204 }),
			"GET /admin/runs": () => ({ json: [runDto({ accountId: "a1", accountAlias: "Cuenta Demo", state: "complete", resumeBox: null, newMessages: 3 })] }),
			"GET /accounts/a1/labels": () => ({ json: { items: [{ code: "16", name: "AVISOS", color: "#d45aed" }] } }),
		});
		expect(await adapter.startInventory("a1" as AccountId)).toMatchObject({ ok: true, data: { id: "r5", state: "pending", resultText: "En cola" } });
		expect(await adapter.startAllInventories()).toEqual({ ok: true, data: [{ accountId: "a1", alias: "Cuenta Demo", started: true, errorCode: null }, { accountId: "a2", alias: "Cuenta", started: false, errorCode: "needs_credential" }] });
		expect(await adapter.startArchive("a1" as AccountId, true)).toMatchObject({ ok: true, data: { accountId: "a1", items: { pendingContent: 4 }, current: { trigger: "inventory", state: "running" } } });
		expect(calls.find((c) => c.key === "POST /accounts/a1/archive")?.body).toEqual({ retryFailed: true });
		expect(await adapter.saveMailboxSettings({ ...settings, accountId: "a1" as AccountId })).toMatchObject({ ok: true, data: { archiveBatchSize: 50 } });
		expect(calls.find((c) => c.key === "PATCH /admin/accounts/a1/mailbox-settings")?.body).toEqual({ archiveContent: true, archiveFiles: false, archiveBatchSize: 50 });
		expect(await adapter.listScheduledRuns()).toMatchObject([{ accountAlias: "Cuenta Demo", state: "complete", resultText: "3 elementos nuevos" }]);
		expect(await adapter.listTags("a1" as AccountId)).toEqual([{ code: "16", name: "AVISOS", known: true, color: "#d45aed" }]);
		expect(await adapter.listFolders()).toEqual([]);
	});
});

describe("HttpAdapter · configuraciones", () => {
	it("lee y guarda por /admin/settings, y avisa la actividad", async () => {
		const setting = { key: "session.idleMinutes", value: 30, default: 60, min: 5, max: 43200, updatedAt: null };
		const { adapter, calls } = await signedIn({
			"GET /admin/settings": () => ({ json: [setting] }),
			"PATCH /admin/settings": () => ({ status: 204 }),
			"POST /auth/activity": () => ({ status: 204 }),
		});
		expect((await adapter.getSession())?.passwordMinLength).toBe(14);
		expect(await adapter.listSettings()).toEqual([setting]);
		expect(await adapter.saveSettings({ "session.idleMinutes": 30 })).toMatchObject({ ok: true, data: [{ key: "session.idleMinutes", value: 30 }] });
		expect(calls.find((c) => c.key === "PATCH /admin/settings")?.body).toEqual({ values: { "session.idleMinutes": 30 } });
		await adapter.touchSession();
		expect(calls.some((c) => c.key === "POST /auth/activity")).toBe(true);
	});
});
