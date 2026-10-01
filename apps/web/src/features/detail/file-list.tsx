import { Button } from "lizaui/button";
import { ProgressBar } from "lizaui/progress-bar";
import type { FileId, MailFile } from "@/domain/types";
import { cn } from "@/lib/cn";
import { fileTypeLabel, formatBytes } from "@/lib/format";

const FileRow = ({ file, canDownload, blockedReason, onDownload }: { file: MailFile; canDownload: boolean; blockedReason: string | null; onDownload: (id: FileId) => void }) => {
	const type = fileTypeLabel(file.mimeType);
	const s = file.state;
	return (
		<li className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<span className={cn("mono flex h-8 min-w-10 items-center justify-center rounded border px-1 text-[11px] font-medium", type === "Archivo" ? "border-dashed border-line-strong text-muted-ink" : "border-line text-ink-3")} aria-hidden="true">
					{type === "Archivo" ? "?" : type}
				</span>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-ink">{file.name}</p>
					<p className="text-xs text-muted-ink">
						{type === "Archivo" ? "Tipo no identificado" : type} · {formatBytes(file.sizeBytes)}
						{s.status === "stored" && <span className="text-ok"> · ✓ Guardado en el espacio de la cuenta</span>}
						{s.status === "failed" && (
							<span className="text-err" role="alert">
								{" "}
								· × {s.reason === "forbidden" ? "Abra el contenido antes de descargar" : "No se pudo descargar el archivo"}
							</span>
						)}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2 sm:w-48 sm:justify-end">
				{s.status === "downloading" && (
					<div className="flex w-full items-center gap-2" aria-live="polite">
						<ProgressBar value={s.progress} aria-label={`Descargando ${file.name}`} color="primary" size="sm" className="flex-1">
							<ProgressBar.Track>
								<ProgressBar.Fill />
							</ProgressBar.Track>
						</ProgressBar>
						<span className="mono text-xs text-muted-ink">{s.progress} %</span>
					</div>
				)}
				{s.status === "stored" && canDownload && (
					<Button size="sm" variant="bordered" onClick={() => onDownload(file.id)} aria-label={`Guardar una copia de ${file.name} en este equipo`} className="min-h-10">
						Guardar copia
					</Button>
				)}
				{(s.status === "available" || s.status === "failed") && canDownload && (
					<Button size="sm" variant="bordered" disabled={Boolean(blockedReason)} onClick={() => onDownload(file.id)} aria-label={`${s.status === "failed" ? "Reintentar descarga de" : "Descargar"} ${file.name}`} className="min-h-10">
						{s.status === "failed" ? "Reintentar" : "Descargar"}
					</Button>
				)}
			</div>
		</li>
	);
};

export const FileList = ({
	files,
	canDownload,
	blockedReason,
	onDownload,
}: {
	files: MailFile[];
	canDownload: boolean;
	blockedReason: string | null;
	onDownload: (id: FileId) => void;
}) => {
	const documents = files.filter((f) => f.kind === "generated_document");
	const attachments = files.filter((f) => f.kind === "attachment");
	const group = (title: string, list: MailFile[]) =>
		list.length > 0 && (
			<section aria-label={title}>
				<h3 className="text-sm font-semibold text-ink">
					{title} · {list.length}
				</h3>
				<ul className="mt-1">
					{list.map((f) => (
						<FileRow key={f.id} file={f} canDownload={canDownload} blockedReason={blockedReason} onDownload={onDownload} />
					))}
				</ul>
			</section>
		);
	return (
		<div className="flex flex-col gap-4">
			{files.length === 0 && <p className="text-sm text-muted-ink">Este elemento no tiene documentos ni adjuntos.</p>}
			{group("Documentos generados", documents)}
			{group("Archivos adjuntos", attachments)}
			{!canDownload && files.length > 0 && <p className="text-xs text-muted-ink">Su rol no permite descargar archivos.</p>}
			{canDownload && blockedReason && <p className="text-xs text-effect-ink">{blockedReason}</p>}
		</div>
	);
};
