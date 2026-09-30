import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListState } from "./use-list-state";

interface Filters {
	query: string;
	state: "all" | "unread";
}

const useSetup = () => useListState<Filters, "publishedAt" | "subject">({ initialFilters: { query: "", state: "all" }, textKeys: ["query"], initialPageSize: 20 });

describe("useListState · reglas de tabla", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("un filtro no textual vuelve a la página 1 y vacía la selección", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setPage(3, 20));
		act(() => result.current.setSelection([{ id: "a", name: "A" }]));
		expect(result.current.page).toBe(3);
		expect(result.current.selection).toHaveLength(1);

		act(() => result.current.setFilter("state", "unread"));
		expect(result.current.page).toBe(1);
		expect(result.current.selection).toHaveLength(0);
		expect(result.current.request.filters.state).toBe("unread");
	});

	it("cambiar de página vacía la selección", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setSelection([{ id: "a", name: "A" }]));
		act(() => result.current.setPage(2, 20));
		expect(result.current.selection).toHaveLength(0);
		expect(result.current.page).toBe(2);
	});

	it("cambiar el tamaño de página vuelve a la página 1", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setPage(4, 20));
		act(() => result.current.setPage(4, 50));
		expect(result.current.page).toBe(1);
		expect(result.current.pageSize).toBe(50);
	});

	it("el orden alterna ascendente → descendente → sin orden y reinicia la página", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setPage(2, 20));
		act(() => result.current.toggleSort("subject"));
		expect(result.current.request.sort).toEqual({ column: "subject", direction: "asc" });
		expect(result.current.page).toBe(1);
		act(() => result.current.toggleSort("subject"));
		expect(result.current.request.sort).toEqual({ column: "subject", direction: "desc" });
		act(() => result.current.toggleSort("subject"));
		expect(result.current.request.sort).toBeNull();
	});

	it("el texto se aplica con debounce (~350 ms) y entonces reinicia página y selección", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setPage(3, 20));
		act(() => result.current.setSelection([{ id: "a", name: "A" }]));
		act(() => result.current.setFilter("query", "resol"));
		// Escribir no dispara la consulta de inmediato.
		expect(result.current.request.filters.query).toBe("");
		expect(result.current.page).toBe(3);
		act(() => vi.advanceTimersByTime(349));
		expect(result.current.request.filters.query).toBe("");
		act(() => vi.advanceTimersByTime(1));
		expect(result.current.request.filters.query).toBe("resol");
		expect(result.current.page).toBe(1);
		expect(result.current.selection).toHaveLength(0);
	});

	it("«Quitar filtros» restaura los valores iniciales", () => {
		const { result } = renderHook(useSetup);
		act(() => result.current.setFilter("state", "unread"));
		expect(result.current.isFiltered).toBe(true);
		act(() => result.current.resetFilters());
		expect(result.current.isFiltered).toBe(false);
		expect(result.current.filters).toEqual({ query: "", state: "all" });
	});
});
