import { Button } from "lizaui/button";
import { Table } from "lizaui/table";
import { Download } from "lucide-react";
import type { AuditSortColumn } from "@/domain/adapter";
import type { AuditAction, AuditEntry, AuditFilters } from "@/domain/types";
import { FilterSelect, ListTable, type ColumnDef } from "@/components/custom/list-table";
import { EmptyState, PageHeader } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { useListState } from "@/hooks/use-list-state";
import { cn } from "@/lib/cn";
import { errorCopy } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import { useExportAudit, useAudit } from "./queries";

const COLUMNS: ColumnDef[] = [
	{ id: "at", header: "Fecha", sort: true, size: 150 },
	{ id: "actor", header: "Realizado por", sort: true, size: 170 },
	{ id: "action", header: "Acción", size: 150 },
	{ id: "object", header: "Elemento", minWidth: 220 },
	{ id: "change", header: "Cambio", minWidth: 240 },
];

const INITIAL: AuditFilters = { action: "all", objectType: "all", actor: "all", range: "7d" };

const ACTIONS: Record<AuditAction, { icon: string; label: string; className: string }> = {
	create: { icon: "+", label: "Agregar", className: "text-ok bg-ok-soft" },
	update: { icon: "✎", label: "Editar", className: "text-brand bg-brand-soft" },
	disable: { icon: "×", label: "Deshabilitar", className: "text-err bg-err-soft" },
	enable: { icon: "●", label: "Habilitar", className: "text-ok bg-ok-soft" },
	preference: { icon: "!", label: "Preferencia", className: "text-effect-ink bg-effect-soft" },
	read: { icon: "!", label: "Lectura", className: "text-effect-ink bg-effect-soft" },
	download: { icon: "↓", label: "Descarga", className: "text-brand bg-brand-soft" },
	credential: { icon: "✎", label: "Credencial", className: "text-brand bg-brand-soft" },
	test: { icon: "!", label: "Prueba de conexión", className: "text-effect-ink bg-effect-soft" },
	failure: { icon: "×", label: "Fallo", className: "text-err bg-err-soft" },
};

const OBJECT_TYPES: { value: AuditFilters["objectType"]; label: string }[] = [
	{ value: "all", label: "Todos" },
	{ value: "account", label: "Cuenta SUNAT" },
	{ value: "credential", label: "Credencial" },
	{ value: "schedule", label: "Programador" },
	{ value: "role", label: "Rol" },
	{ value: "user", label: "Usuario" },
	{ value: "preference", label: "Preferencia" },
	{ value: "item", label: "Elemento del buzón" },
	{ value: "file", label: "Archivo" },
];

/** Marca de orden de bytes para que las hojas de cálculo lean UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const ACTORS = ["Admin Demo", "Usuario Demo Uno", "Usuario Demo Dos", "Usuario Demo Tres", "Sistema"];

/** A6 · Auditoría: solo lectura. El valor de la Clave SOL nunca aparece. */
export const AuditPage = () => {
	const state = useListState<AuditFilters, AuditSortColumn>({ persistKey: "admin-auditoria-v1", initialFilters: INITIAL, initialPageSize: 20 });
	const audit = useAudit(state.request);
	const exportCsv = useExportAudit();

	const download = async () => {
		const csv = await exportCsv.mutateAsync(state.appliedFilters).catch(() => null);
		if (!csv) return;
		const url = URL.createObjectURL(new Blob([BOM + csv], { type: "text/csv;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `auditoria-buzon-sol-${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Auditoría"
				description="Registro de solo lectura. No se puede editar ni borrar."
				actions={
					<Button variant="bordered" startContent={<Download className="size-4" aria-hidden="true" />} onClick={() => void download()} isLoading={exportCsv.isPending} disabled={exportCsv.isPending} className="min-h-10 bg-white">
						Exportar CSV
					</Button>
				}
			/>
			{exportCsv.isError && (
				<Notice tone="error" role="alert" title={errorCopy(exportCsv.error).title}>
					{errorCopy(exportCsv.error).body}
				</Notice>
			)}
			<ListTable<AuditEntry>
				label="Registro de auditoría"
				columns={COLUMNS}
				state={state}
				page={audit.data}
				isLoading={audit.isPending}
				isFetching={audit.isFetching}
				error={audit.error}
				onRetry={() => void audit.refetch()}
				rowKey={(e) => e.id}
				rowName={(e) => `${e.actor} ${e.objectLabel}`}
				hasActions={false}
				countNoun={["evento", "eventos"]}
				emptyContent={<EmptyState title="No hay eventos con estos filtros" action={<Button variant="bordered" onClick={state.resetFilters}>Quitar filtros</Button>}>Amplíe el rango de fechas o elija otra acción.</EmptyState>}
				renderFilter={(column) => {
					switch (column.id) {
						case "at":
							return (
								<FilterSelect
									label="Rango de fechas"
									value={state.filters.range}
									onChange={(v) => state.setFilter("range", v)}
									options={[
										{ value: "7d", label: "Últimos 7 días" },
										{ value: "30d", label: "Últimos 30 días" },
										{ value: "all", label: "Todo" },
									]}
								/>
							);
						case "actor":
							return <FilterSelect label="Realizado por" value={state.filters.actor} onChange={(v) => state.setFilter("actor", v)} options={[{ value: "all", label: "Todos" }, ...ACTORS.map((a) => ({ value: a, label: a }))]} />;
						case "action":
							return <FilterSelect label="Acción" value={state.filters.action} onChange={(v) => state.setFilter("action", v as AuditFilters["action"])} options={[{ value: "all", label: "Todas" }, ...Object.entries(ACTIONS).map(([k, v]) => ({ value: k, label: v.label }))]} />;
						case "object":
							return <FilterSelect label="Elemento" value={state.filters.objectType} onChange={(v) => state.setFilter("objectType", v)} options={OBJECT_TYPES} />;
						default:
							return null;
					}
				}}
				renderCells={(e) => {
					const a = ACTIONS[e.action];
					return (
						<>
							<Table.BodyColumn className="mono text-xs text-ink-2">
								{formatDate(e.at)} {formatTime(e.at)}
							</Table.BodyColumn>
							<Table.BodyColumn className="text-sm">{e.actor}</Table.BodyColumn>
							<Table.BodyColumn>
								<span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold", a.className)}>
									<span aria-hidden="true">{a.icon}</span>
									{a.label}
								</span>
							</Table.BodyColumn>
							<Table.BodyColumn>
								<span className="block text-sm text-ink">{e.objectLabel}</span>
								<span className="text-xs text-muted-ink">{OBJECT_TYPES.find((o) => o.value === e.objectType)?.label}</span>
							</Table.BodyColumn>
							<Table.BodyColumn className="text-sm text-ink-2">{e.change}</Table.BodyColumn>
						</>
					);
				}}
			/>
			<p className="text-xs text-muted-ink">Las claves SOL nunca aparecen en la auditoría; solo se registra que se reemplazaron.</p>
		</div>
	);
};
