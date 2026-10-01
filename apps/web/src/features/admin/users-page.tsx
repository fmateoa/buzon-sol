import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "lizaui/button";
import { Table } from "lizaui/table";
import { Input } from "lizaui/ui";
import { Plus } from "lucide-react";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { UserFilters, UserSortColumn } from "@/domain/adapter";
import type { AppUser, UserId } from "@/domain/types";
import { ColumnMenu, FilterSelect, ListTable, type ColumnDef } from "@/components/custom/list-table";
import { EmptyState, PageHeader } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { SideSheet } from "@/components/custom/side-sheet";
import { useAppSession } from "@/features/session/use-session";
import { useLatched } from "@/hooks/use-latched";
import { useListState } from "@/hooks/use-list-state";
import { runBatch, type BatchOutcome } from "@/lib/batch";
import { cn } from "@/lib/cn";
import { errorCopy } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { useRoles, useSetUserStatus, useUsers } from "./queries";
import { UserForm } from "./user-form";

const COLUMNS: ColumnDef[] = [
	{ id: "name", header: "Nombre", sort: true, lockVisible: true, minWidth: 200 },
	{ id: "email", header: "Correo", sort: true, minWidth: 200 },
	{ id: "status", header: "Estado", sort: true, size: 160 },
	{ id: "roleName", header: "Rol", sort: true, size: 150 },
	{ id: "accounts", header: "Cuentas visibles", size: 150, information: "Derivadas del rol." },
];

const INITIAL: UserFilters = { name: "", email: "", roleName: "", status: "all" };

const STATUS = {
	active: { icon: "●", label: "Activo", tone: "text-ok" },
	invited: { icon: "○", label: "Invitación enviada", tone: "text-muted-ink" },
	disabled: { icon: "×", label: "Desactivado", tone: "text-err" },
} as const;

type BatchAction = { kind: "disable" | "enable"; items: { id: string; name: string }[] };

/** A5 · Usuarios. La asignación de cuentas ocurre en el rol. */
export const UsersAdminPage = () => {
	const session = useAppSession();
	const adapter = useAdapter();
	const client = useQueryClient();
	const state = useListState<UserFilters, UserSortColumn>({ persistKey: "admin-usuarios-v1", initialFilters: INITIAL, textKeys: ["name", "email"], initialPageSize: 10 });
	const users = useUsers(state.request);
	const roles = useRoles();
	const setStatus = useSetUserStatus();
	const [editing, setEditing] = useState<AppUser | "new" | null>(null);
	const sheet = useLatched(editing);
	const [confirmUser, setConfirmUser] = useState<AppUser | null>(null);
	const [batch, setBatch] = useState<BatchAction | null>(null);
	const [batchRunning, setBatchRunning] = useState(false);
	const [outcome, setOutcome] = useState<BatchOutcome | null>(null);

	const roleList = roles.data?.rows ?? [];
	const accountsFor = (u: AppUser) => {
		const role = roleList.find((r) => r.id === u.roleId);
		if (!role) return "—";
		return role.allAccounts ? "Todas" : `${role.accountIds.length} ${role.accountIds.length === 1 ? "cuenta" : "cuentas"}`;
	};

	const selectedUsers = (users.data?.rows ?? []).filter((u) => state.selection.some((s) => s.id === u.id));

	const runBatchAction = async () => {
		if (!batch) return;
		setBatchRunning(true);
		const result = await runBatch(batch.items, (id) => adapter.setUserStatus(id as UserId, batch.kind === "disable" ? "disabled" : "active"));
		setBatchRunning(false);
		setBatch(null);
		setOutcome(result);
		state.clearSelection();
		void client.invalidateQueries({ queryKey: qk.admin.all });
		void client.invalidateQueries({ queryKey: qk.session });
	};

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Usuarios"
				description={users.data ? `${users.data.total} usuarios · ${roleList.length} roles` : undefined}
				actions={
					<>
						<ColumnMenu columns={COLUMNS} hidden={state.hiddenColumns} onToggle={state.toggleColumn} className="min-h-10" />
						<Button color="primary" startContent={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")} className="min-h-10">
							Dar de alta usuario
						</Button>
					</>
				}
			/>

			{outcome && (
				<Notice
					tone={outcome.failed.length ? "effect" : "success"}
					title={`${outcome.succeeded.length} actualizados${outcome.failed.length ? ` · ${outcome.failed.length} con error` : ""}`}
					action={
						<Button size="sm" variant="light" onClick={() => setOutcome(null)}>
							Cerrar
						</Button>
					}
				>
					{outcome.failed.length > 0 && (
						<ul className="list-inside list-disc">
							{outcome.failed.map((f) => (
								<li key={f.name}>
									{f.name}: {f.reason}
								</li>
							))}
						</ul>
					)}
				</Notice>
			)}

			<ListTable<AppUser>
				label="Usuarios de buzon-sol"
				columns={COLUMNS}
				state={state}
				page={users.data}
				isLoading={users.isPending}
				isFetching={users.isFetching}
				error={users.error}
				onRetry={() => void users.refetch()}
				rowKey={(u) => u.id}
				rowName={(u) => u.name}
				selectable
				isSelectable={(u) => u.id !== session.user.id}
				countNoun={["usuario", "usuarios"]}
				actionWidth={200}
				batchBar={
					state.selection.length > 0 && (
						<div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper px-4 py-2.5 text-sm" role="region" aria-label="Acciones de lote">
							<span className="font-semibold text-ink">{state.selection.length} seleccionados</span>
							<div className="ml-auto flex flex-wrap gap-2">
								<Button size="sm" variant="light" onClick={state.clearSelection}>
									Quitar selección
								</Button>
								<Button size="sm" variant="bordered" disabled={!selectedUsers.some((u) => u.status === "disabled")} onClick={() => setBatch({ kind: "enable", items: selectedUsers.filter((u) => u.status === "disabled").map((u) => ({ id: u.id, name: u.name })) })}>
									Activar
								</Button>
								<Button size="sm" variant="bordered" color="danger" disabled={!selectedUsers.some((u) => u.status !== "disabled")} onClick={() => setBatch({ kind: "disable", items: selectedUsers.filter((u) => u.status !== "disabled").map((u) => ({ id: u.id, name: u.name })) })}>
									Desactivar
								</Button>
							</div>
						</div>
					)
				}
				emptyContent={
					<EmptyState title="No hay usuarios con estos filtros" action={<Button variant="bordered" onClick={state.resetFilters}>Quitar filtros</Button>}>
						Pruebe con otro nombre, correo, rol o estado.
					</EmptyState>
				}
				renderFilter={(column) => {
					if (column.id === "name") return <Input size="sm" value={state.filters.name} onChange={(e) => state.setFilter("name", e.target.value)} placeholder="Buscar nombre" aria-label="Filtrar por nombre" className="bg-paper dark:bg-paper" />;
					if (column.id === "email") return <Input size="sm" value={state.filters.email} onChange={(e) => state.setFilter("email", e.target.value)} placeholder="Buscar correo" aria-label="Filtrar por correo" className="bg-paper dark:bg-paper" />;
					if (column.id === "status")
						return (
							<FilterSelect
								label="Filtrar por estado"
								value={state.filters.status}
								onChange={(v) => state.setFilter("status", v)}
								options={[
									{ value: "all", label: "Todos" },
									{ value: "active", label: "Activo" },
									{ value: "invited", label: "Invitación enviada" },
									{ value: "disabled", label: "Desactivado" },
								]}
							/>
						);
					if (column.id === "roleName")
						return <FilterSelect label="Filtrar por rol" value={state.filters.roleName || "all"} onChange={(v) => state.setFilter("roleName", v === "all" ? "" : v)} options={[{ value: "all", label: "Todos" }, ...roleList.map((r) => ({ value: r.name, label: r.name }))]} />;
					return null;
				}}
				renderCells={(u) => {
					const s = STATUS[u.status];
					const self = u.id === session.user.id;
					return (
						<>
							<Table.BodyColumn>
								<span className="font-medium text-ink">{u.name}</span>
								{self && <span className="ml-1.5 text-xs text-muted-ink">(usted)</span>}
								<span className="block text-xs text-muted-ink">Última actividad: {formatRelative(u.lastActivityAt)}</span>
							</Table.BodyColumn>
							<Table.BodyColumn className="text-sm text-ink-2">{u.email}</Table.BodyColumn>
							<Table.BodyColumn>
								<span className={cn("text-sm font-medium", s.tone)}>
									<span aria-hidden="true">{s.icon} </span>
									{s.label}
								</span>
							</Table.BodyColumn>
							<Table.BodyColumn className="text-sm">{u.roleName}</Table.BodyColumn>
							<Table.BodyColumn className="text-sm text-ink-2">{accountsFor(u)}</Table.BodyColumn>
							<Table.BodyColumn>
								<div className="flex gap-2">
									<Button size="sm" variant="bordered" onClick={() => setEditing(u)} className="bg-paper dark:bg-paper">
										Editar<span className="sr-only"> {u.name}</span>
									</Button>
									{!self && (
										<Button size="sm" variant="light" color={u.status === "disabled" ? "primary" : "danger"} onClick={() => setConfirmUser(u)}>
											{u.status === "disabled" ? "Activar" : "Desactivar"}
											<span className="sr-only"> {u.name}</span>
										</Button>
									)}
								</div>
							</Table.BodyColumn>
						</>
					);
				}}
			/>

			<SideSheet
				open={editing !== null}
				onClose={() => setEditing(null)}
				title={sheet === "new" ? "Dar de alta usuario" : `Acceso de ${sheet?.name ?? ""}`}
				description={sheet === "new" ? "La asignación de cuentas ocurre en el rol." : sheet?.email}
				size="md"
			>
				{sheet !== null && (
					<UserForm
						key={sheet === "new" ? "new" : sheet.id}
						user={sheet === "new" ? undefined : sheet}
						roles={roleList}
						isSelf={sheet !== "new" && sheet.id === session.user.id}
						onDone={() => setEditing(null)}
						onCancel={() => setEditing(null)}
					/>
				)}
			</SideSheet>

			<ResponsiveDialog
				open={confirmUser !== null}
				onClose={() => setConfirmUser(null)}
				title={confirmUser?.status === "disabled" ? `¿Activar a ${confirmUser?.name}?` : `¿Desactivar a ${confirmUser?.name ?? ""}?`}
				footer={
					<>
						<Button variant="bordered" onClick={() => setConfirmUser(null)}>
							Cancelar
						</Button>
						<Button
							color={confirmUser?.status === "disabled" ? "primary" : "danger"}
							isLoading={setStatus.isPending}
							disabled={setStatus.isPending}
							onClick={() => confirmUser && setStatus.mutate({ userId: confirmUser.id, status: confirmUser.status === "disabled" ? "active" : "disabled" }, { onSettled: () => setConfirmUser(null) })}
						>
							{confirmUser?.status === "disabled" ? "Activar" : "Desactivar"}
						</Button>
					</>
				}
			>
				<p className="text-sm text-ink-2">
					{confirmUser?.status === "disabled" ? "Podrá volver a ingresar con su rol actual." : "No podrá ingresar a buzon-sol. Sus acciones anteriores se conservan. El cambio queda en auditoría y puede revertirse."}
				</p>
			</ResponsiveDialog>
			{setStatus.isError && (
				<Notice tone="error" role="alert" title={errorCopy(setStatus.error).title}>
					{setStatus.error.fields ? Object.values(setStatus.error.fields).join(" ") : errorCopy(setStatus.error).body}
				</Notice>
			)}

			<ResponsiveDialog
				open={batch !== null}
				onClose={() => setBatch(null)}
				dismissDisabled={batchRunning}
				title={batch?.kind === "disable" ? `¿Desactivar ${batch.items.length} usuarios?` : `¿Activar ${batch?.items.length ?? 0} usuarios?`}
				footer={
					<>
						<Button variant="bordered" onClick={() => setBatch(null)} disabled={batchRunning}>
							Cancelar
						</Button>
						<Button color={batch?.kind === "disable" ? "danger" : "primary"} isLoading={batchRunning} disabled={batchRunning} onClick={() => void runBatchAction()}>
							{batch?.kind === "disable" ? "Desactivar" : "Activar"}
						</Button>
					</>
				}
			>
				<p className="text-sm text-ink-2">Se aplicará a:</p>
				<ul className="mt-1 list-inside list-disc text-sm text-ink">
					{batch?.items.map((i) => <li key={i.id}>{i.name}</li>)}
				</ul>
				<p className="mt-2 text-xs text-muted-ink">Cada usuario se actualiza por separado: un fallo no revierte los demás. Los cambios quedan en auditoría.</p>
			</ResponsiveDialog>
		</div>
	);
};
