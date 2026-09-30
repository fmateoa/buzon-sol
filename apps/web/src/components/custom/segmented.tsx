import { cn } from "@/lib/cn";

interface SegmentedProps<V extends string> {
	legend: string;
	name: string;
	options: { value: V; label: string }[];
	value: V;
	onChange: (value: V) => void;
	disabled?: boolean;
	className?: string;
}

/**
 * Selector de una opción (diseño A3/A5): grupo con borde y la opción elegida en azul de marca con «✓».
 * Son radios nativos ocultos, así que el teclado usa las flechas como en cualquier grupo de radio.
 * lizaui no trae un control segmentado con semántica de radio (`ButtonGroup` agrupa botones).
 */
export const Segmented = <V extends string>({ legend, name, options, value, onChange, disabled = false, className }: SegmentedProps<V>) => (
	<fieldset className={className} disabled={disabled}>
		<legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
		<div role="radiogroup" aria-label={legend} className={cn("inline-flex max-w-full flex-wrap overflow-hidden rounded-md border-[1.5px] border-input bg-paper", disabled && "opacity-60")}>
			{options.map((o) => {
				const checked = value === o.value;
				return (
					<label
						key={o.value}
						className={cn(
							// Foco de 3 px por dentro: blanco sobre la opción elegida (azul), azul sobre las demás.
							"flex min-h-10 cursor-pointer items-center px-3.5 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3",
							checked ? "bg-brand-fill font-semibold text-white has-[:focus-visible]:outline-white" : "text-ink-2 hover:bg-surface has-[:focus-visible]:outline-brand",
							disabled && "cursor-not-allowed",
						)}
					>
						<input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
						{checked && <span aria-hidden="true">✓&nbsp;</span>}
						{o.label}
					</label>
				);
			})}
		</div>
	</fieldset>
);
