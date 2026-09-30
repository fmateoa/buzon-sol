import type { ReactNode } from "react";
import { Skeleton } from "lizaui/ui";
import { cn } from "@/lib/cn";

export const PageHeader = ({ title, description, actions, back, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode; className?: string }) => (
	<header className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
		<div className="min-w-0">
			{back && <div className="mb-1">{back}</div>}
			<h1 className="text-xl font-bold tracking-tight text-ink md:text-2xl">{title}</h1>
			{description && <div className="mt-1 text-sm text-muted-ink">{description}</div>}
		</div>
		{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
	</header>
);

export const Section = ({ title, children, actions, className, headingId }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; headingId?: string }) => (
	<section aria-labelledby={headingId} className={cn("rounded-lg border border-line bg-paper p-4 md:p-5", className)}>
		{(title || actions) && (
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				{title && (
					<h2 id={headingId} className="text-base font-semibold text-ink">
						{title}
					</h2>
				)}
				{actions}
			</div>
		)}
		{children}
	</section>
);

export const EmptyState = ({ title, children, action, className, icon = "○" }: { title: string; children?: ReactNode; action?: ReactNode; className?: string; icon?: string }) => (
	<div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
		<span aria-hidden="true" className="mono flex size-10 items-center justify-center rounded-full bg-surface text-muted-ink">
			{icon}
		</span>
		<p className="font-semibold text-ink">{title}</p>
		{children && <div className="max-w-md text-sm text-muted-ink">{children}</div>}
		{action && <div className="mt-2">{action}</div>}
	</div>
);

export const BlockSkeleton = ({ lines = 3, label = "Cargando" }: { lines?: number; label?: string }) => (
	<div role="status" aria-live="polite" className="flex flex-col gap-2">
		<span className="sr-only">{label}…</span>
		{Array.from({ length: lines }, (_, i) => (
			<Skeleton key={i} className="h-5 rounded bg-default-100" style={{ width: `${100 - i * 12}%` }} />
		))}
	</div>
);

/** Par etiqueta/valor de metadatos. */
export const Meta = ({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) => (
	<div className="flex flex-col">
		<dt className="text-xs text-muted-ink">{label}</dt>
		<dd className={cn("text-sm text-ink", mono && "mono")}>{children}</dd>
	</div>
);
