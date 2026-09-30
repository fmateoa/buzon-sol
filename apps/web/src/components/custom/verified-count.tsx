import type { InventoryCoverage } from "@/domain/types";
import { formatCount } from "@/lib/format";

/**
 * El número principal siempre es lo verificado por buzon-sol; el declarado por SUNAT
 * aparece más pequeño y solo cuando difiere. Sin barrido completo no se dice «verificado».
 */
export const VerifiedCount = ({ coverage }: { coverage: InventoryCoverage }) => {
	const differs = coverage.declaredBySunat !== null && coverage.declaredBySunat !== coverage.uniqueCount;
	return (
		<div className="flex flex-wrap items-end gap-x-5 gap-y-1">
			<div>
				<p className="mono text-3xl font-medium text-ink">{formatCount(coverage.uniqueCount)}</p>
				<p className="text-xs text-muted-ink">{coverage.verified ? "total verificado" : "registrados hasta ahora"}</p>
			</div>
			{differs && coverage.verified && (
				<div>
					<p className="mono text-base text-muted-ink">{formatCount(coverage.declaredBySunat!)}</p>
					<p className="text-xs text-muted-ink">declarado por SUNAT</p>
				</div>
			)}
		</div>
	);
};

export const coverageExplanation = (coverage: InventoryCoverage): string => {
	if (coverage.state === null) return "Aún no hay inventario de esta bandeja.";
	if (!coverage.verified) {
		return `Se revisaron ${formatCount(coverage.pagesScanned)}${coverage.estimatedPages ? ` de ~${formatCount(coverage.estimatedPages)}` : ""} páginas. Los filtros solo incluyen lo ya inventariado.`;
	}
	if (coverage.declaredBySunat === null || coverage.declaredBySunat === coverage.uniqueCount) return "Coincide con el total declarado por SUNAT.";
	return `SUNAT indica ${formatCount(coverage.declaredBySunat)} en su paginación. buzon-sol contó ${formatCount(coverage.uniqueCount)} registros únicos al recorrer ${formatCount(Math.max(coverage.pagesScanned - 1, 1))} páginas con datos.`;
};
