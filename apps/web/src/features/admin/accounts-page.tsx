import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "lizaui/button";
import { Table } from "lizaui/table";
import { Input } from "lizaui/ui";
import { Plus } from "lucide-react";
import type { AccountFilters, AccountSortColumn } from "@/domain/adapter";
import type { AccountId, AdminAccount } from "@/domain/types";
import { ColumnMenu, FilterSelect, ListTable, type ColumnDef } from "@/components/custom/list-table";
import { BlockSkeleton, EmptyState, PageHeader } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { SideSheet } from "@/components/custom/side-sheet";
import { describeConnection, TONE_TEXT } from "@/components/custom/status";
import { useListState } from "@/hooks/use-list-state";
import { useLatched } from "@/hooks/use-latched";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { AccountActiveControl, AccountForm, TestConnectionControl } from "./account-form";
import { useAdminAccount, useAdminAccounts } from "./queries";

/** El `id` ordenable coincide con la clave aceptada por el contrato de lista. */
const COLUMNS: ColumnDef[] = [
	// lizaui solo aplica `minWidth` a columnas redimensionables: se fija `size`.
	{ id: "alias", header: "Cuenta", sort: true, lockVisible: true, size: 240 },
	{ id: "credential", header: "Credencial", sort: true, size: 120 },
	{ id: "schedule", header: "Programador", size: 170 },
	{ id: "lastRun", header: "Última consulta", sort: true, size: 140 },
	{ id: "new", header: "Nuevos", size: 120, information: "Solo cantidades. Los asuntos los ven los usuarios cuyo rol incluye la cuenta." },
	{ id: "users", header: "Usuarios", size: 80 },
];

const INITIAL: AccountFilters = { alias: "", credential: "all", schedule: "all" };

const CREDENTIAL: Record<AdminAccount["credential"]["status"], { icon: string; label: string; tone: string }> = {
	valid: { icon: "●", label: "Válida", tone: "text-ok" },
	rejected: { icon: "×", label: "Rechazada", tone: "text-err" },
	missing: { icon: "○", label: "Sin credencial", tone: "text-muted-ink" },
	untested: { icon: "○", label: "Sin probar", tone: "text-muted-ink" },
};

const newText = (a: AdminAccount) => {
	const { messages, notifications } = a.newSinceLastRun;
	if (a.credential.status !== "valid" && messages + notifications === 0) return "—";
	if (messages + notifications === 0) return "Sin novedades";
	return [messages && `${messages} ${messages === 1 ? "mensaje" : "mensajes"}`, notifications && `${notifications} notif.`].filter(Boolean).join(" · ");
};

type SheetState = { mode: "create" } | { mode: "edit"; accountId: AccountId; alias: string };

/** A2 · Edición en el panel: datos, Clave SOL de solo escritura, prueba de conexión y desactivar. */
const AccountEditSheetContent = ({ accountId, onClose }: { accountId: AccountId; onClose: () => void }) => {
	const account = useAdminAccount(accountId);
	if (account.isPending) return <div className="px-6 py-5"><BlockSkeleton lines={6} label="Cargando cuenta" /></div>;
	if (account.isError) return <div className="px-6 py-5"><QueryError error={account.error} onRetry={() => void account.refetch()} /></div>;
	const a = account.data;
	return (
		<AccountForm
			key={a.id}
			mode="edit"
			account={a}
			// Tras reemplazar la clave el panel sigue abierto para «Probar conexión…».
			onDone={(_saved, { replacedCredential }) => {
				if (!replacedCredential) onClose();
			}}
			onCancel={onClose}
			footerStart={<AccountActiveControl account={a} compact />}
			extra={
				<div className="flex flex-col gap-4">
					<TestConnectionControl account={a} />
					<Link to={`/admin/cuentas/${a.id}?tab=programador`} className="inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline">
						Programador y usuarios con acceso →
					</Link>
				</div>
			}
		/>
	);
};

/** A1 · Cuentas SUNAT. Los asuntos nunca aparecen en esta tabla global. */
export const AccountsAdminPage = () => {
	const navigate = useNavigate();
	const [sheet, setSheet] = useState<SheetState | null>(null);
	const shown = useLatched(sheet);
	const manage = (a: AdminAccount) => setSheet({ mode: "edit", accountId: a.id, alias: a.alias });
	const state = useListState<AccountFilters, AccountSortColumn>({ persistKey: "admin-cuentas-v1", initialFilters: INITIAL, textKeys: ["alias"], initialPageSize: 10 });
	const accounts = useAdminAccounts(state.request);
	const rejected = accounts.data?.rows.filter((a) => a.credential.status === "rejected") ?? [];

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Cuentas SUNAT"
				description={accounts.data ? `${accounts.data.total} cuentas · cada una con su buzón, su credencial y su programador` : undefined}
				actions={
					<>
						<ColumnMenu columns={COLUMNS} hidden={state.hiddenColumns} onToggle={state.toggleColumn} />
						<Button color="primary" startContent={<Plus className="size-4" aria-hidden="true" />} onClick={() => setSheet({ mode: "create" })} className="min-h-10">
							Agregar cuenta SUNAT
						</Button>
					</>
				}
			/>

			{rejected.map((a) => (
				<Notice
					key={a.id}
					tone="error"
					role="status"
					action={
						<Button size="sm" color="primary" onClick={() => manage(a)}>
							Actualizar credencial
						</Button>
					}
				>
					SUNAT rechazó la credencial de {a.alias}. Su programador está en pausa{a.credential.rejectedAt ? ` desde ${formatRelative(a.credential.rejectedAt)}` : ""}.
				</Notice>
			))}

			<ListTable<AdminAccount>
				label="Cuentas SUNAT"
				columns={COLUMNS}
				state={state}
				page={accounts.data}
				isLoading={accounts.isPending}
				isFetching={accounts.isFetching}
				error={accounts.error}
				onRetry={() => void accounts.refetch()}
				rowKey={(a) => a.id}
				rowName={(a) => a.alias}
				countNoun={["cuenta", "cuentas"]}
				actionWidth={110}
				emptyContent={
					<EmptyState title={state.isFiltered ? "No hay cuentas con estos filtros" : "Aún no hay cuentas SUNAT"} action={state.isFiltered ? <Button variant="bordered" onClick={state.resetFilters}>Quitar filtros</Button> : undefined}>
						{state.isFiltered ? "Pruebe con otro nombre o estado." : "Agregue la primera cuenta con su RUC, usuario SOL y Clave SOL."}
					</EmptyState>
				}
				renderFilter={(column) => {
					if (column.id === "alias") return <Input value={state.filters.alias} onChange={(e) => state.setFilter("alias", e.target.value)} placeholder="Buscar nombre" aria-label="Filtrar por nombre de cuenta" size="sm" className="bg-paper dark:bg-paper" />;
					if (column.id === "credential")
						return (
							<FilterSelect
								label="Filtrar por credencial"
								value={state.filters.credential}
								onChange={(v) => state.setFilter("credential", v)}
								options={[
									{ value: "all", label: "Todas" },
									{ value: "valid", label: "Válida" },
									{ value: "rejected", label: "Rechazada" },
									{ value: "untested", label: "Sin probar" },
									{ value: "missing", label: "Sin credencial" },
								]}
							/>
						);
					if (column.id === "schedule")
						return (
							<FilterSelect
								label="Filtrar por programador"
								value={state.filters.schedule}
								onChange={(v) => state.setFilter("schedule", v)}
								options={[
									{ value: "all", label: "Todos" },
									{ value: "active", label: "Activo" },
									{ value: "paused", label: "En pausa" },
									{ value: "disabled", label: "Desactivado" },
								]}
							/>
						);
					return null;
				}}
				renderCells={(a) => {
					const cred = CREDENTIAL[a.credential.status];
					const view = describeConnection(a.connection);
					return (
						<>
							<Table.BodyColumn>
								<div className="py-1">
									<Link to={`/admin/cuentas/${a.id}`} className="font-semibold text-ink hover:underline">
										{a.alias}
									</Link>
									{!a.active && <span className="ml-2 rounded-sm bg-surface-2 px-1.5 text-xs text-muted-ink">Desactivada</span>}
									<p className="mono text-xs text-muted-ink">
										RUC {a.rucMasked} · usuario {a.solUserMasked ?? "—"}
									</p>
								</div>
							</Table.BodyColumn>
							<Table.BodyColumn>
								<span className={cn("text-sm font-medium", cred.tone)}>
									<span aria-hidden="true">{cred.icon} </span>
									{cred.label}
								</span>
							</Table.BodyColumn>
							<Table.BodyColumn>
								<span className={cn("block text-sm", TONE_TEXT[view.tone])}>{a.connection.scheduleState === "active" ? a.scheduleSummary : view.label}</span>
								<span className="text-xs text-muted-ink">{a.connection.nextRunAt ? `Próxima: ${formatRelative(a.connection.nextRunAt)}` : a.credential.status === "missing" ? "Requiere credencial" : "Sin próximas"}</span>
							</Table.BodyColumn>
							<Table.BodyColumn className="text-sm text-ink-2">
								{a.connection.lastRunAt ? `${formatRelative(a.connection.lastRunAt)} · ${a.connection.lastRunState === "complete" ? "completa" : a.connection.lastRunState === "paused" ? "falló" : "parcial"}` : "Nunca"}
							</Table.BodyColumn>
							<Table.BodyColumn className={cn("text-sm", a.newSinceLastRun.messages + a.newSinceLastRun.notifications > 0 ? "font-semibold text-ink" : "text-muted-ink")}>{newText(a)}</Table.BodyColumn>
							<Table.BodyColumn className="mono text-sm">{a.userCount}</Table.BodyColumn>
							<Table.BodyColumn>
								<Button size="sm" variant="bordered" onClick={() => manage(a)} className="bg-paper dark:bg-paper">
									Gestionar<span className="sr-only"> {a.alias}</span>
								</Button>
							</Table.BodyColumn>
						</>
					);
				}}
			/>
			<p className="text-xs text-muted-ink">«Nuevos» muestra solo cantidades. Los asuntos y contenidos los ven los usuarios cuyo rol incluye la cuenta.</p>

			<SideSheet
				open={sheet !== null}
				onClose={() => setSheet(null)}
				title={shown?.mode === "edit" ? "Editar cuenta SUNAT" : "Agregar cuenta SUNAT"}
				description={shown?.mode === "edit" ? shown.alias : "RUC, usuario SOL y Clave SOL de solo escritura."}
				size="lg"
			>
				{shown?.mode === "edit" && <AccountEditSheetContent accountId={shown.accountId} onClose={() => setSheet(null)} />}
				{shown?.mode === "create" && (
					<AccountForm
						mode="create"
						onCancel={() => setSheet(null)}
						onDone={(account) => {
							setSheet(null);
							navigate(`/admin/cuentas/${account.id}`);
						}}
					/>
				)}
			</SideSheet>
		</div>
	);
};
