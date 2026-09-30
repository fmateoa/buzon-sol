/** Normaliza para búsqueda: minúsculas y sin acentos («Resolución» = «resolucion»). */
export const normalizeText = (value: string): string =>
	value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase("es-PE")
		.trim();

export const includesNormalized = (haystack: string, needle: string): boolean => {
	const n = normalizeText(needle);
	return n === "" || normalizeText(haystack).includes(n);
};

/** Decodifica entidades HTML simples de asuntos de SUNAT sin interpretar etiquetas. */
export const decodeEntities = (value: string): string =>
	value
		.replace(/&aacute;/g, "á")
		.replace(/&eacute;/g, "é")
		.replace(/&iacute;/g, "í")
		.replace(/&oacute;/g, "ó")
		.replace(/&uacute;/g, "ú")
		.replace(/&ntilde;/g, "ñ")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
