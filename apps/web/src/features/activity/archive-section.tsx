import { Button } from "lizaui/button";
import type { AccountId, ArchiveRun } from "@/domain/types";
import { BlockSkeleton, Section } from "@/components/custom/layout-bits";
import { Notice } from "@/components/custom/notice";
import { QueryError } from "@/components/custom/query-error";
import { useArchiveStatus, useStartArchive } from "@/features/accounts/queries";
import { useCan } from "@/features/session/use-session";
import { errorCopy } from "@/lib/errors";
import { formatCount, formatRelative } from "@/lib/format";

const Stat = ({ value, label }: { value: string; label: string }) => (
	<div>
		<dd className="mono text-xl font-medium text-ink">{value}</dd>
		<dt className="text-xs text-muted-ink">{label}</dt>
	</div>
);

const STOP_REASON: Record<string, string> = {
	paused: "el archivo o la cuenta se desactivó",
	conflict_running: "había otra operación en curso en la cuenta",
	remote_session_expired: "la sesión de SUNAT venció",
	remote_unavailable: "SUNAT no respondió",
	invalid_credential: "SUNAT rechazó la credencial",
	storage_unavailable: "el almacenamiento no estuvo disponible",
	schema_changed: "SUNAT respondió de forma inesperada",
};

const runText = (run: ArchiveRun) => {
	if (run.state === "pending") return "Lote en cola.";
	if (run.state === "running") return `Lote en curso · ${formatCount(run.itemsDone)} elementos guardados hasta ahora.`;
	const when = run.finishedAt ? formatRelative(run.finishedAt) : "";
	const counts = `${formatCount(run.itemsDone)} elementos y ${formatCount(run.filesStored)} archivos guardados`;
	if (run.state === "complete") return `Último lote ${when}: ${counts}.`;
	return `Último lote ${when} se detuvo (${STOP_REASON[run.errorCode ?? ""] ?? "error inesperado"}): ${counts}.`;
};

/** Avance del archivo de la cuenta. Solo cantidades; ver el contenido sigue siendo por la bandeja. */
export const ArchiveSection = ({ accountId, blocked }: { accountId: AccountId; blocked: boolean }) => {
	const status = useArchiveStatus(accountId);
	const start = useStartArchive(accountId);
	const canRun = useCan("run_inventory");
	const canRead = useCan("read_content");
	const canStart = canRun && canRead;

	if (status.isPending) return <BlockSkeleton lines={3} label="Cargando archivo" />;
	if (status.isError) return <QueryError error={status.error} onRetry={() => void status.refetch()} />;

	const { settings, items, files, current } = status.data;
	const busy = current?.state === "pending" || current?.state === "running";
	const failed = files.failed > 0 || (current?.itemsFailed ?? 0) > 0;
	const disabled = blocked || busy || start.isPending || !settings.archiveContent;

	return (
		<Section
			title="Archivo del buzón"
			actions={
				canStart && (
					<div className="flex flex-wrap gap-2">
						{failed && (
							<Button size="sm" variant="bordered" onClick={() => start.mutate(true)} disabled={disabled} className="min-h-9 bg-paper">
								Reintentar fallidos
							</Button>
						)}
						<Button size="sm" variant="bordered" onClick={() => start.mutate(false)} disabled={disabled || items.pendingContent === 0} isLoading={start.isPending} className="min-h-9 bg-paper">
							Archivar ahora
						</Button>
					</div>
				)
			}
		>
			<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Stat value={`${formatCount(items.withContent)}/${formatCount(items.readInSunat)}`} label="leídos en SUNAT con contenido guardado" />
				<Stat value={formatCount(items.pendingContent)} label="leídos por archivar" />
				<Stat value={formatCount(files.stored)} label="archivos guardados" />
				<Stat value={formatCount(files.failed)} label={files.failed === 1 ? "archivo con error" : "archivos con error"} />
			</dl>
			<p className="mt-3 text-sm text-muted-ink" aria-live="polite">
				{settings.archiveContent ? `Activo${settings.archiveFiles ? ", con archivos" : ", sin archivos"} · lotes de ${formatCount(settings.archiveBatchSize)}. ` : "El archivo de esta cuenta está desactivado; un administrador puede activarlo en Cuentas SUNAT → Archivo. "}
				{current && runText(current)}
			</p>
			{items.unreadInSunat > 0 && (
				<p className="mt-1 text-sm text-muted-ink">
					{formatCount(items.unreadInSunat)} {items.unreadInSunat === 1 ? "elemento no leído no se archiva" : "elementos no leídos no se archivan"}: abrirlos los marcaría como leídos en SUNAT.
				</p>
			)}
			{start.isError && (
				<Notice tone="error" role="alert" title={errorCopy(start.error).title} className="mt-3">
					{errorCopy(start.error).body}
				</Notice>
			)}
		</Section>
	);
};
