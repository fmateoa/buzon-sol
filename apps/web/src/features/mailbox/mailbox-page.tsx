import { useEffect } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router";
import { Button } from "lizaui/button";
import { Table } from "lizaui/table";
import { Paperclip, Star } from "lucide-react";
import type { MailBox, MailItemMetadata, MailListFilters, MailSortColumn, MailPage } from "@/domain/types";
import { ListTable, type ColumnDef } from "@/components/custom/list-table";
import { EmptyState } from "@/components/custom/layout-bits";
import { QueryError } from "@/components/custom/query-error";
import { RemoteStateDot, TagChip } from "@/components/custom/status";
import { useAccountId, useActiveAccount } from "@/features/accounts/account-guard";
import { useFolders, useSummary, useTags } from "@/features/accounts/queries";
import { useIsMobile } from "@/hooks/use-media-query";
import { useListState } from "@/hooks/use-list-state";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { CredentialPausedNotice, InventoryNotice } from "./inventory-notice";
import { DesktopFilters, EMPTY_MAIL_FILTERS, MobileFilters, type MailListState } from "./mail-filters";
import { useMailList } from "./queries";

/** Columnas definidas fuera del componente; mismo orden en encabezado y filas. */
export const MAIL_COLUMNS: ColumnDef[] = [
	{ id: "remoteState", header: "Estado", sort: true, size: 112, lockVisible: true },
	{ id: "starred", header: "★", size: 52, information: "Destacado en SUNAT" },
	{ id: "sender", header: "Remitente", sort: true, size: 170 },
	{ id: "subject", header: "Asunto · etiqueta", sort: true, lockVisible: true, minWidth: 280 },
	{ id: "attachments", header: "Adj.", size: 60, information: "Cantidad declarada por SUNAT; puede diferir de los archivos reales." },
	{ id: "publishedAt", header: "Fecha", sort: true, size: 108 },
];

const boxPath = (box: MailBox) => (box === "messages" ? "mensajes" : "notificaciones");
const nouns = (box: MailBox): [string, string] => (box === "messages" ? ["mensaje", "mensajes"] : ["notificación", "notificaciones"]);

const BoxTabs = ({ box }: { box: MailBox }) => {
	const accountId = useAccountId();
	const summary = useSummary(accountId);
	const tab = (b: MailBox, label: string) => {
		const unread = summary.data?.boxes[b].unreadInSunat;
		return (
			<NavLink
				to={`/c/${accountId}/${boxPath(b)}`}
				className={cn("flex min-h-11 items-center gap-2 border-b-2 px-1 text-base", b === box ? "border-brand font-semibold text-ink" : "border-transparent text-muted-ink hover:text-ink")}
				aria-current={b === box ? "page" : undefined}
			>
				{label}
				{unread ? (
					<span className="mono text-xs text-brand">
						● {formatCount(unread)}
						<span className="sr-only"> no leídos</span>
					</span>
				) : null}
			</NavLink>
		);
	};
	return (
		<nav aria-label="Bandejas" className="flex gap-6 border-b border-line">
			{tab("messages", "Mensajes")}
			{tab("notifications", "Notificaciones")}
		</nav>
	);
};

const ResultSummary = ({ page, box }: { page: MailPage; box: MailBox }) => {
	const { coverage, total } = page;
	const [one, many] = nouns(box);
	const from = total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
	const to = Math.min(total, page.page * page.pageSize);
	const differs = coverage.declaredBySunat !== null && coverage.declaredBySunat !== coverage.uniqueCount;
	return (
		<div className="flex flex-col gap-1 text-sm text-muted-ink md:flex-row md:justify-between" aria-live="polite">
			<p>
				<strong className="font-semibold text-ink">{formatCount(total)}</strong> {total === 1 ? one : many}
				{coverage.verified ? "" : " en lo inventariado hasta ahora"}
				{total > 0 && ` · Mostrando ${formatCount(from)}–${formatCount(to)}`}
			</p>
			<p className="mono text-xs md:text-sm">
				{coverage.verified ? `Total verificado: ${formatCount(coverage.uniqueCount)}` : `Registrados hasta ahora: ${formatCount(coverage.uniqueCount)}`}
				{differs && ` · SUNAT declara ${formatCount(coverage.declaredBySunat!)}`}
			</p>
		</div>
	);
};

const dateOnly = (text: string) => text.split(" ")[0] ?? text;

const MobileList = ({ page, state, box, empty }: { page: MailPage | undefined; state: MailListState; box: MailBox; empty: React.ReactNode }) => {
	const accountId = useAccountId();
	const rows = page?.rows ?? [];
	const lastPage = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
	if (page && rows.length === 0) return <div className="rounded-lg border border-line bg-paper">{empty}</div>;
	return (
		<div className="flex flex-col gap-3">
			<ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper" aria-label={box === "messages" ? "Mensajes" : "Notificaciones"}>
				{rows.map((m) => (
					<li key={m.id} className="bg-paper">
						<Link to={`/c/${accountId}/${boxPath(box)}/${m.id}`} className="flex min-h-16 flex-col gap-1 px-4 py-3">
							<span className="flex items-start gap-2">
								<span aria-hidden="true" className={cn("mt-0.5 text-xs", m.remoteState === "unread" ? "text-brand" : "text-foreground-400")}>
									{m.remoteState === "unread" ? "●" : "○"}
								</span>
								<span className={cn("flex-1 text-[15px] leading-snug text-ink", m.remoteState === "unread" && "font-semibold")}>
									<span className="sr-only">{m.remoteState === "unread" ? "No leído en SUNAT. " : "Leído en SUNAT. "}</span>
									{m.subject}
								</span>
								<span className="mono shrink-0 text-xs text-muted-ink">{dateOnly(m.publishedAtText)}</span>
							</span>
							<span className="flex flex-wrap items-center gap-2 pl-4">
								{m.urgent && <span className="text-xs font-semibold text-err">! URGENTE</span>}
								<TagChip tag={m.tag} />
								{m.attachmentCountDeclared > 0 && (
									<span className="inline-flex items-center gap-1 text-xs text-muted-ink">
										<Paperclip className="size-3" aria-hidden="true" />
										{m.attachmentCountDeclared}
										<span className="sr-only"> adjuntos</span>
									</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
			{page && page.total > page.pageSize && (
				<nav aria-label="Paginación" className="flex items-center justify-between text-sm">
					<Button variant="bordered" disabled={state.page <= 1} onClick={() => state.setPage(state.page - 1, state.pageSize)} className="min-h-11">
						‹ Anterior
					</Button>
					<span className="text-muted-ink">
						Pág. {state.page} de {lastPage}
					</span>
					<Button variant="bordered" disabled={state.page >= lastPage} onClick={() => state.setPage(state.page + 1, state.pageSize)} className="min-h-11">
						Siguiente ›
					</Button>
				</nav>
			)}
		</div>
	);
};

/** D5 / M1 · Bandeja de Mensajes o Notificaciones sobre lo inventariado. */
export const MailboxPage = ({ box }: { box: MailBox }) => {
	const accountId = useAccountId();
	const account = useActiveAccount();
	const isMobile = useIsMobile();
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();

	const state = useListState<MailListFilters, MailSortColumn>({ persistKey: "bandeja-v1", initialFilters: EMPTY_MAIL_FILTERS, textKeys: ["query"], initialPageSize: 20 });
	const list = useMailList(accountId, box, state.request);
	const folders = useFolders(accountId, box);
	const tags = useTags(accountId);
	const summary = useSummary(accountId);

	// Carpetas y etiquetas del panel lateral llegan como parámetros y se aplican como filtros.
	const folderParam = params.get("carpeta");
	const tagParam = params.get("etiqueta");
	const reviewParam = params.get("revision");
	const { setFilter } = state;
	useEffect(() => {
		if (folderParam === null && tagParam === null && reviewParam === null) return;
		if (folderParam !== null) setFilter("folder", folderParam);
		if (tagParam !== null) setFilter("tag", tagParam);
		if (reviewParam === "pendiente") setFilter("review", "pending");
		setParams({}, { replace: true });
	}, [folderParam, tagParam, reviewParam, setFilter, setParams]);

	const page = list.data;
	const coverage = page?.coverage;
	const [one, many] = nouns(box);
	const empty =
		coverage?.state === null ? (
			<EmptyState title="Aún no hay inventario de esta cuenta">
				{account.connection.pauseReason === "needs_credential"
					? "La cuenta no tiene credencial. Un administrador debe agregar la Clave SOL para consultar SUNAT."
					: "La primera consulta programada lo obtendrá. También puede actualizar el inventario desde el Resumen."}
			</EmptyState>
		) : state.isFiltered ? (
			<EmptyState
				title={`No hay ${many} con estos filtros`}
				action={
					<Button variant="bordered" onClick={state.resetFilters}>
						Quitar filtros
					</Button>
				}
			>
				Pruebe con otro rango de fechas o quite «Solo no leídos».
			</EmptyState>
		) : (
			<EmptyState title={`No hay ${many} en esta bandeja`}>El inventario guardado no tiene elementos.</EmptyState>
		);

	const open = (item: MailItemMetadata) => navigate(`/c/${accountId}/${boxPath(box)}/${item.id}`);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="sr-only">{box === "messages" ? "Mensajes" : "Notificaciones"}</h1>
			<BoxTabs box={box} />
			<CredentialPausedNotice account={account} />
			{coverage && <InventoryNotice account={account} box={box} coverage={coverage} />}

			{isMobile ? (
				<MobileFilters state={state} folders={folders.data} tags={tags.data} box={box} unreadCount={summary.data?.boxes[box].unreadInSunat} />
			) : (
				<DesktopFilters state={state} folders={folders.data} tags={tags.data} box={box} columns={MAIL_COLUMNS} onRefresh={() => void list.refetch()} refreshing={list.isFetching} />
			)}

			{page && <ResultSummary page={page} box={box} />}

			{isMobile ? (
				<>
					{list.isError && <QueryError error={list.error} onRetry={() => void list.refetch()} />}
					{list.isPending ? <p role="status" className="py-6 text-center text-sm text-muted-ink">Cargando {many}…</p> : <MobileList page={page} state={state} box={box} empty={empty} />}
				</>
			) : (
				<ListTable<MailItemMetadata>
					label={box === "messages" ? "Mensajes inventariados" : "Notificaciones inventariadas"}
					columns={MAIL_COLUMNS}
					state={state}
					page={page}
					isLoading={list.isPending}
					isFetching={list.isFetching}
					error={list.error}
					onRetry={() => void list.refetch()}
					rowKey={(m) => m.id}
					rowName={(m) => m.subject}
					emptyContent={empty}
					actionLabel="Detalle"
					actionWidth={80}
					countNoun={[one, many]}
						hideSummary
					renderCells={(m) => (
						<>
							<Table.BodyColumn>
								<RemoteStateDot state={m.remoteState} />
							</Table.BodyColumn>
							<Table.BodyColumn className="text-center">
								{m.starred ? (
									<>
										<Star className="mx-auto size-4 fill-current text-effect" aria-hidden="true" />
										<span className="sr-only">Destacado en SUNAT</span>
									</>
								) : (
									<span className="sr-only">No destacado</span>
								)}
							</Table.BodyColumn>
							<Table.BodyColumn className="text-ink-2">
								<span className="line-clamp-1">{m.sender}</span>
							</Table.BodyColumn>
							<Table.BodyColumn>
								<div className="flex min-w-0 flex-col gap-1 py-1">
									<span className={cn("line-clamp-2 text-sm text-ink", m.remoteState === "unread" && "font-semibold")}>
										{m.urgent && <span className="mr-1.5 rounded-sm border border-err bg-err-soft px-1 text-[11px] font-semibold text-err">! URGENTE</span>}
										{m.subject}
									</span>
									<TagChip tag={m.tag} className="w-fit" />
								</div>
							</Table.BodyColumn>
							<Table.BodyColumn className="mono text-xs text-muted-ink">
								{m.attachmentCountDeclared > 0 ? (
									<span>
										ADJ {m.attachmentCountDeclared}
										<span className="sr-only"> adjuntos declarados</span>
									</span>
								) : (
									<span aria-label="Sin adjuntos">—</span>
								)}
							</Table.BodyColumn>
							<Table.BodyColumn className="mono text-xs text-ink-2">{dateOnly(m.publishedAtText)}</Table.BodyColumn>
							<Table.BodyColumn>
								<Button size="sm" variant="bordered" onClick={() => open(m)} className="min-h-9 bg-paper">
									Ver<span className="sr-only"> detalle de «{m.subject}»</span>
								</Button>
							</Table.BodyColumn>
						</>
					)}
				/>
			)}
		</div>
	);
};
