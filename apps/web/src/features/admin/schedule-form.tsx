import { useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { Form, Formik, useFormikContext, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import { Checkbox } from "lizaui/checkbox";
import type { AccountId, MailBox, ScheduleConfig, ScheduleFrequency, ScheduleState, Weekday } from "@/domain/types";
import { computeNextRuns } from "@/lib/schedule";
import { FocusFirstError, GroupError } from "@/components/custom/form-field";
import { BlockSkeleton, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { Segmented } from "@/components/custom/segmented";
import { NoContentBadge } from "@/components/custom/status";
import { useActivity, useStartInventory } from "@/features/accounts/queries";
import { useCan } from "@/features/session/use-session";
import { cn } from "@/lib/cn";
import { errorCopy, isAppError } from "@/lib/errors";
import { formatRelative, formatTime } from "@/lib/format";
import { SUNAT_GATES } from "@/lib/sunat-gates";
import { useSaveSchedule, useSchedule } from "./queries";

type Values = Omit<ScheduleConfig, "nextRuns" | "pauseReason">;
type StartMutation = ReturnType<typeof useStartInventory>;

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
	{ value: "30m", label: "30 min" },
	{ value: "1h", label: "Cada 1 h" },
	{ value: "2h", label: "2 h" },
	{ value: "4h", label: "4 h" },
	{ value: "daily", label: "1 vez al día" },
];
const DAYS: { value: Weekday; short: string; long: string }[] = [
	{ value: "mon", short: "L", long: "lunes" },
	{ value: "tue", short: "M", long: "martes" },
	{ value: "wed", short: "X", long: "miércoles" },
	{ value: "thu", short: "J", long: "jueves" },
	{ value: "fri", short: "V", long: "viernes" },
	{ value: "sat", short: "S", long: "sábado" },
	{ value: "sun", short: "D", long: "domingo" },
];
const STATES: { value: ScheduleState; label: string }[] = [
	{ value: "active", label: "Activo" },
	{ value: "paused", label: "Pausado" },
	{ value: "disabled", label: "Desactivado" },
];

export const scheduleSchema = Yup.object({
	windowStart: Yup.string().required("Indique la hora de inicio."),
	windowEnd: Yup.string()
		.required("Indique la hora de fin.")
		.test("after-start", "La hora de fin debe ser posterior a la de inicio.", function (value) {
			return !value || !this.parent.windowStart || value > this.parent.windowStart;
		}),
	days: Yup.array().min(1, "Elija al menos un día."),
	boxes: Yup.array().min(1, "Elija al menos una bandeja."),
	remoteEffectAccepted: Yup.boolean().test("accepted", "Para activar la programación debe aceptar el posible efecto del inicio de sesión.", function (value) {
		return SUNAT_GATES.passiveLogin || this.parent.state !== "active" || value === true;
	}),
});

const ColumnLabel = ({ children }: { children: string }) => <p className="text-xs font-semibold tracking-[0.08em] text-muted-ink uppercase">{children}</p>;

const NextRunsPreview = () => {
	const { values } = useFormikContext<Values>();
	const runs = useMemo(() => (values.windowStart < values.windowEnd ? computeNextRuns(values, new Date()) : []), [values]);
	return (
		<div className="flex flex-col gap-2">
			<ColumnLabel>Próximas consultas</ColumnLabel>
			{runs.length === 0 ? (
				<p className="text-sm text-muted-ink">{values.state === "active" ? "Sin disparos con esta configuración." : "El programador no está activo."}</p>
			) : (
				<ul className="mono flex flex-wrap gap-2 text-[13px] text-ink-2">
					{runs.map((r) => (
						<li key={r} className="rounded-sm border border-line bg-paper px-2 py-1">
							{formatRelative(r)}
						</li>
					))}
				</ul>
			)}
			<p className="text-xs text-muted-ink">Hora de Lima (America/Lima).</p>
		</div>
	);
};

const RecentRuns = ({ accountId }: { accountId: AccountId }) => {
	const activity = useActivity(accountId);
	const runs = activity.data?.history.slice(0, 5) ?? [];
	return (
		<div className="flex flex-col gap-2">
			<ColumnLabel>Últimas consultas</ColumnLabel>
			{runs.length === 0 ? (
				<p className="text-sm text-muted-ink">Aún no hay consultas.</p>
			) : (
				<ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-paper">
					{runs.map((r) => (
						<li key={r.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 px-3.5 py-2.5 text-[13px]">
							<span className="mono text-muted-ink">{formatRelative(r.startedAt)}</span>
							<span className="text-ink-2">{r.resultText}</span>
							<span className={cn("font-semibold whitespace-nowrap", r.state === "complete" ? "text-ok" : r.state === "paused" ? "text-effect-ink" : "text-brand")}>
								{r.autoOpenedFirstItem ? "! Con aviso" : r.state === "complete" ? "✓ Completa" : r.state === "paused" ? "! En pausa" : r.state === "running" ? "↻ En curso" : "◐ Parcial"}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

/** «Consultar ahora» y «Guardar»: en la cabecera de la página si hay hueco (`actionsSlot`), si no al pie. */
const ScheduleActions = ({ start, canRunNow }: { start: StartMutation; canRunNow: boolean }) => {
	const { isSubmitting, submitForm } = useFormikContext<Values>();
	return (
		<>
			{canRunNow && (
				<Button variant="bordered" onClick={() => start.mutate()} isLoading={start.isPending} disabled={start.isPending} className="min-h-10 bg-paper">
					Consultar ahora
				</Button>
			)}
			{/* Fuera del <form> (portal): se envía con `submitForm`, que también valida. */}
			<Button color="primary" onClick={() => void submitForm()} isLoading={isSubmitting} disabled={isSubmitting} className="min-h-10">
				Guardar
			</Button>
		</>
	);
};

/** Resultado de «Consultar ahora» (la mutación es la misma que usa el botón de la cabecera). */
const StartFeedback = ({ start }: { start: StartMutation }) => {
	if (start.isError)
		return (
			<Notice tone="error" role="alert" title={errorCopy(start.error).title}>
				{errorCopy(start.error).body}
			</Notice>
		);
	return start.isSuccess ? <Notice tone="success">Consulta solicitada. Puede seguir el avance en la actividad de la cuenta.</Notice> : null;
};

const ScheduleFields = () => {
	const { values, setFieldValue, errors, submitCount, status } = useFormikContext<Values>();
	const ids = { days: useId(), boxes: useId(), accept: useId(), window: useId(), dl: useId(), inApp: useId(), mail: useId() };
	const show = submitCount > 0;
	const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

	return (
		<div className="flex flex-col gap-6">
			<FocusFirstError />
			{status && (
				<Notice tone="error" role="alert" title={status.title}>
					{status.body}
				</Notice>
			)}
			<Segmented legend="Estado del programador" name="state" options={STATES} value={values.state} onChange={(v) => void setFieldValue("state", v)} />
			<Segmented legend="Frecuencia" name="frequency" options={FREQUENCIES} value={values.frequency} onChange={(v) => void setFieldValue("frequency", v)} />

			<fieldset aria-describedby={errors.days && show ? ids.days : undefined} data-field="days">
				<legend className="mb-1.5 text-sm font-semibold text-ink">Días y horario</legend>
				<div className="flex flex-wrap items-end gap-x-4 gap-y-3">
					<div className="flex gap-1.5" role="group" aria-label="Días">
						{DAYS.map((d) => {
							const on = values.days.includes(d.value);
							return (
								<button
									key={d.value}
									type="button"
									aria-pressed={on}
									aria-label={d.long}
									onClick={() => void setFieldValue("days", toggle(values.days, d.value))}
									className={cn("h-10 w-10 rounded-md text-sm font-semibold", on ? "bg-brand-fill text-white" : "border-[1.5px] border-input bg-paper text-ink-2")}
								>
									{d.short}
								</button>
							);
						})}
					</div>
					<div className="flex items-end gap-2" aria-describedby={errors.windowEnd && show ? ids.window : undefined}>
						<label className="flex flex-col text-xs text-muted-ink">
							Desde
							<input type="time" name="windowStart" value={values.windowStart} onChange={(e) => void setFieldValue("windowStart", e.target.value)} className="h-10 rounded-md border-[1.5px] border-input bg-paper px-2 text-sm text-ink" />
						</label>
						<span className="pb-2.5 text-muted-ink">–</span>
						<label className="flex flex-col text-xs text-muted-ink">
							Hasta
							<input type="time" name="windowEnd" value={values.windowEnd} onChange={(e) => void setFieldValue("windowEnd", e.target.value)} aria-invalid={Boolean(errors.windowEnd && show)} className="h-10 rounded-md border-[1.5px] border-input bg-paper px-2 text-sm text-ink" />
						</label>
						<span className="pb-2.5 text-[13px] text-muted-ink">hora de Lima</span>
					</div>
				</div>
				<GroupError id={ids.days} message={show ? (errors.days as string | undefined) : undefined} />
				<GroupError id={ids.window} message={show ? errors.windowEnd : undefined} />
			</fieldset>

			<fieldset aria-describedby={errors.boxes && show ? ids.boxes : undefined} data-field="boxes">
				<legend className="mb-1.5 text-sm font-semibold text-ink">Bandejas</legend>
				<div className="flex flex-wrap items-start gap-x-5 gap-y-2">
					{(["messages", "notifications"] as MailBox[]).map((b) => {
						const id = `${ids.boxes}-${b}`;
						return (
							<div key={b} className="flex items-center gap-2">
								<Checkbox id={id} checked={values.boxes.includes(b)} onChange={() => void setFieldValue("boxes", toggle(values.boxes, b))} />
								<label htmlFor={id} className="text-sm text-ink">
									{b === "messages" ? "Mensajes" : "Notificaciones"}
								</label>
							</div>
						);
					})}
					<div className="flex items-start gap-2">
						<Checkbox id={ids.dl} checked={values.downloadReadAttachments} onChange={(e) => void setFieldValue("downloadReadAttachments", e.target.checked)} />
						<label htmlFor={ids.dl} className="text-sm text-ink">
							Descargar adjuntos de elementos ya leídos
							<span className="block text-xs text-muted-ink">Solo si el detalle ya está guardado en buzon-sol. Nunca abre un no leído (P-03).</span>
						</label>
					</div>
				</div>
				<GroupError id={ids.boxes} message={show ? (errors.boxes as string | undefined) : undefined} />
			</fieldset>

			<fieldset>
				<legend className="mb-1.5 text-sm font-semibold text-ink">Avisar de novedades</legend>
				<div className="flex flex-wrap items-start gap-x-5 gap-y-2">
					<div className="flex items-center gap-2">
						<Checkbox id={ids.inApp} checked={values.notifyInApp} onChange={(e) => void setFieldValue("notifyInApp", e.target.checked)} />
						<label htmlFor={ids.inApp} className="text-sm text-ink">
							En la app, a usuarios con acceso a la cuenta
						</label>
					</div>
					<div className="flex items-start gap-2">
						<Checkbox id={ids.mail} checked={false} disabled aria-describedby={`${ids.mail}-hint`} />
						<label htmlFor={ids.mail} className="text-sm text-muted-ink">
							Correo resumen diario
							<span id={`${ids.mail}-hint`} className="block text-xs">
								Pendiente: proveedor, destinatarios y frecuencia (P-02).
							</span>
						</label>
					</div>
				</div>
			</fieldset>

			{/* Diseño A3: las tres notas en un solo recuadro. La «!» del inicio de sesión va en la aceptación de abajo. */}
			<div className="flex flex-col gap-2.5 rounded-lg border border-line px-4 py-3.5 text-sm text-ink-2" role="note">
				<p className="flex flex-wrap items-start gap-2.5">
					<NoContentBadge /> <span className="min-w-0 flex-1">El programador solo actualiza el inventario. Nunca abre el contenido de un no leído.</span>
				</p>
				<p className="flex gap-2.5">
					<span aria-hidden="true" className="mono font-bold">
						i
					</span>
					Si SUNAT rechaza la credencial o hay 3 fallos seguidos, el programador se pausa y avisa a los administradores.
				</p>
			</div>
			{!SUNAT_GATES.passiveLogin && (
				<div className={cn("rounded-lg border-2 p-4", errors.remoteEffectAccepted && show ? "border-err bg-err-soft" : "border-effect bg-effect-softer")} data-field="remoteEffectAccepted">
					<div className="flex items-start gap-2">
						<Checkbox
							id={ids.accept}
							name="remoteEffectAccepted"
							checked={values.remoteEffectAccepted}
							onChange={(e) => void setFieldValue("remoteEffectAccepted", e.target.checked)}
							color="warning"
							aria-describedby={errors.remoteEffectAccepted && show ? `${ids.accept}-error` : undefined}
						/>
						<label htmlFor={ids.accept} className="text-sm text-ink">
							<strong className="text-effect-ink">! Acepto el posible efecto del inicio de sesión.</strong> Al iniciar sesión, SUNAT podría abrir automáticamente el primer elemento y marcarlo como leído. Cada ocurrencia se registra en la actividad de la cuenta. La consulta programada no pide confirmación en cada ejecución.
						</label>
					</div>
					<GroupError id={`${ids.accept}-error`} message={show ? errors.remoteEffectAccepted : undefined} />
				</div>
			)}
		</div>
	);
};

interface ScheduleEditorProps {
	accountId: AccountId;
	/** Nodo de la cabecera donde van «Consultar ahora» y «Guardar» (diseño A3). Sin él, van al pie del formulario. */
	actionsSlot?: HTMLElement | null;
}

/** A3 · Programador de consultas de una cuenta: formulario a la izquierda; próximas y últimas consultas a la derecha. */
export const ScheduleEditor = ({ accountId, actionsSlot }: ScheduleEditorProps) => {
	const schedule = useSchedule(accountId);
	const save = useSaveSchedule();
	const canRunNow = useCan("run_inventory");
	const start = useStartInventory(accountId);

	if (schedule.isPending) return <BlockSkeleton lines={6} label="Cargando programador" />;
	if (schedule.isError) return <QueryError error={schedule.error} onRetry={() => void schedule.refetch()} />;
	const { nextRuns: _n, pauseReason, ...initial } = schedule.data;

	const submit = async (values: Values, helpers: FormikHelpers<Values>) => {
		helpers.setStatus(undefined);
		try {
			await save.mutateAsync(values);
			helpers.resetForm({ values });
		} catch (error) {
			if (isAppError(error, "validation") && error.fields) helpers.setErrors(error.fields as never);
			else helpers.setStatus(errorCopy(error));
		}
	};

	return (
		<Formik<Values> initialValues={initial} validationSchema={scheduleSchema} onSubmit={submit} enableReinitialize>
			<Form noValidate className="flex flex-col gap-5">
				{actionsSlot && createPortal(<ScheduleActions start={start} canRunNow={canRunNow} />, actionsSlot)}
				{pauseReason && (
					<Notice tone="effect" title="Programador en pausa">
						{pauseReason === "invalid_credential"
							? "SUNAT rechazó la credencial. Reemplace la Clave SOL y pruebe la conexión antes de activarlo."
							: pauseReason === "needs_credential"
								? "La cuenta no tiene credencial. Agréguela antes de activar el programador."
								: pauseReason === "repeated_failures"
									? "Se pausó tras 3 fallos seguidos."
									: "Pausado manualmente."}
					</Notice>
				)}
				{save.isSuccess && <Notice tone="success">Programación guardada. El cambio queda en auditoría.</Notice>}
				<StartFeedback start={start} />
				<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7">
					<Section>
						<ScheduleFields />
						{!actionsSlot && (
							<div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
								<ScheduleActions start={start} canRunNow={canRunNow} />
							</div>
						)}
					</Section>
					<aside className="flex flex-col gap-5" aria-label="Consultas de la cuenta">
						<NextRunsPreview />
						<RecentRuns accountId={accountId} />
						{schedule.data.nextRuns[0] && <p className="text-xs text-muted-ink">Próxima consulta guardada: {formatTime(schedule.data.nextRuns[0])}.</p>}
					</aside>
				</div>
			</Form>
		</Formik>
	);
};
