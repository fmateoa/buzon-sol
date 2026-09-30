import { afterEach, describe, expect, it } from "vitest";
import type { AccountId, ItemId, ListRequest, MailListFilters, MailSortColumn } from "@/domain/types";
import { ACCOUNT_IDS } from "./fixtures";
import { LocalAdapter } from "./local-adapter";

const request = (filters: Partial<MailListFilters> = {}, page = 1, pageSize = 20): ListRequest<MailListFilters, MailSortColumn> => ({
	filters: { query: "", state: "all", folder: null, tag: null, dateFrom: null, dateTo: null, review: "all", ...filters },
	sort: null,
	page,
	pageSize,
});

const adapters: LocalAdapter[] = [];
const make = (email: string) => {
	const adapter = new LocalAdapter({ latencyMs: 0, tickMs: 1, confirmDelayMs: 5, storage: null, initialUserEmail: email });
	adapters.push(adapter);
	return adapter;
};
afterEach(() => adapters.splice(0).forEach((a) => a.dispose()));

describe("adaptador local · autorización por permiso Y cuenta", () => {
	it("un analista no obtiene datos de una cuenta ajena aunque conozca su id", async () => {
		const analyst = make("usuario3@empresa-demo.test");
		const session = await analyst.getSession();
		expect(session?.visibleAccounts.map((a) => a.id)).toEqual([ACCOUNT_IDS.demo, ACCOUNT_IDS.servicios]);
		await expect(analyst.listMail(ACCOUNT_IDS.comercial, "messages", request())).rejects.toMatchObject({ code: "forbidden" });
		await expect(analyst.getSummary(ACCOUNT_IDS.comercial)).rejects.toMatchObject({ code: "forbidden" });
		const read = await analyst.readContent(ACCOUNT_IDS.comercial, "itm_2c91e0m00000" as ItemId, "k1");
		expect(read.ok).toBe(false);
	});

	it("«Solo consulta» ve metadatos pero no puede leer contenido ni descargar", async () => {
		const viewer = make("usuario6@empresa-demo.test");
		const page = await viewer.listMail(ACCOUNT_IDS.demo, "messages", request());
		expect(page.rows.length).toBeGreaterThan(0);
		const read = await viewer.readContent(ACCOUNT_IDS.demo, page.rows[0]!.id, "k");
		expect(read.ok).toBe(false);
		if (!read.ok) expect(read.error.code).toBe("forbidden");
		expect(viewer.stats.remoteDetailCalls).toBe(0);
	});

	it("un cambio de rol aplica a la sesión existente sin nuevo login", async () => {
		const admin = make("admin@empresa-demo.test");
		const roles = await admin.listRoles();
		const analystRole = roles.rows.find((r) => r.name === "Analista")!;
		await admin.updateRole(analystRole.id, { name: "Analista", permissions: analystRole.permissions, allAccounts: false, accountIds: [ACCOUNT_IDS.demo] });
		// Misma instancia (mismo «backend»), otro usuario.
		const internal = admin as unknown as { currentUserId: string };
		internal.currentUserId = "usr_u03";
		const session = await admin.getSession();
		expect(session?.visibleAccounts.map((a) => a.id)).toEqual([ACCOUNT_IDS.demo]);
		await expect(admin.listMail(ACCOUNT_IDS.servicios, "messages", request())).rejects.toMatchObject({ code: "forbidden" });
	});
});

describe("adaptador local · inventariar ≠ leer", () => {
	it("listar, filtrar y ver metadatos nunca pide detalle a SUNAT", async () => {
		const a = make("usuario1@empresa-demo.test");
		const page = await a.listMail(ACCOUNT_IDS.demo, "messages", request({ state: "unread" }));
		await a.getItemMetadata(ACCOUNT_IDS.demo, page.rows[0]!.id);
		await a.getSummary(ACCOUNT_IDS.demo);
		expect(a.stats.remoteDetailCalls).toBe(0);
		expect(a.stats.readIntents).toHaveLength(0);
	});

	it("readContent registra la intención antes de la lectura y es idempotente por clave", async () => {
		const a = make("usuario1@empresa-demo.test");
		const [unread] = (await a.listMail(ACCOUNT_IDS.demo, "messages", request({ state: "unread" }))).rows;
		const first = await a.readContent(ACCOUNT_IDS.demo, unread!.id, "same-key");
		const second = await a.readContent(ACCOUNT_IDS.demo, unread!.id, "same-key");
		expect(first.ok && second.ok).toBe(true);
		expect(a.stats.readIntents).toHaveLength(1);
		expect(a.stats.remoteDetailCalls).toBe(1);
		if (first.ok) {
			expect(first.data.remoteState).toBe("confirming");
			expect(first.data.bodyHtml).not.toMatch(/<script|style=|onclick/i);
		}
		await new Promise((r) => setTimeout(r, 20));
		expect(await a.getRemoteState(ACCOUNT_IDS.demo, unread!.id)).toBe("read");
	});

	it("«Revisado en buzon-sol» es local y no cambia el estado remoto", async () => {
		const a = make("usuario1@empresa-demo.test");
		const [unread] = (await a.listMail(ACCOUNT_IDS.demo, "messages", request({ state: "unread" }))).rows;
		const result = await a.setReviewed(ACCOUNT_IDS.demo, unread!.id, true);
		expect(result.ok && result.data.review.reviewed).toBe(true);
		expect(result.ok && result.data.remoteState).toBe("unread");
		expect(a.stats.remoteDetailCalls).toBe(0);
	});
});

describe("adaptador local · paginación e inventario", () => {
	it("el total verificado (3 328 únicos) es independiente del declarado por SUNAT (2 681)", async () => {
		const a = make("admin@empresa-demo.test");
		const page = await a.listMail(ACCOUNT_IDS.servicios, "messages", request({}, 1, 100));
		expect(page.total).toBe(3328);
		expect(page.coverage).toMatchObject({ uniqueCount: 3328, verified: true, declaredBySunat: 2681 });
		const ids = new Set<string>();
		for (let p = 1; p <= 34; p++) (await a.listMail(ACCOUNT_IDS.servicios, "messages", request({}, p, 100))).rows.forEach((r) => ids.add(r.id));
		expect(ids.size).toBe(3328);
	});

	it("un inventario parcial no se etiqueta como verificado", async () => {
		const a = make("admin@empresa-demo.test");
		const summary = await a.getSummary(ACCOUNT_IDS.comercial);
		expect(summary.boxes.messages.coverage).toMatchObject({ verified: false, pagesScanned: 22, estimatedPages: 40 });
	});

	it("una credencial rechazada impide consultar y reanudar, pero conserva el inventario", async () => {
		const a = make("admin@empresa-demo.test");
		const start = await a.startInventory(ACCOUNT_IDS.comercial);
		expect(!start.ok && start.error.code).toBe("invalid_credential");
		const page = await a.listMail(ACCOUNT_IDS.comercial, "messages", request());
		expect(page.total).toBe(514);
	});

	it("una sola ejecución activa por cuenta", async () => {
		const a = make("admin@empresa-demo.test");
		const first = await a.startInventory(ACCOUNT_IDS.demo);
		const second = await a.startInventory(ACCOUNT_IDS.demo);
		expect(first.ok).toBe(true);
		expect(!second.ok && second.error.code).toBe("conflict_running");
	});
});

describe("adaptador local · Clave SOL de solo escritura", () => {
	it("la clave nunca aparece en respuestas ni en auditoría", async () => {
		const a = make("admin@empresa-demo.test");
		const secret = "ClaveFicticia-123";
		const replaced = await a.replaceCredential(ACCOUNT_IDS.comercial, secret);
		expect(replaced.ok).toBe(true);
		const dump = JSON.stringify([replaced, await a.getAdminAccount(ACCOUNT_IDS.comercial), await a.listAudit({ filters: { action: "all", objectType: "all", actor: "all", range: "all" }, sort: null, page: 1, pageSize: 100 }), await a.exportAuditCsv({ action: "all", objectType: "all", actor: "all", range: "all" })]);
		expect(dump).not.toContain(secret);
		expect(dump).toContain("Clave SOL reemplazada (valor no registrado)");
		// Nunca se devuelve el RUC completo.
		expect(dump).not.toContain("10000000002");
	});

	it("valida la programación: inicio < fin, al menos un día y una bandeja", async () => {
		const a = make("admin@empresa-demo.test");
		const current = await a.getSchedule(ACCOUNT_IDS.demo as AccountId);
		const result = await a.saveSchedule({ ...current, windowStart: "20:00", windowEnd: "07:00", days: [], boxes: [] });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(Object.keys(result.error.fields ?? {})).toEqual(expect.arrayContaining(["windowEnd", "days", "boxes"]));
	});
});
