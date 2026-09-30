import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "partial" | "effect" | "error" | "success";

const TONES: Record<NoticeTone, { icon: string; box: string; badge: string }> = {
	info: { icon: "i", box: "border-line bg-paper text-ink-2", badge: "bg-brand-soft text-brand" },
	partial: { icon: "◐", box: "border-brand-line bg-brand-soft text-ink-2", badge: "bg-paper text-brand" },
	effect: { icon: "!", box: "border-effect bg-effect-softer text-ink-2", badge: "bg-effect-soft text-effect-ink" },
	error: { icon: "×", box: "border-err-line bg-err-soft text-ink-2", badge: "bg-paper text-err" },
	success: { icon: "✓", box: "border-ok-line bg-ok-soft text-ink-2", badge: "bg-paper text-ok" },
};

interface NoticeProps {
	tone: NoticeTone;
	title?: ReactNode;
	children?: ReactNode;
	action?: ReactNode;
	className?: string;
	/** `alert` interrumpe al lector de pantalla: solo para errores nuevos. */
	role?: "status" | "alert" | "note";
}

/** Aviso de estado (banner): símbolo + texto + acción opcional. */
export const Notice = ({ tone, title, children, action, className, role = "status" }: NoticeProps) => {
	const t = TONES[tone];
	return (
		<div role={role === "note" ? undefined : role} className={cn("flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center", t.box, className)}>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<span aria-hidden="true" className={cn("mono mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", t.badge)}>
					{t.icon}
				</span>
				<div className="min-w-0">
					{title && <p className="font-semibold text-ink">{title}</p>}
					{children && <div className="text-ink-2">{children}</div>}
				</div>
			</div>
			{action && <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">{action}</div>}
		</div>
	);
};
