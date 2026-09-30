import { Form, Formik, useFormikContext, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import type { AppUser, RoleId, RolePermissions } from "@/domain/types";
import type { UserInput } from "@/domain/adapter";
import { FocusFirstError, GroupError, TextField } from "@/components/custom/form-field";
import { FilterSelect } from "@/components/custom/list-table";
import { Notice } from "@/components/custom/notice";
import { errorCopy, isAppError } from "@/lib/errors";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { useAccountOptions, useCreateUser, useUpdateUser } from "./queries";

const schema = Yup.object({
	name: Yup.string().trim().required("Ingrese el nombre.").max(80, "Use 80 caracteres o menos."),
	email: Yup.string().trim().email("Ingrese un correo válido.").required("Ingrese el correo de trabajo."),
	roleId: Yup.string().required("Elija un rol."),
});

/** Vista previa de cuentas derivadas: la asignación de cuentas ocurre en el rol. */
const RolePreview = ({ roles }: { roles: RolePermissions[] }) => {
	const { values } = useFormikContext<UserInput>();
	const accounts = useAccountOptions();
	const role = roles.find((r) => r.id === values.roleId);
	if (!role) return null;
	const all = accounts.data ?? [];
	const included = role.allAccounts ? all : all.filter((a) => role.accountIds.includes(a.id));
	const excluded = all.length - included.length;
	return (
		<div className="rounded-lg border border-line bg-surface p-3 text-sm">
			<p className="font-semibold text-ink">Con este rol verá</p>
			<ul className="mt-1">
				{role.allAccounts && <li className="text-ink-2">✓ Todas las cuentas, incluidas las que se agreguen</li>}
				{!role.allAccounts &&
					included.map((a) => (
						<li key={a.id} className="text-ink-2">
							<span aria-hidden="true" className="text-ok">
								✓{" "}
							</span>
							{a.alias}
						</li>
					))}
				{!role.allAccounts && excluded > 0 && <li className="text-muted-ink">— {excluded} {excluded === 1 ? "cuenta más no incluida" : "cuentas más no incluidas"}</li>}
			</ul>
			<p className="mt-2 text-xs text-muted-ink">Para cambiar estas cuentas, edite el rol {role.name} o asigne otro rol.</p>
			<p className="mt-1 text-xs text-muted-ink">Permisos: {role.permissions.map((p) => PERMISSION_LABELS[p].toLowerCase()).join(", ")}.</p>
		</div>
	);
};

const RoleField = ({ roles }: { roles: RolePermissions[] }) => {
	const { values, setFieldValue, errors, submitCount } = useFormikContext<UserInput>();
	return (
		<label className="flex flex-col gap-1 text-sm text-foreground" data-field="roleId">
			Rol <span className="sr-only">(obligatorio)</span>
			<FilterSelect label="Rol" value={values.roleId || "none"} onChange={(v) => void setFieldValue("roleId", v === "none" ? "" : (v as RoleId))} options={[{ value: "none", label: "Elija un rol" }, ...roles.map((r) => ({ value: r.id as string, label: r.name }))]} className="h-10" />
			<GroupError id="role-error" message={submitCount > 0 ? (errors.roleId as string | undefined) : undefined} />
		</label>
	);
};

export const UserForm = ({ user, roles, onDone, onCancel }: { user?: AppUser; roles: RolePermissions[]; onDone: () => void; onCancel: () => void }) => {
	const create = useCreateUser();
	const update = useUpdateUser();
	const submit = async (values: UserInput, helpers: FormikHelpers<UserInput>) => {
		helpers.setStatus(undefined);
		try {
			if (user) await update.mutateAsync({ userId: user.id, input: values });
			else await create.mutateAsync(values);
			onDone();
		} catch (error) {
			if (isAppError(error, "validation") && error.fields) helpers.setErrors(error.fields);
			else helpers.setStatus(errorCopy(error));
		}
	};
	return (
		<Formik<UserInput> initialValues={{ name: user?.name ?? "", email: user?.email ?? "", roleId: user?.roleId ?? ("" as RoleId) }} validationSchema={schema} onSubmit={submit}>
			{({ isSubmitting, status }) => (
				<Form noValidate className="flex flex-col gap-4">
					<FocusFirstError />
					{status && (
						<Notice tone="error" role="alert" title={status.title}>
							{status.body}
						</Notice>
					)}
					<TextField name="name" label="Nombre" required autoComplete="name" />
					<TextField name="email" label="Correo de trabajo" type="email" required autoComplete="email" hint={user ? undefined : "Se enviará una invitación. El usuario define su propia contraseña de buzon-sol."} />
					<RoleField roles={roles} />
					<RolePreview roles={roles} />
					<div className="flex justify-end gap-2 border-t border-line pt-4">
						<Button variant="bordered" onClick={onCancel} disabled={isSubmitting}>
							Cancelar
						</Button>
						<Button type="submit" color="primary" isLoading={isSubmitting} disabled={isSubmitting}>
							{user ? "Guardar acceso" : "Dar de alta"}
						</Button>
					</div>
				</Form>
			)}
		</Formik>
	);
};
