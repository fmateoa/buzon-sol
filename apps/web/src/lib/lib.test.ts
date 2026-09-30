import { describe, expect, it } from "vitest";
import { AppError } from "@/domain/adapter";
import { runBatch } from "./batch";
import { formatCount } from "./format";
import { sanitizeRemoteHtml } from "./sanitize";
import { computeNextRuns, describeDays, scheduleSummaryText } from "./schedule";
import { includesNormalized } from "./text";

describe("filtro sin acentos", () => {
	it("coincide ignorando tildes y mayúsculas", () => {
		expect(includesNormalized("Resolución de Cobranza", "resolucion")).toBe(true);
		expect(includesNormalized("Fiscalización", "FISCALIZACION")).toBe(true);
		expect(includesNormalized("Aviso", "valores")).toBe(false);
		expect(includesNormalized("Aviso", "")).toBe(true);
	});
});

describe("formatCount", () => {
	it("separa miles con espacio duro", () => {
		expect(formatCount(1034)).toBe("1 034");
		expect(formatCount(3328)).toBe("3 328");
		expect(formatCount(12)).toBe("12");
	});
});

describe("runBatch", () => {
	it("envía una petición por registro y un fallo no revierte los demás", async () => {
		const calls: string[] = [];
		const outcome = await runBatch(
			[
				{ id: "1", name: "Uno" },
				{ id: "2", name: "Dos" },
				{ id: "3", name: "Tres" },
			],
			async (id) => {
				calls.push(id);
				if (id === "2") return { ok: false, error: new AppError("validation", "x", { status: "No puede desactivar su propio usuario." }) };
				if (id === "3") throw new Error("red");
				return { ok: true, data: id };
			},
		);
		expect(calls).toEqual(["1", "2", "3"]);
		expect(outcome.succeeded).toEqual(["Uno"]);
		expect(outcome.failed.map((f) => f.name)).toEqual(["Dos", "Tres"]);
		expect(outcome.failed[0]!.reason).toContain("propio usuario");
	});
});

describe("programador", () => {
	it("calcula disparos dentro de la ventana y los días elegidos (hora de Lima)", () => {
		// Martes 29/09/2026 10:30 en Lima = 15:30 UTC.
		const from = new Date("2026-09-29T15:30:00Z");
		const runs = computeNextRuns({ state: "active", frequency: "1h", days: ["tue"], windowStart: "07:00", windowEnd: "12:00" }, from, 4);
		expect(runs).toEqual(["2026-09-29T16:00:00.000Z", "2026-09-29T17:00:00.000Z", "2026-10-06T12:00:00.000Z", "2026-10-06T13:00:00.000Z"]);
	});

	it("no programa nada si está pausado", () => {
		expect(computeNextRuns({ state: "paused", frequency: "1h", days: ["mon"], windowStart: "07:00", windowEnd: "20:00" }, new Date(), 4)).toEqual([]);
	});

	it("describe días y frecuencia", () => {
		expect(describeDays(["mon", "tue", "wed", "thu", "fri"])).toBe("L–V");
		expect(describeDays(["mon", "wed"])).toBe("L, X");
		expect(scheduleSummaryText({ state: "active", frequency: "4h", days: ["mon", "tue", "wed", "thu", "fri", "sat"], pauseReason: null })).toBe("Cada 4 h · L–S");
	});
});

describe("sanitizeRemoteHtml", () => {
	it("elimina scripts, estilos, eventos y enlaces no https", () => {
		const html = sanitizeRemoteHtml('<p style="color:red" onclick="x()">Hola</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://www.sunat.gob.pe">ok</a><img src=x onerror=alert(1)>');
		expect(html).not.toMatch(/script|style=|onclick|onerror|javascript:|<img/i);
		expect(html).toContain("<p>Hola</p>");
		expect(html).toContain('href="https://www.sunat.gob.pe"');
		expect(html).toContain('rel="noopener noreferrer nofollow"');
	});
});
