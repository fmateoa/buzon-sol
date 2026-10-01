import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Table } from "lizaui/table";
import type { InventoryRun } from "@/domain/types";
import { FilterSelect, ListFooter, TABLE_ROW_CLASS } from "@/components/custom/list-table";
import { BlockSkeleton, EmptyState, PageHeader } from "@/components/custom/layout-bits";
import { QueryError } from "@/components/custom/query-error";
import { boxLabel } from "@/components/custom/status";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { Button } from "lizaui/button";
import { AppError, type AppErrorCode } from "@/domain/adapter";
import { Notice } from "@/components/custom/notice";
import { useCan } from "@/features/session/use-session";
import { errorCopy } from "@/lib/errors";
import { useScheduledRuns, useStartAllInventories } from "./queries";

type Row = InventoryRun & { accountAlias: string };

const STATE: Record<InventoryRun["state"], { icon: string; label: string; tone: string }> = {
	pending: { icon: "○", label: "Pendiente", tone: "text-muted-ink" },
	running: { icon: "↻", label: "En curso", tone: "text-brand" },
	complete: { icon: "✓", label: "Completa", tone: "text-ok" },
	partial: { icon: "◐", label: "Parcial", tone: "text-brand" },
	retrying: { icon: "↻", label: "Reintentando", tone: "text-brand" },
	paused: { icon: "!", label: "En pausa", tone: "text-effect-ink" },
};

const COLUMNS = [
	{ id: "startedAt", header: "Inicio", size: 150 },
	{ id: "account", header: "Cuenta" },
	{ id: "boxes", header: "Bandejas", size: 200 },
	{ id: "result", header: "Resultado" },
	{ id: "state", header: "Estado", size: 150 },
];

/** Actividad programada: consultas de todas las cuentas (solo lectura). */
export const ScheduledRunsPage = () => {
	const runs = useScheduledRuns();
	const canRun = useCan("run_inventory");
	const startAll = useStartAllInventories();
	const started = startAll.data?.filter((r) => r.started).length ?? 0;
	const skipped = startAll.data?.filter((r) => !r.started) ?? [];
	const [account, setAccount] = useState("all");
	const [state, setState] = useState("all");
	const [page, setPage] = useState({ page: 1, size: 20 });

	const rows = useMemo(() => (runs.data ?? []).filter((r) => (account === "all" || r.accountId === account) && (state === "all" || r.state === state)), [runs.data, account, state]);
	const visible = rows.slice((page.page - 1) * page.size, page.page * page.size);
	const accounts = [...new Map((runs.data ?? []).map((r) => [r.accountId, r.accountAlias])).entries()];

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Actividad programada"
				description="Consultas de todas las cuentas: programadas, manuales y pruebas de conexión."
				actions={
					canRun && (
						<Button color="primary" onClick={() => startAll.mutate(undefined)} disabled={startAll.isPending} isLoading={startAll.isPending} className="min-h-11">
							Consultar todas las cuentas
						</Button>
					)
				}
			/>
			{startAll.isError && (
				<Notice tone="error" role="alert" title={errorCopy(startAll.error).title}>
					{errorCopy(startAll.error).body}
				</Notice>
			)}
			{startAll.data && (
				<Notice tone={skipped.length ? "partial" : "success"} title={`${started} ${started === 1 ? "consulta iniciada" : "consultas iniciadas"}. Cada cuenta usa su propia sesión de SUNAT.`}>
					{skipped.length > 0 && (
						<ul className="list-disc pl-5">
							{skipped.map((r) => (
								<li key={r.accountId}>
									{r.alias}: {errorCopy(new AppError((r.errorCode ?? "remote_unavailable") as AppErrorCode)).title ?? "no se pudo iniciar"}
								</li>
							))}
						</ul>
					)}
				</Notice>
			)}
			<div className="flex flex-wrap gap-3">
				<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
					Cuenta
					<FilterSelect label="Cuenta" value={account} onChange={(v) => { setAccount(v); setPage((p) => ({ ...p, page: 1 })); }} options={[{ value: "all", label: "Todas" }, ...accounts.map(([id, alias]) => ({ value: id, label: alias }))]} className="min-w-56" />
				</label>
				<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
					Estado
					<FilterSelect label="Estado" value={state} onChange={(v) => { setState(v); setPage((p) => ({ ...p, page: 1 })); }} options={[{ value: "all", label: "Todos" }, ...Object.entries(STATE).map(([k, v]) => ({ value: k, label: v.label }))]} className="min-w-40" />
				</label>
			</div>
			{runs.isError && <QueryError error={runs.error} onRetry={() => void runs.refetch()} />}
			{runs.isPending ? (
				<BlockSkeleton lines={6} label="Cargando actividad" />
			) : (
				<Table ariaLabel="Consultas de todas las cuentas" dataHeader={COLUMNS} isChecks={false} isActions={false} classNameContainer="bg-paper border border-line p-0">
					<Table.Header>
						<Table.HeaderRow>{({ item }) => <Table.HeaderColumn header={item} text={item.header} size={item.size} />}</Table.HeaderRow>
					</Table.Header>
					<Table.Body<Row> data={visible} rowKey={(r) => r.id} emptyContent={<EmptyState title="No hay consultas con estos filtros" />}>
						{({ item: r }) => (
							<Table.BodyRow keyCurrent={{ id: r.id, name: r.accountAlias }} isCheck={false} className={TABLE_ROW_CLASS}>
								<Table.BodyColumn className="mono text-xs">{formatRelative(r.startedAt)}</Table.BodyColumn>
								<Table.BodyColumn>
									<Link to={`/admin/cuentas/${r.accountId}?tab=programador`} className="text-sm font-medium text-ink hover:underline">
										{r.accountAlias}
									</Link>
									<span className="block text-xs text-muted-ink">{r.mode === "manual" ? "Manual" : r.mode === "test" ? "Prueba" : "Programada"}</span>
								</Table.BodyColumn>
								<Table.BodyColumn className="text-sm">{r.boxes.map(boxLabel).join(" + ")}</Table.BodyColumn>
								<Table.BodyColumn className="text-sm text-ink-2">
									{r.resultText}
									{r.autoOpenedFirstItem && <span className="block text-xs text-effect-ink">! SUNAT abrió el primer elemento al ingresar</span>}
								</Table.BodyColumn>
								<Table.BodyColumn>
									<span className={cn("text-sm font-medium", STATE[r.state].tone)}>
										<span aria-hidden="true">{STATE[r.state].icon} </span>
										{STATE[r.state].label}
									</span>
								</Table.BodyColumn>
							</Table.BodyRow>
						)}
					</Table.Body>
				</Table>
			)}
			{rows.length > 0 && (
				<ListFooter from={(page.page - 1) * page.size + 1} to={Math.min(rows.length, page.page * page.size)} total={rows.length} page={page.page} pageSize={page.size} onChange={(p, size) => setPage({ page: size !== page.size ? 1 : p, size })} countNoun={["consulta", "consultas"]} />
			)}
		</div>
	);
};
