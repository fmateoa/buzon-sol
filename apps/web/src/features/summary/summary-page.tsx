import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "lizaui/button";
import type { BoxSummary, MailBox, MailItemMetadata } from "@/domain/types";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import { BlockSkeleton, EmptyState, PageHeader, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { boxLabel, NoContentBadge, RemoteEffectBadge, RemoteStateDot } from "@/components/custom/status";
import { coverageExplanation, VerifiedCount } from "@/components/custom/verified-count";
import { useAccountId, useActiveAccount } from "@/features/accounts/account-guard";
import { useStartInventory, useSummary } from "@/features/accounts/queries";
import { BulkReadDialog } from "@/features/mailbox/bulk-read-dialog";
import { CredentialPausedNotice, InventoryNotice } from "@/features/mailbox/inventory-notice";
import { useCan } from "@/features/session/use-session";
import { errorCopy } from "@/lib/errors";
import { formatCount, formatRelative, formatTime } from "@/lib/format";
import { INVENTORY_LOGIN_NOTE } from "@/lib/sunat-gates";

const boxPath = (box: MailBox) => (box === "messages" ? "mensajes" : "notificaciones");

const BoxCard = ({ summary, accountId }: { summary: BoxSummary; accountId: string }) => (
	<Section
		title={boxLabel(summary.box)}
		actions={
			<Link to={`/c/${accountId}/${boxPath(summary.box)}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-brand">
				Ver bandeja →
			</Link>
		}
	>
		<div className="flex flex-wrap items-end gap-x-8 gap-y-3">
			<VerifiedCount coverage={summary.coverage} />
			<div>
				<p className="mono text-3xl font-medium text-brand">
					<span aria-hidden="true">● </span>
					{formatCount(summary.unreadInSunat)}
				</p>
				<p className="text-xs text-muted-ink">no leídos en SUNAT</p>
			</div>
		</div>
		<p className="mt-3 text-sm text-muted-ink">{coverageExplanation(summary.coverage)}</p>
	</Section>
);

/** Todos los no leídos de la cuenta, para «Leer contenido…» (solo metadatos). */
const useUnreadItems = (accountId: ReturnType<typeof useAccountId>, enabled: boolean) => {
	const adapter = useAdapter();
	return useQuery({
		queryKey: [...qk.mailBase(accountId), "unread-all"],
		enabled,
		queryFn: async () => {
			const request = { filters: { query: "", state: "unread" as const, folder: null, tag: null, dateFrom: null, dateTo: null, review: "all" as const }, sort: null, page: 1, pageSize: 500 };
			const [m, n] = await Promise.all([adapter.listMail(accountId, "messages", request), adapter.listMail(accountId, "notifications", request)]);
			return [...m.rows, ...n.rows] as MailItemMetadata[];
		},
	});
};

/** D4 · Resumen del buzón. Inventariar y leer: dos verbos, dos lugares, dos aspectos. */
export const SummaryPage = () => {
	const accountId = useAccountId();
	const account = useActiveAccount();
	const summary = useSummary(accountId);
	const canRun = useCan("run_inventory");
	const canRead = useCan("read_content");
	const start = useStartInventory(accountId);
	const [bulkOpen, setBulkOpen] = useState(false);
	const unread = useUnreadItems(accountId, bulkOpen);

	const data = summary.data;
	const unreadTotal = data ? data.boxes.messages.unreadInSunat + data.boxes.notifications.unreadInSunat : 0;
	const remoteBlocked = account.connection.pauseReason === "invalid_credential" || account.connection.pauseReason === "needs_credential" || !account.active;
	const running = Boolean(data?.connection.running);
	const noInventory = data && data.boxes.messages.coverage.state === null && data.boxes.notifications.coverage.state === null;
	const bulkItems = useMemo(() => unread.data ?? [], [unread.data]);

	const lastRun = data?.connection.lastRunAt ? `${formatRelative(data.connection.lastRunAt)}, ${data.connection.lastRunState === "complete" ? "completa" : data.connection.lastRunState === "partial" ? "parcial" : data.connection.lastRunState === "paused" ? "en pausa" : "en curso"}` : "sin consultas";

	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title="Resumen del buzón"
				description={
					<>
						{account.alias} · <span className="mono">RUC {account.rucMasked}</span> (ficticio) · Última consulta: {lastRun}
						{data && <span className="block">{data.scheduleText}{data.connection.nextRunAt ? ` · próxima ${formatTime(data.connection.nextRunAt)}` : ""}</span>}
					</>
				}
			/>

			<CredentialPausedNotice account={account} />

			{summary.isPending && <BlockSkeleton lines={5} label="Cargando resumen" />}
			{summary.isError && <QueryError error={summary.error} onRetry={() => void summary.refetch()} />}

			{data && (
				<>
					<div className="grid gap-4 md:grid-cols-2">
						<Section className="flex flex-col">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h2 className="text-base font-semibold text-ink">Actualizar inventario</h2>
								<NoContentBadge />
							</div>
							<p className="mt-2 text-sm text-ink-2">Obtiene asunto, fecha, remitente, etiqueta y estado. No abre ningún contenido.</p>
							{INVENTORY_LOGIN_NOTE && <p className="mt-1 text-xs text-effect-ink">! {INVENTORY_LOGIN_NOTE}</p>}
							<div className="mt-4 flex flex-wrap items-center gap-3">
								<Button color="primary" onClick={() => start.mutate()} isLoading={start.isPending || running} disabled={!canRun || remoteBlocked || running || start.isPending} className="min-h-11">
									{running ? "Actualizando…" : "Actualizar inventario"}
								</Button>
								{!canRun && <span className="text-xs text-muted-ink">Su rol no permite consultar ahora.</span>}
								{canRun && remoteBlocked && <span className="text-xs text-muted-ink">No disponible mientras la consulta esté en pausa.</span>}
							</div>
							{start.isError && (
								<Notice tone="error" role="alert" className="mt-3" title={errorCopy(start.error).title}>
									{errorCopy(start.error).body}
								</Notice>
							)}
						</Section>

						<Section className="flex flex-col border-effect">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h2 className="text-base font-semibold text-ink">Leer contenido</h2>
								<RemoteEffectBadge />
							</div>
							<p className="mt-2 text-sm text-ink-2">
								Abre {unreadTotal === 1 ? "el no leído" : `los ${formatCount(unreadTotal)} no leídos`} uno por uno. SUNAT puede registrar cada uno como leído.
							</p>
							<div className="mt-4 flex flex-wrap items-center gap-3">
								<Button color="warning" variant="bordered" onClick={() => setBulkOpen(true)} disabled={!canRead || remoteBlocked || unreadTotal === 0} className="min-h-11">
									Leer contenido…
								</Button>
								{!canRead && <span className="text-xs text-muted-ink">Su rol no permite leer contenido.</span>}
								{canRead && unreadTotal === 0 && <span className="text-xs text-muted-ink">No hay no leídos.</span>}
							</div>
						</Section>
					</div>

					{noInventory ? (
						<Section>
							<EmptyState title="Aún no hay inventario de esta cuenta">
								{account.connection.pauseReason === "needs_credential"
									? "La cuenta no tiene credencial. Un administrador debe agregar la Clave SOL; luego podrá actualizar el inventario."
									: "La primera consulta programada lo obtendrá. También puede actualizar el inventario ahora; el barrido no abre contenido."}
							</EmptyState>
						</Section>
					) : (
						<>
							<InventoryNotice account={account} box="messages" coverage={data.boxes.messages.coverage} />
							<InventoryNotice account={account} box="notifications" coverage={data.boxes.notifications.coverage} />
							<div className="grid gap-4 md:grid-cols-2">
								<BoxCard summary={data.boxes.messages} accountId={accountId} />
								<BoxCard summary={data.boxes.notifications} accountId={accountId} />
							</div>
						</>
					)}

					{data.newItems.length > 0 && (
						<Section title="Nuevos desde su última visita" actions={<span className="text-xs text-muted-ink">detectados por la consulta de {data.connection.lastRunAt ? formatTime(data.connection.lastRunAt) : "—"}</span>}>
							<ul className="divide-y divide-line">
								{data.newItems.map((item) => (
									<li key={item.id}>
										<Link to={`/c/${accountId}/${boxPath(item.box)}/${item.id}`} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
											<span className="w-28 shrink-0 text-xs text-muted-ink">{item.box === "messages" ? "Mensaje" : "Notificación"}</span>
											<RemoteStateDot state={item.remoteState} />
											<span className="min-w-0 flex-1 truncate font-medium text-ink">{item.subject}</span>
											<span className="mono text-xs text-muted-ink">{item.publishedAtText.split(" ")[0]}</span>
										</Link>
									</li>
								))}
							</ul>
						</Section>
					)}

					{data.pending.length > 0 && (
						<Section title={`Pendientes · ${data.pending.length}`}>
							<ul className="flex flex-col gap-2">
								{data.pending.map((p) => (
									<li key={p.id}>
										<Notice
											tone={p.kind === "failed_downloads" ? "error" : "info"}
											role="note"
											action={
												<Link to={p.kind === "failed_downloads" ? `/c/${accountId}/actividad` : `/c/${accountId}/mensajes?revision=pendiente`} className="text-sm font-semibold text-brand underline">
													{p.kind === "failed_downloads" ? "Ver actividad" : "Ver pendientes de revisión"}
												</Link>
											}
										>
											{p.text}
										</Notice>
									</li>
								))}
							</ul>
						</Section>
					)}
				</>
			)}

			<BulkReadDialog accountId={accountId} open={bulkOpen && !unread.isPending} onClose={() => setBulkOpen(false)} items={bulkItems} />
		</div>
	);
};
