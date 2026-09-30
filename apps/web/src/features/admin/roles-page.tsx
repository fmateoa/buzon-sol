import { useId, useState } from "react";
import { Formik, useFormikContext, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import { Checkbox } from "lizaui/checkbox";
import { Table } from "lizaui/table";
import { Input } from "lizaui/ui";
import { Plus } from "lucide-react";
import type { RoleFilters, RoleInput, RoleSortColumn } from "@/domain/adapter";
import { PERMISSIONS, type AccountId, type Permission, type RolePermissions } from "@/domain/types";
import { FocusFirstError, GroupError, TextField } from "@/components/custom/form-field";
import { ListTable, type ColumnDef } from "@/components/custom/list-table";
import { EmptyState, PageHeader, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { SheetBody, SheetFooter, SheetForm, SideSheet } from "@/components/custom/side-sheet";
import { RemoteEffectBadge } from "@/components/custom/status";
import { useAppSession } from "@/features/session/use-session";
import { useLatched } from "@/hooks/use-latched";
import { useListState } from "@/hooks/use-list-state";
import { cn } from "@/lib/cn";
import { errorCopy, isAppError } from "@/lib/errors";
import { PERMISSION_LABELS, REMOTE_EFFECT_PERMISSIONS } from "@/lib/permissions";
import { useAccountOptions, useCreateRole, useRoles, useUpdateRole } from "./queries";

const COLUMNS: ColumnDef[] = [
	{ id: "name", header: "Rol", sort: true, lockVisible: true, minWidth: 180 },
	{ id: "userCount", header: "Usuarios", sort: true, size: 110 },
	{ id: "permissions", header: "Permisos", minWidth: 220 },
	{ id: "accounts", header: "Cuentas visibles", size: 200 },
];

const schema = Yup.object({
	name: Yup.string().trim().required("Ingrese un nombre para el rol.").max(60, "Use 60 caracteres o menos."),
	permissions: Yup.array().min(1, "Elija al menos un permiso."),
	accountIds: Yup.array().test("accounts", "Elija al menos una cuenta o «Todas».", function (value) {
		return this.parent.allAccounts || (value?.length ?? 0) > 0;
	}),
});

const RoleFields = ({ lockedSelf, onCancel }: { lockedSelf: boolean; onCancel: () => void }) => {
	const { values, setFieldValue, errors, submitCount, isSubmitting, status } = useFormikContext<RoleInput>();
	const accounts = useAccountOptions();
	const baseId = useId();
	const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
	const show = submitCount > 0;
	return (
		<SheetForm>
			<SheetBody>
				<FocusFirstError />
				{status && (
					<Notice tone="error" role="alert" title={status.title}>
						{status.body}
					</Notice>
				)}
				<TextField name="name" label="Nombre del rol" required maxLength={60} hint="El nombre es solo una etiqueta: la autorización sale de los permisos y cuentas elegidos." />
				<fieldset data-field="permissions" aria-describedby={show && errors.permissions ? `${baseId}-perm` : undefined}>
					<legend className="mb-2 text-sm font-semibold text-ink">Permisos</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{PERMISSIONS.map((p) => {
							const id = `${baseId}-${p}`;
							return (
								<div key={p} className="flex items-start gap-2">
									<Checkbox id={id} checked={values.permissions.includes(p)} onChange={() => void setFieldValue("permissions", toggle<Permission>(values.permissions, p))} />
									<label htmlFor={id} className="text-sm text-ink">
										{PERMISSION_LABELS[p]}
										{REMOTE_EFFECT_PERMISSIONS.includes(p) && <RemoteEffectBadge className="ml-2" />}
									</label>
								</div>
							);
						})}
					</div>
					<GroupError id={`${baseId}-perm`} message={show ? (errors.permissions as string | undefined) : undefined} />
				</fieldset>
				<fieldset data-field="accountIds" aria-describedby={show && errors.accountIds ? `${baseId}-acc` : undefined}>
					<legend className="mb-2 text-sm font-semibold text-ink">Cuentas SUNAT visibles</legend>
					<div className="flex flex-col gap-2">
						<div className="flex items-start gap-2">
							<Checkbox id={`${baseId}-all`} checked={values.allAccounts} onChange={(e) => void setFieldValue("allAccounts", e.target.checked)} />
							<label htmlFor={`${baseId}-all`} className="text-sm font-semibold text-ink">
								Todas, incluidas las que se agreguen
							</label>
						</div>
						{!values.allAccounts &&
							accounts.data?.map((a) => {
								const id = `${baseId}-acc-${a.id}`;
								return (
									<div key={a.id} className="flex items-center gap-2 pl-6">
										<Checkbox id={id} checked={values.accountIds.includes(a.id)} onChange={() => void setFieldValue("accountIds", toggle<AccountId>(values.accountIds, a.id))} />
										<label htmlFor={id} className="text-sm text-ink">
											{a.alias}
										</label>
									</div>
								);
							})}
					</div>
					<GroupError id={`${baseId}-acc`} message={show ? (errors.accountIds as string | undefined) : undefined} />
				</fieldset>
				<Notice tone="info" role="note">
					Los cambios aplican al guardar, también a las sesiones abiertas, y quedan en auditoría.
					{lockedSelf && " Este es su propio rol: no puede quitarle la gestión de usuarios ni el acceso a todas las cuentas."}
				</Notice>
			</SheetBody>
			<SheetFooter>
				<Button variant="bordered" onClick={onCancel} disabled={isSubmitting} className="min-h-10 bg-paper">
					Cancelar
				</Button>
				<Button type="submit" color="primary" isLoading={isSubmitting} disabled={isSubmitting} className="min-h-10">
					Guardar rol
				</Button>
			</SheetFooter>
		</SheetForm>
	);
};

/** Matriz de solo lectura: ✓ permitido · — no permitido. */
const PermissionMatrix = ({ roles, editingId }: { roles: RolePermissions[]; editingId: string | null }) => {
	const accounts = useAccountOptions();
	const cell = (on: boolean, highlighted: boolean, key: string) => (
		<td key={key} className={cn("px-3 py-2 text-center text-sm", highlighted && "bg-primary-50", on ? "text-ok" : "text-foreground-400")}>
			<span aria-hidden="true">{on ? "✓" : "—"}</span>
			<span className="sr-only">{on ? "permitido" : "no permitido"}</span>
		</td>
	);
	return (
		<Section title="Matriz de permisos y cuentas">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] border-collapse text-left">
					<caption className="sr-only">Permisos y cuentas visibles por rol</caption>
					<thead>
						<tr className="border-b border-line">
							<th scope="col" className="px-3 py-2 text-xs font-semibold text-muted-ink">
								Permiso
							</th>
							{roles.map((r) => (
								<th key={r.id} scope="col" className={cn("px-3 py-2 text-center text-sm font-semibold text-ink", r.id === editingId && "bg-brand-soft shadow-[inset_0_3px_0_var(--bz-brand)]")}>
									{r.name}
									<span className="block text-xs font-normal text-muted-ink">
										{r.userCount} {r.userCount === 1 ? "usuario" : "usuarios"}
									</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{PERMISSIONS.map((p) => (
							<tr key={p} className="border-b border-line">
								<th scope="row" className="px-3 py-2 text-sm font-normal text-ink-2">
									{PERMISSION_LABELS[p]}
									{REMOTE_EFFECT_PERMISSIONS.includes(p) && <span className="ml-1.5 text-xs font-semibold text-effect-ink">! puede marcar leído</span>}
								</th>
								{roles.map((r) => cell(r.permissions.includes(p), r.id === editingId, r.id))}
							</tr>
						))}
						<tr className="border-b border-line bg-surface">
							<th scope="row" colSpan={roles.length + 1} className="px-3 py-2 text-xs font-semibold tracking-wide text-subtle-ink uppercase">
								Cuentas SUNAT visibles
							</th>
						</tr>
						<tr className="border-b border-line">
							<th scope="row" className="px-3 py-2 text-sm font-semibold text-ink-2">
								Todas, incluidas las que se agreguen
							</th>
							{roles.map((r) => cell(r.allAccounts, r.id === editingId, r.id))}
						</tr>
						{accounts.data?.map((a) => (
							<tr key={a.id} className="border-b border-line">
								<th scope="row" className="px-3 py-2 text-sm font-normal text-ink-2">
									{a.alias}
								</th>
								{roles.map((r) => cell(r.allAccounts || r.accountIds.includes(a.id), r.id === editingId, r.id))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Section>
	);
};

/** A4 · Roles: permisos y cuentas visibles. */
export const RolesAdminPage = () => {
	const session = useAppSession();
	const state = useListState<RoleFilters, RoleSortColumn>({ persistKey: "admin-roles-v1", initialFilters: { name: "" }, textKeys: ["name"], initialPageSize: 10 });
	const roles = useRoles(state.request);
	const allRoles = useRoles();
	const create = useCreateRole();
	const update = useUpdateRole();
	const [editing, setEditing] = useState<RolePermissions | "new" | null>(null);
	const sheet = useLatched(editing);
	const accounts = useAccountOptions();

	const submit = async (values: RoleInput, helpers: FormikHelpers<RoleInput>) => {
		helpers.setStatus(undefined);
		try {
			if (editing === "new") await create.mutateAsync(values);
			else if (editing) await update.mutateAsync({ roleId: editing.id, input: values });
			setEditing(null);
		} catch (error) {
			if (isAppError(error, "validation") && error.fields) {
				helpers.setErrors(error.fields as never);
				helpers.setStatus({ title: "Revise el rol", body: Object.values(error.fields).join(" ") });
			} else helpers.setStatus(errorCopy(error));
		}
	};

	const initial: RoleInput =
		sheet && sheet !== "new"
			? { name: sheet.name, permissions: [...sheet.permissions], allAccounts: sheet.allAccounts, accountIds: [...sheet.accountIds] }
			: { name: "", permissions: ["view_mailbox"], allAccounts: false, accountIds: [] };

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Roles y permisos"
				description="Cada usuario tiene un rol. El rol define qué puede hacer y qué cuentas SUNAT ve."
				actions={
					<Button color="primary" startContent={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")} className="min-h-10">
						Crear rol
					</Button>
				}
			/>
			<ListTable<RolePermissions>
				label="Roles"
				columns={COLUMNS}
				state={state}
				page={roles.data}
				isLoading={roles.isPending}
				isFetching={roles.isFetching}
				error={roles.error}
				onRetry={() => void roles.refetch()}
				rowKey={(r) => r.id}
				rowName={(r) => r.name}
				countNoun={["rol", "roles"]}
				emptyContent={<EmptyState title="No hay roles con este nombre" action={<Button variant="bordered" onClick={state.resetFilters}>Quitar filtros</Button>} />}
				renderFilter={(column) => (column.id === "name" ? <Input size="sm" value={state.filters.name} onChange={(e) => state.setFilter("name", e.target.value)} placeholder="Buscar rol" aria-label="Filtrar por nombre de rol" className="bg-paper dark:bg-paper" /> : null)}
				renderCells={(r) => (
					<>
						<Table.BodyColumn className="font-medium text-ink">{r.name}</Table.BodyColumn>
						<Table.BodyColumn className="mono text-sm">{r.userCount}</Table.BodyColumn>
						<Table.BodyColumn className="text-sm text-ink-2">
							{r.permissions.length} de {PERMISSIONS.length}
							{r.permissions.includes("read_content") && <span className="ml-2 text-xs font-semibold text-effect-ink">! lee contenido</span>}
						</Table.BodyColumn>
						<Table.BodyColumn className="text-sm text-ink-2">
							{r.allAccounts ? "Todas (incluye futuras)" : (accounts.data ?? []).filter((a) => r.accountIds.includes(a.id)).map((a) => a.alias).join(", ") || "Ninguna"}
						</Table.BodyColumn>
						<Table.BodyColumn>
							<Button size="sm" variant="bordered" onClick={() => setEditing(r)} className="bg-paper dark:bg-paper">
								Editar<span className="sr-only"> rol {r.name}</span>
							</Button>
						</Table.BodyColumn>
					</>
				)}
			/>
			{allRoles.data && <PermissionMatrix roles={allRoles.data.rows} editingId={editing && editing !== "new" ? editing.id : null} />}
			<p className="text-xs text-muted-ink">✓ permitido · — no permitido. Columna resaltada: rol en edición. Los cambios aplican al guardar y quedan en auditoría.</p>

			<SideSheet
				open={editing !== null}
				onClose={() => setEditing(null)}
				title={sheet === "new" ? "Crear rol" : `Editar rol ${sheet?.name ?? ""}`}
				description="Permisos y cuentas SUNAT visibles. La columna resaltada de la matriz es el rol en edición."
				size="lg"
			>
				{sheet !== null && (
					<Formik<RoleInput> key={sheet === "new" ? "new" : sheet.id} initialValues={initial} validationSchema={schema} onSubmit={submit}>
						<RoleFields lockedSelf={sheet !== "new" && sheet.id === session.user.roleId} onCancel={() => setEditing(null)} />
					</Formik>
				)}
			</SideSheet>
		</div>
	);
};
