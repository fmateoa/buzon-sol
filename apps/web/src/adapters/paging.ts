import type { Page, SortDirection } from "@/domain/types";

export const compare = (a: string | number, b: string | number, direction: SortDirection) => {
	const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es-PE", { sensitivity: "base" });
	return direction === "asc" ? result : -result;
};

export const paginate = <T>(rows: T[], page: number, pageSize: number): Page<T> => {
	const safeSize = Math.max(1, pageSize);
	const lastPage = Math.max(1, Math.ceil(rows.length / safeSize));
	const safePage = Math.min(Math.max(1, page), lastPage);
	return { rows: rows.slice((safePage - 1) * safeSize, safePage * safeSize), total: rows.length, page: safePage, pageSize: safeSize };
};
