import { Button } from "lizaui/button";
import { ProgressBar } from "lizaui/progress-bar";
import type { AccountId, MailItemMetadata } from "@/domain/types";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { Notice } from "@/components/custom/notice";
import { formatCount } from "@/lib/format";
import { useBulkRead } from "./queries";

interface BulkReadDialogProps {
	accountId: AccountId;
	open: boolean;
	onClose: () => void;
	items: Pick<MailItemMetadata, "id" | "subject">[];
	onFinished?: () => void;
}

/** «¿Leer el contenido de N no leídos?»: se abren uno por uno y se puede detener. */
export const BulkReadDialog = ({ accountId, open, onClose, items, onFinished }: BulkReadDialogProps) => {
	const { progress, run, stop, reset } = useBulkRead(accountId);
	const running = progress !== null && !progress.finished;
	const n = items.length;

	const close = () => {
		if (running) return;
		reset();
		if (progress?.finished) onFinished?.();
		onClose();
	};

	const footer = !progress ? (
		<>
			<Button variant="bordered" onClick={close}>
				Cancelar
			</Button>
			<Button color="warning" onClick={() => void run(items)} disabled={n === 0}>
				Leer {formatCount(n)} {n === 1 ? "elemento" : "elementos"}
			</Button>
		</>
	) : running ? (
		<Button variant="bordered" color="danger" onClick={stop}>
			Detener
		</Button>
	) : (
		<Button color="primary" onClick={close}>
			Cerrar
		</Button>
	);

	return (
		<ResponsiveDialog open={open} onClose={close} dismissDisabled={running} title={`¿Leer el contenido de ${formatCount(n)} no ${n === 1 ? "leído" : "leídos"}?`} footer={footer} size="lg">
			{!progress && (
				<div className="flex flex-col gap-3 text-sm text-ink-2">
					<p>
						Se abrirán uno por uno. <strong className="text-effect-ink">SUNAT puede marcar cada uno como leído</strong> y buzon-sol no puede revertir ese cambio. Puede detener el proceso en cualquier momento.
					</p>
					<ul className="list-inside list-disc text-muted-ink">
						{items.slice(0, 5).map((item) => (
							<li key={item.id} className="truncate">
								{item.subject}
							</li>
						))}
						{n > 5 && <li>y {formatCount(n - 5)} más</li>}
					</ul>
				</div>
			)}
			{progress && (
				<div className="flex flex-col gap-3" aria-live="polite">
					<ProgressBar value={progress.done + progress.failed} maxValue={Math.max(progress.total, 1)} aria-label="Avance de la lectura" color="warning" size="md">
						<ProgressBar.Track>
							<ProgressBar.Fill />
						</ProgressBar.Track>
					</ProgressBar>
					{running ? (
						<p className="text-sm text-ink-2">
							Leyendo {formatCount(progress.done + progress.failed + 1)} de {formatCount(progress.total)}
							{progress.current ? `: ${progress.current}` : "…"}
						</p>
					) : (
						<Notice tone={progress.failed > 0 ? "effect" : "success"} title={progress.stopped ? "Proceso detenido" : "Lectura terminada"}>
							Se abrieron {formatCount(progress.done)} de {formatCount(progress.total)}.
							{progress.failed > 0 && ` ${formatCount(progress.failed)} no se pudieron abrir; puede intentarlo desde cada elemento.`} El estado en SUNAT se confirmará en unos segundos.
						</Notice>
					)}
				</div>
			)}
		</ResponsiveDialog>
	);
};
