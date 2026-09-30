import { useEffect, useId, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Button } from "lizaui/button";
import { Checkbox } from "lizaui/checkbox";
import { ArrowLeft, Star } from "lucide-react";
import type { ItemId, MailBox, MailItemMetadata, VisibleAccount } from "@/domain/types";
import { BlockSkeleton, Meta, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { boxLabel, RemoteEffectBadge, RemoteStatePill, ReviewTag, TagChip } from "@/components/custom/status";
import { useAccountId, useActiveAccount } from "@/features/accounts/account-guard";
import { useItemMetadata, useReadContent, useRemoteStatePolling, useSetReviewed, useDownloads } from "@/features/mailbox/queries";
import { useAppSession, useCan, useSetReadWarning } from "@/features/session/use-session";
import { useIsMobile } from "@/hooks/use-media-query";
import { errorCopy } from "@/lib/errors";
import { FileList } from "./file-list";
import { RemoteBody } from "./remote-body";

const boxPath = (box: MailBox) => (box === "messages" ? "mensajes" : "notificaciones");
const noun = (box: MailBox) => (box === "messages" ? "Este mensaje" : "Esta notificación");

/** La cuenta no tiene sesión SUNAT válida: abrir contenido nuevo y descargar no están disponibles. */
const remoteBlockedReason = (account: VisibleAccount): string | null => {
	if (!account.active) return "La cuenta está desactivada: abrir contenido nuevo y descargar no están disponibles.";
	if (account.connection.pauseReason === "invalid_credential") return "Consulta en pausa: SUNAT rechazó la credencial de esta cuenta y se avisó a los administradores. Abrir contenido y descargar no están disponibles.";
	if (account.connection.pauseReason === "needs_credential") return "Esta cuenta no tiene credencial: abrir contenido y descargar no están disponibles.";
	return null;
};

/** Contenido de la confirmación de lectura (panel en escritorio, hoja inferior en móvil). Sin hooks. */
const readConfirmation = ({
	checkId,
	item,
	dontShowAgain,
	onDontShowAgain,
	onOpen,
	onBack,
	pending,
	inline,
}: {
	checkId: string;
	item: MailItemMetadata;
	dontShowAgain: boolean;
	onDontShowAgain: (value: boolean) => void;
	onOpen: () => void;
	onBack: () => void;
	pending: boolean;
	inline: boolean;
}) => {
	const body = (
		<div className="flex flex-col gap-3 text-sm text-ink-2">
			<p>
				{noun(item.box)} figura como no leído en SUNAT. Al abrirlo, <strong className="text-effect-ink">SUNAT puede marcarlo como leído</strong>. buzon-sol no puede revertir ese cambio.
			</p>
			<p className="text-muted-ink">Solo se pregunta una vez por elemento.</p>
			<div className="flex items-start gap-2">
				<Checkbox id={checkId} checked={dontShowAgain} onChange={(e) => onDontShowAgain(e.target.checked)} color="warning" aria-describedby={`${checkId}-help`} />
				<label htmlFor={checkId} className="cursor-pointer">
					<span className="font-medium text-ink">No volver a mostrar este aviso</span>
					<span id={`${checkId}-help`} className="block text-xs text-muted-ink">
						Aplica solo a su usuario. Puede reactivarlo en Perfil. Queda registrado en auditoría.
					</span>
				</label>
			</div>
		</div>
	);
	const actions = (
		<>
			<Button variant="bordered" onClick={onBack} disabled={pending} className="min-h-11">
				Volver sin abrir
			</Button>
			<Button color="warning" onClick={onOpen} isLoading={pending} disabled={pending} className="min-h-11">
				Abrir contenido
			</Button>
		</>
	);
	if (!inline) return { body, actions };
	return {
		body: (
			<div role="group" aria-labelledby="confirm-title" className="rounded-lg border-2 border-effect bg-effect-softer p-4">
				<h3 id="confirm-title" className="mb-2 text-base font-semibold text-ink">
					¿Abrir el contenido?
				</h3>
				{body}
				<div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
			</div>
		),
		actions: null,
	};
};

export const DetailPage = ({ box }: { box: MailBox }) => {
	const accountId = useAccountId();
	const itemId = useParams().itemId as ItemId;
	const account = useActiveAccount();
	const session = useAppSession();
	const canRead = useCan("read_content");
	const canDownload = useCan("download_file");
	const canReview = useCan("mark_reviewed");
	const isMobile = useIsMobile();
	const navigate = useNavigate();
	const headingRef = useRef<HTMLHeadingElement>(null);
	const checkId = useId();

	const metadata = useItemMetadata(accountId, itemId);
	const read = useReadContent(accountId, itemId);
	const setReadWarning = useSetReadWarning();
	const review = useSetReviewed(accountId, itemId);
	const downloads = useDownloads(accountId, itemId);
	const [dontShowAgain, setDontShowAgain] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	const item = metadata.data;
	const remoteState = item?.remoteState;
	const polling = useRemoteStatePolling(accountId, itemId, read.isSuccess && (remoteState === "confirming" || remoteState === "unconfirmed"));

	useEffect(() => {
		headingRef.current?.focus();
	}, [itemId]);

	const listPath = `/c/${accountId}/${boxPath(box)}`;
	const back = () => navigate(listPath);

	if (metadata.isPending) return <BlockSkeleton lines={6} label="Cargando metadatos" />;
	if (metadata.isError || !item) {
		return (
			<div className="flex flex-col gap-4">
				<Link to={listPath} className="text-sm text-brand underline">
					← {boxLabel(box)}
				</Link>
				<QueryError error={metadata.error} onRetry={() => void metadata.refetch()} />
			</div>
		);
	}
	if (item.box !== box) {
		// Ruta con bandeja equivocada: se corrige sin pedir nada a SUNAT.
		return <Navigate to={`/c/${accountId}/${boxPath(item.box)}/${item.id}`} replace />;
	}

	const detail = read.data;
	const blocked = item.contentStored ? null : remoteBlockedReason(account);
	const isUnread = item.remoteState === "unread";
	const needsConfirmation = isUnread && session.preferences.readWarningEnabled && !item.openedBeforeByUser;

	const openContent = async () => {
		if (dontShowAgain) await setReadWarning.mutateAsync(false).catch(() => undefined);
		read.mutate(undefined, { onSettled: () => setSheetOpen(false) });
	};

	const requestOpen = () => {
		if (needsConfirmation) setSheetOpen(true);
		else read.mutate();
	};

	const confirmation = readConfirmation({ checkId, item, dontShowAgain, onDontShowAgain: setDontShowAgain, onOpen: () => void openContent(), onBack: back, pending: read.isPending, inline: !isMobile });

	const files = detail?.files.map((f) => ({ ...f, state: downloads.states[f.id] ?? f.state })) ?? [];

	return (
		<article className="flex flex-col gap-5" aria-labelledby="item-subject">
			<Link to={listPath} className="inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-medium text-brand">
				<ArrowLeft className="size-4" aria-hidden="true" />
				{boxLabel(box)}
			</Link>

			<header className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-sm bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{box === "messages" ? "Mensaje" : "Notificación"}</span>
					{item.urgent && <span className="rounded-sm border border-err bg-err-soft px-2 py-0.5 text-xs font-semibold text-err">! URGENTE</span>}
					{item.starred && (
						<span className="inline-flex items-center gap-1 text-xs text-ink-3">
							<Star className="size-3.5 fill-current text-effect" aria-hidden="true" /> Destacado en SUNAT
						</span>
					)}
					<RemoteStatePill state={item.remoteState} />
				</div>
				<h1 id="item-subject" ref={headingRef} tabIndex={-1} className="text-xl font-bold tracking-tight text-ink outline-none md:text-2xl">
					{item.subject}
				</h1>
				<dl className="flex flex-wrap gap-x-6 gap-y-2">
					<Meta label="Remitente">{item.sender}</Meta>
					<Meta label="Publicado (según SUNAT)" mono>
						{item.publishedAtText}
					</Meta>
					<Meta label="Etiqueta">
						<TagChip tag={item.tag} />
					</Meta>
					<Meta label="Adjuntos declarados">{item.attachmentCountDeclared}</Meta>
				</dl>
			</header>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
				<div className="flex flex-col gap-5">
					<Section title="Contenido" headingId="content-title">
						{detail ? (
							<RemoteBody html={detail.bodyHtml} />
						) : (
							<div className="flex flex-col gap-4">
								<div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-line-strong bg-surface px-4 text-center text-sm text-muted-ink">
									El contenido se mostrará después de confirmar.
								</div>
								{read.isError && (
									<Notice tone="error" role="alert" title={errorCopy(read.error).title}>
										{errorCopy(read.error).body}
									</Notice>
								)}
								{!canRead ? (
									<Notice tone="info" role="note">
										Su rol permite ver los metadatos, pero no el contenido ni los archivos.
									</Notice>
								) : blocked ? (
									<Notice tone="effect" action={<Link to={`/c/${accountId}/actividad`} className="text-sm font-semibold text-brand underline">Ver actividad</Link>}>
										{blocked}
									</Notice>
								) : needsConfirmation && !isMobile ? (
									confirmation.body
								) : (
									<div className="flex flex-wrap items-center gap-3">
										<Button color={isUnread ? "warning" : "primary"} variant={isUnread ? "bordered" : "solid"} onClick={requestOpen} isLoading={read.isPending} disabled={read.isPending} className="min-h-11">
											{item.contentStored ? "Ver contenido guardado" : isUnread ? "Abrir contenido…" : "Abrir contenido"}
										</Button>
										{isUnread && <RemoteEffectBadge />}
										{!isUnread && !item.contentStored && <span className="text-xs text-muted-ink">Ya figura como leído en SUNAT.</span>}
									</div>
								)}
							</div>
						)}
					</Section>

					<Section title="Documentos y adjuntos" headingId="files-title">
						{detail ? (
							<FileList files={files} canDownload={canDownload} blockedReason={blocked} onDownload={(id) => void downloads.download(id)} />
						) : (
							<p className="text-sm text-muted-ink">
								SUNAT declara {item.attachmentCountDeclared} {item.attachmentCountDeclared === 1 ? "adjunto" : "adjuntos"}. Los documentos y adjuntos se muestran después de abrir el contenido.
							</p>
						)}
					</Section>
				</div>

				<aside aria-label="Estado del elemento" className="flex flex-col gap-4">
					<Section title="Estado">
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<p className="text-xs font-semibold tracking-wide text-subtle-ink uppercase">En SUNAT</p>
								<RemoteStatePill state={item.remoteState} className="w-fit" />
								<p className="text-xs text-muted-ink" aria-live="polite">
									{item.remoteState === "confirming" && "Puede tardar unos segundos. Se actualizará solo."}
									{item.remoteState === "unconfirmed" && "El contenido se abrió, pero el estado sigue sin actualizarse. Se comprobará en la próxima consulta."}
									{item.remoteState === "read" && "Estado que informa SUNAT. No existe «marcar como no leído»."}
									{item.remoteState === "unread" && "Cambia al abrir el contenido."}
								</p>
								{item.remoteState === "unconfirmed" && (
									<Button size="sm" variant="bordered" className="w-fit" onClick={() => void polling.refetch()} isLoading={polling.isFetching}>
										Comprobar ahora
									</Button>
								)}
							</div>
							<div className="flex flex-col gap-1.5 border-t border-line pt-4">
								<p className="text-xs font-semibold tracking-wide text-subtle-ink uppercase">En buzon-sol</p>
								<ReviewTag reviewed={item.review.reviewed} className="w-fit" />
								<p className="text-xs text-muted-ink">Marca interna suya. No se envía a SUNAT.</p>
								{canReview && (
									<Button size="sm" variant="bordered" className="min-h-10 w-fit" onClick={() => review.mutate(!item.review.reviewed)} isLoading={review.isPending} disabled={review.isPending}>
										{item.review.reviewed ? "Quitar marca de revisado" : "Marcar como revisado"}
									</Button>
								)}
								{review.isError && <p className="text-xs text-err">{errorCopy(review.error).title}</p>}
							</div>
						</div>
					</Section>
				</aside>
			</div>

			{isMobile && (
				<ResponsiveDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="¿Abrir el contenido?" dismissDisabled={read.isPending} footer={confirmation.actions}>
					{confirmation.body}
				</ResponsiveDialog>
			)}
		</article>
	);
};
