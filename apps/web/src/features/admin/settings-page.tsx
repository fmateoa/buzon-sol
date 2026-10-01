import { Formik, useFormikContext } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import { SETTING_KEYS, type AppSetting, type SettingKey, type SettingValues } from "@/domain/types";
import { BlockSkeleton, PageHeader, Section } from "@/components/custom/layout-bits";
import { FocusFirstError, TextField } from "@/components/custom/form-field";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { errorCopy } from "@/lib/errors";
import { useSaveSettings, useSettings } from "./queries";

/** Formik toma los puntos de un nombre como rutas anidadas; los campos usan el nombre sin puntos. */
const fieldName = (key: SettingKey) => key.replace(".", "_");
type Values = Record<string, string>;

const FIELDS: Record<SettingKey, { label: string; section: "session" | "security"; hint: (n: number | null) => string }> = {
	"session.absoluteMinutes": {
		label: "Duración máxima de la sesión (minutos)",
		section: "session",
		hint: (n) => `${duration(n)}Tiempo desde que la persona ingresa, aunque siga activa. Aplica a los ingresos nuevos.`,
	},
	"session.idleMinutes": {
		label: "Cierre por inactividad (minutos)",
		section: "session",
		hint: (n) => `${duration(n)}Se cierra la sesión si no hay actividad (teclado o clic) durante este tiempo. Aplica de inmediato, también a quienes ya están dentro.`,
	},
	"security.passwordMinLength": {
		label: "Largo mínimo de la contraseña (caracteres)",
		section: "security",
		hint: () => "Se exige al crear usuarios nuevos. Las contraseñas existentes no cambian.",
	},
	"security.maxFailedLogins": {
		label: "Intentos fallidos antes de bloquear",
		section: "security",
		hint: () => "Intentos seguidos con contraseña incorrecta. Un ingreso correcto reinicia la cuenta.",
	},
	"security.lockoutMinutes": {
		label: "Duración del bloqueo (minutos)",
		section: "security",
		hint: (n) => `${duration(n)}Durante el bloqueo no se puede ingresar, ni con la contraseña correcta.`,
	},
};

/** «= 12 h · » para valores en minutos que cuesta leer de golpe. */
const duration = (minutes: number | null): string => {
	if (minutes === null || minutes < 60) return "";
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor((minutes % 1440) / 60);
	const rest = minutes % 60;
	const parts = [days && `${days} d`, hours && `${hours} h`, rest && `${rest} min`].filter(Boolean);
	return `Equivale a ${parts.join(" ")}. `;
};

const toInitial = (settings: AppSetting[]): Values => Object.fromEntries(settings.map((s) => [fieldName(s.key), String(s.value)]));

const buildSchema = (settings: AppSetting[]) => {
	const shape = Object.fromEntries(
		settings.map((s) => [
			fieldName(s.key),
			Yup.number()
				.typeError("Ingrese un número entero.")
				.integer("Ingrese un número entero.")
				.required("Ingrese un valor.")
				.min(s.min, `Use ${s.min} o más.`)
				.max(s.max, `Use ${s.max} o menos.`),
		]),
	);
	return Yup.object(shape).test("idle-within-absolute", "", function (values) {
		const idle = Number(values[fieldName("session.idleMinutes")]);
		const absolute = Number(values[fieldName("session.absoluteMinutes")]);
		if (!Number.isFinite(idle) || !Number.isFinite(absolute) || idle <= absolute) return true;
		return this.createError({ path: fieldName("session.idleMinutes"), message: "No puede superar la duración máxima de la sesión." });
	});
};

const Fields = ({ settings, section }: { settings: AppSetting[]; section: "session" | "security" }) => {
	const { values } = useFormikContext<Values>();
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{settings
				.filter((s) => FIELDS[s.key].section === section)
				.map((s) => {
					const value = values[fieldName(s.key)] ?? "";
					const parsed = Number(value);
					return (
						<TextField
							key={s.key}
							name={fieldName(s.key)}
							label={FIELDS[s.key].label}
							inputMode="numeric"
							maxLength={6}
							hint={`${FIELDS[s.key].hint(value.trim() !== "" && Number.isInteger(parsed) ? parsed : null)} Rango: ${s.min} a ${s.max}.`}
						/>
					);
				})}
		</div>
	);
};

const ResetDefaults = ({ settings }: { settings: AppSetting[] }) => {
	const { setValues, values } = useFormikContext<Values>();
	const isDefault = settings.every((s) => values[fieldName(s.key)] === String(s.default));
	return (
		<Button type="button" variant="bordered" className="min-h-11" disabled={isDefault} onClick={() => void setValues(Object.fromEntries(settings.map((s) => [fieldName(s.key), String(s.default)])))}>
			Restablecer valores por defecto
		</Button>
	);
};

/** Configuraciones globales: duración de sesión y seguridad de acceso. Cada cambio queda en auditoría. */
export const SettingsPage = () => {
	const settings = useSettings();
	const save = useSaveSettings();

	if (settings.isPending) return <BlockSkeleton lines={6} label="Cargando configuraciones" />;
	if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;
	const data = SETTING_KEYS.flatMap((key) => settings.data.filter((s) => s.key === key));

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Configuraciones" description="Reglas globales de la aplicación. Los cambios quedan en auditoría." />
			<Formik<Values>
				enableReinitialize
				initialValues={toInitial(data)}
				validationSchema={buildSchema(data)}
				onSubmit={async (values, helpers) => {
					const numbers = Object.fromEntries(SETTING_KEYS.map((key) => [key, Number(values[fieldName(key)])])) as SettingValues;
					const changed = Object.fromEntries(data.filter((s) => numbers[s.key] !== s.value).map((s) => [s.key, numbers[s.key]]));
					if (!Object.keys(changed).length) return;
					try {
						await save.mutateAsync(changed);
					} finally {
						helpers.setSubmitting(false);
					}
				}}
			>
				{({ handleSubmit, dirty, isSubmitting }) => (
					<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
						<FocusFirstError />
						<Section title="Sesión">
							<Fields settings={data} section="session" />
						</Section>
						<Section title="Seguridad de acceso">
							<Fields settings={data} section="security" />
						</Section>
						{save.isError && (
							<Notice tone="error" role="alert" title={errorCopy(save.error).title}>
								{errorCopy(save.error).body}
							</Notice>
						)}
						{save.isSuccess && !dirty && <Notice tone="success">Configuraciones guardadas.</Notice>}
						<div className="flex flex-wrap justify-end gap-3">
							<ResetDefaults settings={data} />
							<Button type="submit" color="primary" className="min-h-11" disabled={!dirty || isSubmitting} isLoading={isSubmitting}>
								Guardar cambios
							</Button>
						</div>
					</form>
				)}
			</Formik>
		</div>
	);
};
