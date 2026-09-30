import { Link } from "react-router";
import { Button } from "lizaui/button";
import { ProgressBar } from "lizaui/progress-bar";
import type { BoxRunProgress, InventoryRun, SyncState } from "@/domain/types";
import { BlockSkeleton, PageHeader, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { boxLabel } from "@/components/custom/status";
import { useAccountId, useActiveAccount } from "@/features/accounts/account-guard";
import { useActivity, useResumeRun, useStartInventory } from "@/features/accounts/queries";
import { CredentialPausedNotice } from "@/features/mailbox/inventory-notice";
import { useCan } from "@/features/session/use-session";
import { cn } from "@/lib/cn";
import { errorCopy } from "@/lib/errors";
import { formatCount, formatRelative, formatTime } from "@/lib/format";
import { INVENTORY_LOGIN_NOTE } from "@/lib/sunat-gates";

const STATE_VIEW: Record<SyncState, { icon: string; label: string; className: string }> = {
	pending: { icon: "○", label: "Pendiente", className: "text-muted-ink bg-surface" },
	running: { icon: "↻", label: "En curso", className: "text-brand bg-brand-soft" },
	complete: { icon: "✓", label: "Completa", className: "text-ok bg-ok-soft" },
	partial: { icon: "◐", label: "Parcial", className: "text-brand bg-brand-soft" },
	retrying: { icon: "↻", label: "Reintentando", className: "text-brand bg-brand-soft" },
	paused: { icon: "!", label: "En pausa", className: "text-effect-ink bg-effect-soft" },
};

const StateTag = ({ state, extra }: { state: SyncState; extra?: string }) => {
	const v = STATE_VIEW[state];
	return (
		<span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap", v.className)}>
			<span aria-hidden="true" className={cn("mono", v.icon === "↻" && "inline-block motion-safe:animate-spin")}>
				{v.icon}
			</span>
			{v.label}
			{extra && ` · ${extra}`}
		</span>
	);
};

const Stat = ({ value, label }: { value: string; label: string }) => (
	<div>
		<dd className="mono text-xl font-medium text-ink">{value}</dd>
		<dt className="text-xs text-muted-ink">{label}</dt>
	</div>
);

const BoxProgressCard = ({ p, pauseReason }: { p: BoxRunProgress; pauseReason: string | null }) => {
	const pages = p.estimatedPages ? `${formatCount(p.pagesScanned)}/${formatCount(p.estimatedPages)}` : formatCount(p.pagesScanned);
	return (
		<Section title={boxLabel(p.box)} actions={<StateTag state={p.state} extra={p.state === "paused" && pauseReason === "invalid_credential" ? "credencial rechazada" : undefined} />}>
			<ProgressBar value={p.pagesScanned} maxValue={Math.max(p.estimatedPages ?? p.pagesScanned, 1)} aria-label={`Páginas revisadas de ${boxLabel(p.box)}`} color={p.state === "paused" ? "warning" : p.state === "complete" ? "success" : "primary"} size="sm">
				<ProgressBar.Track>
					<ProgressBar.Fill />
				</ProgressBar.Track>
			</ProgressBar>
			<dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
				<Stat value={pages} label="páginas revisadas" />
				<Stat value={formatCount(p.found)} label="encontrados" />
				<Stat value={formatCount(p.unique)} label="únicos" />
				<Stat value={formatCount(p.attachmentsStored)} label="adjuntos descargados" />
				<Stat value={formatCount(p.errors)} label={p.errors === 1 ? "error" : "errores"} />
			</dl>
			<p className="mt-3 text-sm text-muted-ink" aria-live="polite">
				{p.duplicatesSkipped > 0 && `${formatCount(p.duplicatesSkipped)} duplicados omitidos. `}
				{p.errorText && `Error: ${p.errorText} `}
				{p.state === "complete" && p.declaredMatches === true && "Total verificado coincide con el declarado por SUNAT."}
				{p.state === "complete" && p.declaredMatches === false && "El total verificado difiere del declarado por SUNAT; se muestra el verificado."}
				{p.state === "running" && "El recorrido continúa hasta una página vacía confirmada."}
			</p>
		</Section>
	);
};

const runStateText = (run: InventoryRun) => {
	if (run.state === "paused" && run.pauseReason === "invalid_credential") return "credencial";
	if (run.pauseReason === "remote_unavailable") return "SUNAT no respondió";
	return undefined;
};

/** D8 / M4 · Actividad de la cuenta. */
export const ActivityPage = () => {
	const accountId = useAccountId();
	const account = useActiveAccount();
	const activity = useActivity(accountId);
	const canRun = useCan("run_inventory");
	const canSchedule = useCan("configure_schedule");
	const resume = useResumeRun(accountId);
	const start = useStartInventory(accountId);
	const data = activity.data;
	const credentialPaused = account.connection.pauseReason === "invalid_credential";
	const resumable = data?.history.find((r) => r.resumeFrom);
	const running = Boolean(data?.currentRun);

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title={`Actividad · ${account.alias}`}
				description={data?.connection.lastRunAt ? `Última consulta: ${formatRelative(data.connection.lastRunAt)}${data.connection.nextRunAt ? ` · próxima: ${formatTime(data.connection.nextRunAt)}` : ""}` : "Aún no hay consultas"}
				actions={
					(canRun || canSchedule) && (
						<>
							{canSchedule && (
								<Link to={`/c/${accountId}/programador`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-4 text-sm font-medium text-ink">
									Programador
								</Link>
							)}
							{canRun && resumable?.resumeFrom && (
								<Button color="primary" onClick={() => resume.mutate(resumable.id)} disabled={credentialPaused || running || resume.isPending} isLoading={resume.isPending} className="min-h-11">
									Reanudar desde pág. {resumable.resumeFrom.page}
								</Button>
							)}
							{canRun && <Button variant="bordered" onClick={() => start.mutate()} disabled={credentialPaused || running || start.isPending || account.connection.pauseReason === "needs_credential"} isLoading={start.isPending} className="min-h-11 bg-white">
								Consultar ahora
							</Button>}
						</>
					)
				}
			/>
			<CredentialPausedNotice account={account} />
			{credentialPaused && resumable && <p className="text-sm text-muted-ink">El avance está guardado. Se podrá reanudar desde la página {resumable.resumeFrom?.page} cuando un administrador reemplace la credencial y la prueba sea satisfactoria.</p>}
			{(resume.isError || start.isError) && (
				<Notice tone="error" role="alert" title={errorCopy(resume.error ?? start.error).title}>
					{errorCopy(resume.error ?? start.error).body}
				</Notice>
			)}
			{INVENTORY_LOGIN_NOTE && <Notice tone="effect" role="note">{INVENTORY_LOGIN_NOTE}</Notice>}

			{activity.isPending && <BlockSkeleton lines={6} label="Cargando actividad" />}
			{activity.isError && <QueryError error={activity.error} onRetry={() => void activity.refetch()} />}

			{data && (
				<>
					<div className="grid gap-4 lg:grid-cols-2">
						{data.progress.map((p) => (
							<BoxProgressCard key={p.box} p={p} pauseReason={data.connection.pauseReason} />
						))}
					</div>

					<Notice tone="info" role="note">
						<strong>Leído en SUNAT</strong>: estado que informa SUNAT; cambia al abrir el contenido. <strong>Revisado en buzon-sol</strong>: marca interna suya; no se envía a SUNAT.
					</Notice>

					<Section title="Historial">
						{data.history.length === 0 ? (
							<p className="text-sm text-muted-ink">Aún no hay consultas registradas para esta cuenta.</p>
						) : (
							<ul className="divide-y divide-line">
								{data.history.map((run) => (
									<li key={run.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
										<span className="mono w-44 shrink-0 text-xs text-muted-ink">
											{formatRelative(run.startedAt)}
											{run.finishedAt && run.finishedAt !== run.startedAt ? ` – ${formatTime(run.finishedAt)}` : ""}
										</span>
										<span className="w-48 shrink-0 text-sm text-ink-2">
											{run.boxes.map(boxLabel).join(" + ")}
											<span className="block text-xs text-muted-ink">{run.mode === "manual" ? "Manual" : run.mode === "test" ? "Prueba de conexión" : "Programada"}</span>
										</span>
										<span className="min-w-0 flex-1 text-sm text-ink">
											{run.resultText}
											{run.autoOpenedFirstItem && <span className="block text-xs text-effect-ink">! SUNAT abrió automáticamente el primer elemento al ingresar.</span>}
										</span>
										<StateTag state={run.state} extra={runStateText(run)} />
										{run.resumeFrom && canRun && (
											<Button size="sm" variant="bordered" onClick={() => resume.mutate(run.id)} disabled={credentialPaused || running} className="min-h-9 bg-white">
												Reanudar desde pág. {run.resumeFrom.page}
											</Button>
										)}
									</li>
								))}
							</ul>
						)}
					</Section>
				</>
			)}
		</div>
	);
};
