import { useId, useState } from "react";
import { Form, Formik, type FormikHelpers } from "formik";
import { useQueryClient } from "@tanstack/react-query";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import { Checkbox } from "lizaui/checkbox";
import type { CredentialTestResult } from "@/domain/adapter";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { AccountId, AdminAccount } from "@/domain/types";
import { FocusFirstError, TextField } from "@/components/custom/form-field";
import { Notice } from "@/components/custom/notice";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { errorCopy, isAppError } from "@/lib/errors";
import { formatDate, formatRelative } from "@/lib/format";
import { useCreateAccount, useReplaceCredential, useSetAccountActive, useTestConnection, useUpdateAccount } from "./queries";

interface Values {
	alias: string;
	ruc: string;
	solUser: string;
	solPassword: string;
}

const SOL_USER = /^[A-Za-z0-9]{3,20}$/;
const SOL_USER_MSG = "El usuario SOL tiene de 3 a 20 letras o números.";
const baseSchema = {
	alias: Yup.string().trim().required("Ingrese un nombre interno.").max(80, "Use 80 caracteres o menos."),
	solPassword: Yup.string().max(64, "La clave es demasiado larga."),
};
const createSchema = Yup.object({
	...baseSchema,
	ruc: Yup.string().required("Ingrese el RUC.").matches(/^(10|15|16|17|20)\d{9}$/, "El RUC tiene 11 dígitos y empieza con 10, 15, 16, 17 o 20."),
	solUser: Yup.string().trim().required("Ingrese el usuario SOL.").matches(SOL_USER, SOL_USER_MSG),
});
// En edición, el usuario SOL vacío conserva el guardado (tampoco se precarga completo).
const editSchema = Yup.object({ ...baseSchema, solUser: Yup.string().trim().matches(SOL_USER, { message: SOL_USER_MSG, excludeEmptyString: true }) });

export const credentialStatusText = (account: AdminAccount) => {
	const { status, savedAt } = account.credential;
	if (status === "missing") return "Sin Clave SOL guardada.";
	const saved = savedAt ? `Guardada el ${formatDate(savedAt)}` : "Guardada";
	if (status === "rejected") return `${saved}, pero SUNAT la rechazó.`;
	if (status === "untested") return `${saved}. Aún no se probó la conexión.`;
	return `${saved}. SUNAT la aceptó en la última prueba.`;
};

const credentialIcon = { valid: "●", rejected: "×", missing: "○", untested: "○" } as const;
const credentialTone = { valid: "text-ok", rejected: "text-err", missing: "text-muted-ink", untested: "text-muted-ink" } as const;

const PasswordField = () => {
	const [visible, setVisible] = useState(false);
	const toggleId = useId();
	return (
		<div className="flex flex-col gap-2">
			<TextField
				name="solPassword"
				label="Nueva Clave SOL"
				type={visible ? "text" : "password"}
				autoComplete="new-password"
				hint="Se guarda cifrada. Después de guardarla nadie puede verla, tampoco los administradores. Cada cambio queda en el registro de auditoría."
			/>
			<div className="flex items-center gap-2">
				<Checkbox id={toggleId} checked={visible} onChange={(e) => setVisible(e.target.checked)} />
				<label htmlFor={toggleId} className="text-sm text-ink-2">
					Mostrar mientras escribe
				</label>
			</div>
		</div>
	);
};

interface AccountFormProps {
	mode: "create" | "edit";
	account?: AdminAccount;
	onDone: (account: AdminAccount) => void;
	onCancel: () => void;
}

/** A2 · Alta/edición de cuenta. La Clave SOL es de solo escritura y se borra del estado al guardar. */
export const AccountForm = ({ mode, account, onDone, onCancel }: AccountFormProps) => {
	const create = useCreateAccount();
	const update = useUpdateAccount((account?.id ?? "") as AccountId);
	const replace = useReplaceCredential((account?.id ?? "") as AccountId);
	const adapter = useAdapter();
	const client = useQueryClient();
	const [pendingReplace, setPendingReplace] = useState<{ values: Values; helpers: FormikHelpers<Values> } | null>(null);
	const [result, setResult] = useState<string | null>(null);

	const submit = async (values: Values, helpers: FormikHelpers<Values>) => {
		setResult(null);
		try {
			if (mode === "create") {
				const created = await create.mutateAsync({ alias: values.alias, ruc: values.ruc, solUser: values.solUser });
				if (values.solPassword) {
					const adapterReplace = await replaceFor(created.id, values.solPassword);
					helpers.resetForm();
					onDone(adapterReplace ?? created);
				} else {
					helpers.resetForm();
					onDone(created);
				}
				return;
			}
			if (values.solPassword) {
				// Reemplazar exige confirmación explícita («Reemplazar y probar»).
				setPendingReplace({ values, helpers });
				return;
			}
			const saved = await update.mutateAsync({ alias: values.alias, solUser: values.solUser });
			helpers.resetForm({ values: { ...values, solPassword: "" } });
			setResult("Cambios guardados.");
			onDone(saved);
		} catch (error) {
			if (isAppError(error, "validation") && error.fields) helpers.setErrors(error.fields as Partial<Values>);
			else helpers.setStatus(errorCopy(error));
		}
	};

	// En el alta se usa el id recién creado: el hook ligado a la cuenta aún no lo conoce.
	const replaceFor = async (accountId: AccountId, password: string) => {
		const result = await adapter.replaceCredential(accountId, password);
		void client.invalidateQueries({ queryKey: qk.admin.all });
		if (!result.ok) throw result.error;
		return result.data;
	};

	const initial: Values = { alias: account?.alias ?? "", ruc: "", solUser: "", solPassword: "" };

	return (
		<Formik<Values> initialValues={initial} validationSchema={mode === "create" ? createSchema : editSchema} onSubmit={submit}>
			{({ isSubmitting, status, values, resetForm }) => (
				<Form noValidate className="flex flex-col gap-5">
					<FocusFirstError />
					{status && (
						<Notice tone="error" role="alert" title={status.title}>
							{status.body}
						</Notice>
					)}
					{result && <Notice tone="success">{result}</Notice>}
					<TextField name="alias" label="Nombre interno" required maxLength={80} />
					{mode === "create" ? (
						<TextField name="ruc" label="RUC" required inputMode="numeric" maxLength={11} hint="Se guarda protegido. En listados solo se muestra enmascarado." />
					) : (
						<div>
							<p className="text-sm text-foreground">RUC</p>
							<p className="mono text-sm text-ink">{account?.rucMasked}</p>
							<p className="text-xs text-muted-ink">No se puede cambiar. Para otro RUC, agregue otra cuenta.</p>
						</div>
					)}
					<TextField
						name="solUser"
						label={mode === "edit" ? "Nuevo usuario SOL" : "Usuario SOL"}
						required={mode === "create"}
						maxLength={20}
						hint={mode === "edit" ? `Actual: ${account?.solUserMasked ?? "sin usuario"}. Déjelo vacío para conservarlo.` : undefined}
					/>

					<fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
						<legend className="px-1 text-sm font-semibold text-ink">Clave SOL</legend>
						{account && (
							<p className={`text-sm ${credentialTone[account.credential.status]}`}>
								<span aria-hidden="true">{credentialIcon[account.credential.status]} </span>
								{credentialStatusText(account)}
							</p>
						)}
						<p className="text-xs text-muted-ink">Nunca se muestra. Solo puede reemplazarse.</p>
						<PasswordField />
					</fieldset>

					<div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
						<Button
							variant="bordered"
							onClick={() => {
								resetForm();
								onCancel();
							}}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button type="submit" color="primary" isLoading={isSubmitting} disabled={isSubmitting}>
							{mode === "create" ? "Agregar cuenta" : values.solPassword ? "Guardar y reemplazar clave…" : "Guardar"}
						</Button>
					</div>

					<ResponsiveDialog
						open={pendingReplace !== null}
						onClose={() => setPendingReplace(null)}
						title={`¿Reemplazar la Clave SOL de ${account?.alias ?? "la cuenta"}?`}
						dismissDisabled={replace.isPending}
						footer={
							<>
								<Button variant="bordered" onClick={() => setPendingReplace(null)} disabled={replace.isPending}>
									Cancelar
								</Button>
								<Button
									color="warning"
									isLoading={replace.isPending}
									disabled={replace.isPending}
									onClick={async () => {
										if (!pendingReplace) return;
										const { values: v, helpers } = pendingReplace;
										try {
											await update.mutateAsync({ alias: v.alias, solUser: v.solUser });
											const saved = await replace.mutateAsync(v.solPassword);
											helpers.resetForm({ values: { ...v, solPassword: "" } });
											setResult("Clave SOL reemplazada. Pruebe la conexión para reanudar el programador.");
											onDone(saved);
										} catch (error) {
											helpers.setStatus(errorCopy(error));
										} finally {
											setPendingReplace(null);
										}
									}}
								>
									Reemplazar
								</Button>
							</>
						}
					>
						<p className="text-sm text-ink-2">La clave actual se descarta. La nueva se guarda cifrada y no se podrá volver a ver.</p>
					</ResponsiveDialog>
				</Form>
			)}
		</Formik>
	);
};

/** «Probar conexión…»: inicia sesión en SUNAT; advierte que podría abrir el primer elemento. */
export const TestConnectionControl = ({ account }: { account: AdminAccount }) => {
	const test = useTestConnection(account.id);
	const [confirm, setConfirm] = useState(false);
	const [last, setLast] = useState<CredentialTestResult | null>(null);
	const run = async () => {
		setConfirm(false);
		try {
			setLast(await test.mutateAsync(undefined));
		} catch {
			/* el error se muestra abajo */
		}
	};
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<Button color="warning" variant="bordered" onClick={() => setConfirm(true)} disabled={test.isPending || account.credential.status === "missing"} isLoading={test.isPending}>
					Probar conexión…
				</Button>
				{last && (
					<span className={last.accepted ? "text-sm font-semibold text-ok" : "text-sm font-semibold text-err"} role="status">
						{last.accepted ? "✓ SUNAT aceptó la credencial" : "× SUNAT rechazó la credencial"} · {formatRelative(last.testedAt)}
					</span>
				)}
			</div>
			{last?.autoOpenedFirstItem && (
				<Notice tone="effect" role="status">
					Al iniciar sesión, SUNAT abrió automáticamente el primer elemento del buzón. Quedó registrado en la actividad de la cuenta.
				</Notice>
			)}
			{test.isError && (
				<Notice tone="error" role="alert" title={errorCopy(test.error).title}>
					{errorCopy(test.error).body}
				</Notice>
			)}
			<p className="text-xs text-muted-ink">Al probar la conexión se inicia sesión en SUNAT. SUNAT podría abrir automáticamente el primer elemento del buzón. Si ocurre, queda registrado en la actividad de la cuenta.</p>
			<ResponsiveDialog
				open={confirm}
				onClose={() => setConfirm(false)}
				title="¿Probar la conexión con SUNAT?"
				footer={
					<>
						<Button variant="bordered" onClick={() => setConfirm(false)}>
							Cancelar
						</Button>
						<Button color="warning" onClick={() => void run()}>
							Probar conexión
						</Button>
					</>
				}
			>
				<p className="text-sm text-ink-2">
					Se iniciará sesión en SUNAT con la credencial guardada. <strong className="text-effect-ink">SUNAT podría abrir automáticamente el primer elemento</strong> y marcarlo como leído. buzon-sol no puede revertir ese cambio.
				</p>
			</ResponsiveDialog>
		</div>
	);
};

/** Desactivar detiene el programador; conserva inventario y auditoría. */
export const AccountActiveControl = ({ account }: { account: AdminAccount }) => {
	const setActive = useSetAccountActive();
	const [confirm, setConfirm] = useState(false);
	return (
		<>
			<Button variant="bordered" color={account.active ? "danger" : "primary"} onClick={() => setConfirm(true)} disabled={setActive.isPending}>
				{account.active ? "Desactivar cuenta" : "Activar cuenta"}
			</Button>
			{setActive.isError && <span className="text-sm text-err">{errorCopy(setActive.error).title}</span>}
			<ResponsiveDialog
				open={confirm}
				onClose={() => setConfirm(false)}
				title={account.active ? `¿Desactivar ${account.alias}?` : `¿Activar ${account.alias}?`}
				footer={
					<>
						<Button variant="bordered" onClick={() => setConfirm(false)}>
							Cancelar
						</Button>
						<Button
							color={account.active ? "danger" : "primary"}
							isLoading={setActive.isPending}
							disabled={setActive.isPending}
							onClick={() => setActive.mutate({ accountId: account.id, active: !account.active }, { onSettled: () => setConfirm(false) })}
						>
							{account.active ? "Desactivar" : "Activar"}
						</Button>
					</>
				}
			>
				<p className="text-sm text-ink-2">
					{account.active
						? "Se detiene su programador. El inventario se conserva y sigue visible para los roles que la incluyen."
						: "La cuenta vuelve a estar disponible. El programador queda desactivado hasta que lo configure."}
				</p>
			</ResponsiveDialog>
		</>
	);
};
