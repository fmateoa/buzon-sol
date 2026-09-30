import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTable, type TableKeyCurrent } from "lizaui/table";
import { usePagination } from "lizaui/pagination";
import type { ListRequest } from "@/domain/types";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

export const PAGE_SIZES = [10, 20, 50, 100];

interface ListStateOptions<TFilters extends object> {
	/** Persiste orden y columnas ocultas (no filtros ni selección) mediante `useTable`. */
	persistKey?: string;
	initialFilters: TFilters;
	/** Filtros de texto libre: se aplican con debounce. */
	textKeys?: (keyof TFilters)[];
	initialPageSize?: number;
	initialSort?: { column: string; direction: "asc" | "desc" } | null;
	debounceMs?: number;
}

/**
 * Estado de un listado paginado:
 * - Filtro u orden → página 1.
 * - Cambiar página, filtro u orden → se vacía la selección.
 * - Texto con debounce (~350 ms); cambiar tamaño de página → página 1.
 * - Orden cíclico asc → desc → sin orden (comportamiento de `useTable`).
 */
export const useListState = <TFilters extends object, TSort extends string>({
	persistKey,
	initialFilters,
	textKeys = [],
	initialPageSize = 20,
	initialSort = null,
	debounceMs = SEARCH_DEBOUNCE_MS,
}: ListStateOptions<TFilters>) => {
	const table = useTable({ persistKey, initialSortDescriptor: initialSort });
	const pagination = usePagination({ initialPage: 1, initialLimit: initialPageSize });
	const [filters, setFilters] = useState<TFilters>(initialFilters);
	const [initial] = useState(initialFilters);

	const { handleSetPagination, limit } = pagination;
	const { handleResetSelectKeys } = table;

	const resetPageAndSelection = useCallback(() => {
		handleSetPagination({ page: 1, limit });
		handleResetSelectKeys();
	}, [handleSetPagination, handleResetSelectKeys, limit]);

	// Texto con debounce: solo el valor estabilizado cuenta como «filtro aplicado».
	const textSnapshot = textKeys.map((k) => String(filters[k] ?? "")).join("\u0000");
	const debouncedText = useDebouncedValue(textSnapshot, debounceMs);
	// Filtros no textuales serializados: los valores son primitivos (texto, null) por contrato.
	const nonTextSnapshot = JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([k]) => !textKeys.includes(k as keyof TFilters))));
	const textKeysKey = textKeys.join("|");
	const appliedFilters = useMemo(() => {
		const parts = debouncedText.split("\u0000");
		const keys = textKeysKey ? textKeysKey.split("|") : [];
		const next: Record<string, unknown> = JSON.parse(nonTextSnapshot);
		keys.forEach((k, i) => {
			next[k] = parts[i] ?? "";
		});
		return next as TFilters;
	}, [debouncedText, nonTextSnapshot, textKeysKey]);

	const lastApplied = useRef(debouncedText);
	useEffect(() => {
		if (lastApplied.current === debouncedText) return;
		lastApplied.current = debouncedText;
		resetPageAndSelection();
	}, [debouncedText, resetPageAndSelection]);

	const setFilter = useCallback(
		<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
			setFilters((prev) => (Object.is(prev[key], value) ? prev : { ...prev, [key]: value }));
			// Los filtros de texto reinician al estabilizarse; el resto, de inmediato.
			if (!textKeysKey.split("|").includes(String(key))) resetPageAndSelection();
		},
		[resetPageAndSelection, textKeysKey],
	);

	const resetFilters = useCallback(() => {
		setFilters(initial);
		resetPageAndSelection();
	}, [initial, resetPageAndSelection]);

	const toggleSort = useCallback(
		(column: string) => {
			table.handleSort(column);
			resetPageAndSelection();
		},
		[table, resetPageAndSelection],
	);

	const setPage = useCallback(
		(page: number, pageSize: number) => {
			const sizeChanged = pageSize !== pagination.limit;
			handleSetPagination({ page: sizeChanged ? 1 : page, limit: pageSize });
			handleResetSelectKeys();
		},
		[pagination.limit, handleSetPagination, handleResetSelectKeys],
	);

	const request: ListRequest<TFilters, TSort> = useMemo(
		() => ({
			filters: appliedFilters,
			sort: table.sortDescriptor ? { column: table.sortDescriptor.column as TSort, direction: table.sortDescriptor.direction } : null,
			page: pagination.page,
			pageSize: pagination.limit,
		}),
		[appliedFilters, table.sortDescriptor, pagination.page, pagination.limit],
	);

	const isFiltered = useMemo(() => JSON.stringify(filters) !== JSON.stringify(initial), [filters, initial]);

	const setSelection = useCallback((keys: TableKeyCurrent[]) => table.handleSelectKeys(keys), [table]);

	return {
		filters,
		appliedFilters,
		setFilter,
		resetFilters,
		isFiltered,
		sortDescriptor: table.sortDescriptor,
		toggleSort,
		page: pagination.page,
		pageSize: pagination.limit,
		setPage,
		selection: table.selectKeys,
		toggleSelection: table.handleSelectKey,
		setSelection,
		clearSelection: table.handleResetSelectKeys,
		hiddenColumns: table.hiddenColumns,
		toggleColumn: table.handleToggleColumnVisibility,
		request,
	};
};

export type ListState<TFilters extends object, TSort extends string> = ReturnType<typeof useListState<TFilters, TSort>>;
