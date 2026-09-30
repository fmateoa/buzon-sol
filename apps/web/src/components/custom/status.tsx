import type { ConnectionStatus, MailBox, RemoteReadState, SunatTag } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatRelative, formatTime } from "@/lib/format";
import { INVENTORY_EFFECT_LABEL } from "@/lib/sunat-gates";

/*
 * Todo estado combina color, símbolo y texto (diseño §6). Forma distinta por eje:
 * píldora redonda para el estado en SUNAT y etiqueta rectangular para la marca interna.
 */

const REMOTE: Record<RemoteReadState, { icon: string; long: string; short: string; className: string }> = {
	unread: { icon: "●", long: "No leído en SUNAT", short: "No leído", className: "text-brand bg-brand-soft border-brand-line" },
	confirming: { icon: "↻", long: "Confirmando lectura con SUNAT…", short: "Confirmando…", className: "text-brand bg-paper border-brand-line" },
	read: { icon: "✓", long: "Leído en SUNAT", short: "Leído", className: "text-ok bg-ok-soft border-ok-line" },
	unconfirmed: { icon: "!", long: "SUNAT aún no confirma la lectura", short: "Sin confirmar", className: "text-effect-ink bg-effect-soft border-effect-line" },
};

export const RemoteStatePill = ({ state, variant = "long", className }: { state: RemoteReadState; variant?: "long" | "short"; className?: string }) => {
	const s = REMOTE[state];
	return (
		<span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", s.className, className)}>
			<span aria-hidden="true" className={cn("mono", state === "confirming" && "inline-block motion-safe:animate-spin")}>
				{s.icon}
			</span>
			{variant === "long" ? (
				s.long
			) : (
				<span>
					{s.short}
					<span className="sr-only"> en SUNAT</span>
				</span>
			)}
		</span>
	);
};

/** Indicador compacto para filas de la bandeja. */
export const RemoteStateDot = ({ state }: { state: RemoteReadState }) => {
	const unread = state === "unread";
	const icon = unread ? "●" : state === "confirming" ? "↻" : state === "unconfirmed" ? "!" : "○";
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", unread ? "font-semibold text-brand" : "text-muted-ink")}>
			<span aria-hidden="true" className={cn(state === "confirming" && "inline-block motion-safe:animate-spin")}>
				{icon}
			</span>
			{REMOTE[state].short}
			<span className="sr-only"> en SUNAT</span>
		</span>
	);
};

export const ReviewTag = ({ reviewed, className }: { reviewed: boolean; className?: string }) => (
	<span
		className={cn(
			"inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-paper",
			reviewed ? "border-ok text-ok" : "border-line-strong text-muted-ink",
			className,
		)}
	>
		<span aria-hidden="true">{reviewed ? "✓" : "○"}</span>
		{reviewed ? "Revisado en buzon-sol" : "Sin revisar"}
	</span>
);

/** Ámbar reservado: acciones y pasos que pueden cambiar el estado en SUNAT. */
export const RemoteEffectBadge = ({ className, children = "Puede marcar como leído" }: { className?: string; children?: string }) => (
	<span className={cn("inline-flex items-center gap-1.5 rounded-sm border border-effect bg-effect-softer px-2 py-0.5 text-xs font-semibold text-effect-ink whitespace-nowrap", className)}>
		<span aria-hidden="true">!</span>
		{children}
	</span>
);

export const NoContentBadge = ({ className }: { className?: string }) => (
	<span className={cn("inline-flex items-center gap-1.5 rounded-sm border border-ok-line bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok whitespace-nowrap", className)}>
		<span aria-hidden="true">✓</span>
		{INVENTORY_EFFECT_LABEL}
	</span>
);

const TAG_COLORS: Record<string, string> = {
	"01": "#3F6FA3",
	"02": "#A3553F",
	"03": "#6A5AA3",
	"04": "#2F7F72",
	"05": "#8A7A2E",
	"06": "#7A8591",
};

export const tagColor = (tag: SunatTag) => (tag.known ? TAG_COLORS[tag.code] : undefined) ?? "#AEB5BD";

/** Etiqueta SUNAT. Un código desconocido se muestra neutro con borde discontinuo y nombre completo accesible. */
export const TagChip = ({ tag, className }: { tag: SunatTag | null; className?: string }) => {
	if (!tag) return <span className="text-xs text-subtle-ink">Sin etiqueta</span>;
	return (
		<span
			className={cn(
				"inline-flex max-w-[16rem] items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs text-ink-2",
				tag.known ? "border-line bg-paper" : "border-dashed border-line-strong bg-surface",
				className,
			)}
			title={tag.name}
		>
			<span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ background: tagColor(tag) }} />
			<span className="truncate" aria-hidden="true">
				{tag.name}
			</span>
			<span className="sr-only">
				Etiqueta: {tag.name}
				{tag.known ? "" : " (etiqueta nueva)"}
			</span>
		</span>
	);
};

const BOX_LABEL: Record<MailBox, string> = { messages: "Mensajes", notifications: "Notificaciones" };
export const boxLabel = (box: MailBox) => BOX_LABEL[box];

export interface ConnectionView {
	icon: string;
	label: string;
	sub: string;
	tone: "ok" | "info" | "effect" | "err" | "off";
}

/** Traduce el estado de consulta de una cuenta a los textos normativos del diseño. */
export const describeConnection = (c: ConnectionStatus): ConnectionView => {
	if (c.running) {
		return {
			icon: "↻",
			label: "Actualizando inventario…",
			sub: `${boxLabel(c.running.box)} · página ${c.running.page}${c.running.estimatedPages ? ` de ~${c.running.estimatedPages}` : ""}`,
			tone: "info",
		};
	}
	if (c.pauseReason === "needs_credential") return { icon: "○", label: "Sin credencial · programador desactivado", sub: "Requiere credencial", tone: "off" };
	if (c.scheduleState === "paused" && c.pauseReason === "invalid_credential") return { icon: "!", label: "En pausa · credencial rechazada", sub: "Se avisó a los administradores", tone: "effect" };
	if (c.syncState === "retrying") return { icon: "×", label: "SUNAT no respondió · reintentando", sub: `Última: ${formatRelative(c.lastRunAt)}`, tone: "err" };
	if (c.scheduleState === "paused") return { icon: "!", label: "Consulta en pausa", sub: `Última: ${formatRelative(c.lastRunAt)}`, tone: "effect" };
	if (c.scheduleState === "disabled") return { icon: "○", label: "Programador desactivado", sub: `Última: ${formatRelative(c.lastRunAt)}`, tone: "off" };
	return {
		icon: "●",
		label: "Consulta programada activa",
		sub: `Última: ${c.lastRunAt ? formatTime(c.lastRunAt) : "—"}${c.nextRunAt ? ` · próxima: ${formatTime(c.nextRunAt)}` : ""}`,
		tone: "ok",
	};
};

export const TONE_TEXT: Record<ConnectionView["tone"], string> = {
	ok: "text-ok",
	info: "text-brand",
	effect: "text-effect-ink",
	err: "text-err",
	off: "text-muted-ink",
};

export const ConnectionBadge = ({ connection, className, withSub = false }: { connection: ConnectionStatus; className?: string; withSub?: boolean }) => {
	const view = describeConnection(connection);
	return (
		<span className={cn("inline-flex flex-col", className)}>
			<span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", TONE_TEXT[view.tone])}>
				<span aria-hidden="true" className={cn("mono", view.icon === "↻" && "inline-block motion-safe:animate-spin")}>
					{view.icon}
				</span>
				{view.label}
			</span>
			{withSub && <span className="text-xs text-muted-ink">{view.sub}</span>}
		</span>
	);
};
