import type { IsoDateTime } from "@/domain/types";

export const LIMA_TZ = "America/Lima";

const numberFormat = new Intl.NumberFormat("es-PE");
/** Miles separados por espacio duro, como en el diseño («1 034»). */
export const formatCount = (value: number): string => numberFormat.format(value).replace(/[,.\u202f]/g, "\u00a0");

const dateFmt = new Intl.DateTimeFormat("es-PE", { timeZone: LIMA_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("es-PE", { timeZone: LIMA_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const limaDayKey = (iso: IsoDateTime | Date): string => dayKeyFmt.format(typeof iso === "string" ? new Date(iso) : iso);

export const formatDate = (iso: IsoDateTime): string => dateFmt.format(new Date(iso));
export const formatTime = (iso: IsoDateTime): string => timeFmt.format(new Date(iso));

/** «Hoy 10:00», «Ayer 18:10» o «28/09/2026 10:14», siempre en hora de Lima. */
export const formatRelative = (iso: IsoDateTime | null, now: Date = new Date()): string => {
	if (!iso) return "Nunca";
	const day = limaDayKey(iso);
	const today = limaDayKey(now);
	const yesterday = limaDayKey(new Date(now.getTime() - 86_400_000));
	if (day === today) return `hoy ${formatTime(iso)}`;
	if (day === yesterday) return `ayer ${formatTime(iso)}`;
	return `${formatDate(iso)} ${formatTime(iso)}`;
};

export const capitalize = (value: string): string => (value ? value[0]!.toUpperCase() + value.slice(1) : value);

export const formatBytes = (bytes: number | null): string => {
	if (bytes === null) return "Tamaño desconocido";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};

/** Tipo visible de archivo a partir del MIME observado; nunca se asume por la extensión. */
export const fileTypeLabel = (mimeType: string | null): string => {
	switch (mimeType) {
		case "application/pdf":
			return "PDF";
		case "application/zip":
			return "ZIP";
		case "application/xml":
		case "text/xml":
			return "XML";
		case "text/html":
			return "HTML";
		default:
			return "Archivo";
	}
};

export const pluralize = (count: number, singular: string, plural: string) => `${formatCount(count)} ${count === 1 ? singular : plural}`;
