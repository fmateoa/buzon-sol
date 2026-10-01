import { Formik, useFormikContext, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import type { AppUser, RoleId, RolePermissions } from "@/domain/types";
import type { UserInput } from "@/domain/adapter";
import { useAdapter } from "@/app/adapter-context";
import { FocusFirstError, GroupError, TextField } from "@/components/custom/form-field";
import { FilterSelect } from "@/components/custom/list-table";
import { Notice } from "@/components/custom/notice";
import { Segmented } from "@/components/custom/segmented";
import { SheetBody, SheetFooter, SheetForm } from "@/components/custom/side-sheet";
import { useAppSession } from "@/features/session/use-session";
import { errorCopy, isAppError } from "@/lib/errors";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { useAccountOptions, useCreateUser, useSetUserStatus, useUpdateUser } from "./queries";

type Values = UserInput & { status: AppUser["status"] };

const schema = Yup.object({
	name: Yup.string().trim().required("Ingrese el nombre.").max(80, "Use 80 caracteres o menos."),
	email: Yup.string().trim().email("Ingrese un correo válido.").required("Ingrese el correo de trabajo."),
	roleId: Yup.string().required("Elija un rol."),
});
const passwordSchema = (min: number) => schema.shape({ password: Yup.string().required("Ingrese la contraseña inicial.").min(min, `Use al menos ${min} caracteres.`) });

/** Vista previa de cuentas derivadas: la asignación de cuentas ocurre en el rol. */
const RolePreview = ({ roles }: { roles: RolePermissions[] }) => {
	const { values } = useFormikContext<Values>();
	const accounts = useAccountOptions();
	const role = roles.find((r) => r.id === values.roleId);
	if (!role) return null;
	const all = accounts.data ?? [];
	const included = role.allAccounts ? all : all.filter((a) => role.accountIds.includes(a.id));
	const excluded = all.length - included.length;
	return (
		<>
			<div className="flex flex-col gap-2">
				<p className="text-sm font-semibold text-ink">Con este rol verá</p>
				<ul className="divide-y divide-line-soft rounded-lg border border-line text-sm">
					{role.allAccounts && (
						<li className="flex gap-2 px-3.5 py-2.5 text-ink">
							<span aria-hidden="true" className="font-bold text-ok">
								✓
							</span>
							Todas las cuentas, incluidas las que se agreguen
						</li>
					)}
					{!role.allAccounts &&
						included.map((a) => (
							<li key={a.id} className="flex gap-2 px-3.5 py-2.5 text-ink">
								<span aria-hidden="true" className="font-bold text-ok">
									✓
								</span>
								{a.alias}
							</li>
						))}
					{!role.allAccounts && excluded > 0 && (
						<li className="flex gap-2 px-3.5 py-2.5 text-subtle-ink">
							<span aria-hidden="true">—</span>
							{excluded} {excluded === 1 ? "cuenta más no incluida" : "cuentas más no incluidas"}
						</li>
					)}
				</ul>
				<p className="text-[13px] text-muted-ink">Para cambiar estas cuentas, edite el rol {role.name} o asigne otro rol.</p>
			</div>
			<p className="rounded-md bg-surface px-3 py-2.5 text-sm text-ink-2">Permisos: {role.permissions.map((p) => PERMISSION_LABELS[p].toLowerCase()).join(", ")}.</p>
		</>
	);
};

const RoleField = ({ roles }: { roles: RolePermissions[] }) => {
	const { values, setFieldValue, errors, submitCount } = useFormikContext<Values>();
	return (
		<label className="flex flex-col gap-1.5 text-sm font-semibold text-ink" data-field="roleId">
			Rol <span className="sr-only">(obligatorio)</span>
			<FilterSelect label="Rol" value={values.roleId || "none"} onChange={(v) => void setFieldValue("roleId", v === "none" ? "" : (v as RoleId))} options={[{ value: "none", label: "Elija un rol" }, ...roles.map((r) => ({ value: r.id as string, label: r.name }))]} className="h-11 font-normal" />
			<GroupError id="role-error" message={submitCount > 0 ? (errors.roleId as string | undefined) : undefined} />
		</label>
	);
};

const StatusField = ({ user, isSelf }: { user: AppUser; isSelf: boolean }) => {
	const { values, setFieldValue } = useFormikContext<Values>();
	// Una invitación pendiente no se «activa» desde aquí: se activa cuando la persona define su contraseña.
	const options = user.status === "invited" ? [{ value: "invited" as const, label: "Invitación enviada" }, { value: "disabled" as const, label: "Desactivado" }] : [{ value: "active" as const, label: "Activo" }, { value: "disabled" as const, label: "Desactivado" }];
	return (
		<div className="flex flex-col gap-2">
			<Segmented legend="Estado" name="status" options={options} value={values.status} onChange={(v) => void setFieldValue("status", v)} disabled={isSelf} />
			{isSelf && <p className="text-xs text-muted-ink">No puede desactivar su propio usuario.</p>}
			{values.status === "disabled" && user.status !== "disabled" && (
				<Notice tone="effect" role="status">
					Al guardar, no podrá ingresar a buzon-sol. Sus acciones anteriores se conservan. El cambio queda en auditoría y puede revertirse.
				</Notice>
			)}
		</div>
	);
};

interface UserFormProps {
	user?: AppUser;
	roles: RolePermissions[];
	/** Usuario de la sesión: no puede cambiar su propio estado. */
	isSelf?: boolean;
	onDone: () => void;
	onCancel: () => void;
}

/** A5 · Alta de usuario o acceso de un usuario existente (estado y rol). */
export const UserForm = ({ user, roles, isSelf = false, onDone, onCancel }: UserFormProps) => {
	const withPassword = useAdapter().userOnboarding === "initial_password";
	const passwordMinLength = useAppSession().passwordMinLength;
	const create = useCreateUser();
	const update = useUpdateUser();
	const setStatus = useSetUserStatus();

	const submit = async ({ status, ...input }: Values, helpers: FormikHelpers<Values>) => {
		helpers.setStatus(undefined);
		try {
			if (!user) {
				await create.mutateAsync(input);
			} else {
				if (input.roleId !== user.roleId) await update.mutateAsync({ userId: user.id, input });
				if (status !== user.status && status !== "invited") await setStatus.mutateAsync({ userId: user.id, status });
			}
			onDone();
		} catch (error) {
			if (isAppError(error, "validation") && error.fields) {
				helpers.setErrors(error.fields);
				// El estado no es un campo de texto: su error se muestra en el aviso superior.
				helpers.setStatus({ title: "Revise el acceso", body: Object.values(error.fields).join(" ") });
			} else helpers.setStatus(errorCopy(error));
		}
	};

	const initial: Values = { name: user?.name ?? "", email: user?.email ?? "", roleId: user?.roleId ?? ("" as RoleId), status: user?.status ?? "invited", ...(withPassword && !user ? { password: "" } : {}) };

	return (
		<Formik<Values> initialValues={initial} validationSchema={withPassword && !user ? passwordSchema(passwordMinLength) : schema} onSubmit={submit}>
			{({ isSubmitting, status }) => (
				<SheetForm>
					<SheetBody>
						<FocusFirstError />
						{status && (
							<Notice tone="error" role="alert" title={status.title}>
								{status.body}
							</Notice>
						)}
						{user ? (
							<StatusField user={user} isSelf={isSelf} />
						) : (
							<>
								<TextField name="name" label="Nombre" required autoComplete="name" />
								<TextField name="email" label="Correo de trabajo" type="email" required autoComplete="email" hint={withPassword ? undefined : "Se enviará una invitación. El usuario define su propia contraseña de buzon-sol."} />
								{withPassword && <TextField name="password" label="Contraseña inicial" type="password" required autoComplete="new-password" hint={`Mínimo ${passwordMinLength} caracteres. Entréguela al usuario por un canal seguro; no se envía por correo ni se vuelve a mostrar.`} />}
							</>
						)}
						<RoleField roles={roles} />
						<RolePreview roles={roles} />
					</SheetBody>
					<SheetFooter>
						<Button variant="bordered" onClick={onCancel} disabled={isSubmitting} className="min-h-10 bg-paper">
							Cancelar
						</Button>
						<Button type="submit" color="primary" isLoading={isSubmitting} disabled={isSubmitting} className="min-h-10">
							{user ? "Guardar acceso" : "Dar de alta"}
						</Button>
					</SheetFooter>
				</SheetForm>
			)}
		</Formik>
	);
};
