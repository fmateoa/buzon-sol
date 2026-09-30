import { useState } from "react";
import { Button } from "lizaui/button";
import { Input } from "lizaui/ui";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "lizaui/drawer";
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { MailBox, MailListFilters, MailSortColumn, SunatFolder, SunatTag } from "@/domain/types";
import { ColumnMenu, FilterSelect, type ColumnDef } from "@/components/custom/list-table";
import type { ListState } from "@/hooks/use-list-state";
import { cn } from "@/lib/cn";

export type MailListState = ListState<MailListFilters, MailSortColumn>;

export const EMPTY_MAIL_FILTERS: MailListFilters = { query: "", state: "all", folder: null, tag: null, dateFrom: null, dateTo: null, review: "all" };

const STATE_OPTIONS: { value: MailListFilters["state"]; label: string }[] = [
	{ value: "all", label: "Todos" },
	{ value: "unread", label: "Solo no leídos" },
	{ value: "read", label: "Leídos" },
];

const StateSegment = ({ state }: { state: MailListState }) => (
	<div role="group" aria-label="Estado en SUNAT" className="inline-flex rounded-lg border border-line-strong bg-paper p-0.5">
		{STATE_OPTIONS.map((o) => {
			const active = state.filters.state === o.value;
			return (
				<button
					key={o.value}
					type="button"
					aria-pressed={active}
					onClick={() => state.setFilter("state", o.value)}
					className={cn("min-h-9 rounded-md px-3 text-sm whitespace-nowrap", active ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-surface")}
				>
					{active && <span aria-hidden="true">✓ </span>}
					{o.label}
				</button>
			);
		})}
	</div>
);

interface FilterControlsProps {
	state: MailListState;
	folders: SunatFolder[] | undefined;
	tags: SunatTag[] | undefined;
}

const DateRange = ({ state }: { state: MailListState }) => (
	<div className="flex items-center gap-2">
		<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
			Desde
			<input type="date" value={state.filters.dateFrom ?? ""} max={state.filters.dateTo ?? undefined} onChange={(e) => state.setFilter("dateFrom", e.target.value || null)} className="h-9 rounded-md border border-line-strong bg-paper px-2 text-sm text-ink" />
		</label>
		<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
			Hasta
			<input type="date" value={state.filters.dateTo ?? ""} min={state.filters.dateFrom ?? undefined} onChange={(e) => state.setFilter("dateTo", e.target.value || null)} className="h-9 rounded-md border border-line-strong bg-paper px-2 text-sm text-ink" />
		</label>
	</div>
);

const SelectFilters = ({ state, folders, tags }: FilterControlsProps) => (
	<>
		<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
			Carpeta
			{folders && folders.length === 0 ? (
				<span className="flex h-9 items-center text-sm text-subtle-ink">Sin carpetas propias</span>
			) : (
				<FilterSelect
					label="Carpeta"
					value={state.filters.folder ?? "all"}
					onChange={(v) => state.setFilter("folder", v === "all" ? null : v)}
					options={[{ value: "all", label: "Todas" }, ...(folders ?? []).map((f) => ({ value: f.code, label: f.name }))]}
				/>
			)}
		</label>
		<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
			Etiqueta
			<FilterSelect
				label="Etiqueta"
				value={state.filters.tag ?? "all"}
				onChange={(v) => state.setFilter("tag", v === "all" ? null : v)}
				options={[{ value: "all", label: "Todas" }, ...(tags ?? []).map((t) => ({ value: t.code, label: t.known ? t.name : `${t.name} (nueva)` }))]}
			/>
		</label>
		<label className="flex flex-col gap-0.5 text-xs text-muted-ink">
			Revisión en buzon-sol
			<FilterSelect
				label="Revisión en buzon-sol"
				value={state.filters.review}
				onChange={(v) => state.setFilter("review", v)}
				options={[
					{ value: "all", label: "Todas" },
					{ value: "pending", label: "Pendientes de revisión" },
					{ value: "reviewed", label: "Revisados" },
				]}
			/>
		</label>
	</>
);

const SearchInput = ({ state, box }: { state: MailListState; box: MailBox }) => (
	<Input
		type="text"
		value={state.filters.query}
		onChange={(e) => state.setFilter("query", e.target.value)}
		placeholder="Buscar por asunto"
		aria-label={`Buscar ${box === "messages" ? "mensajes" : "notificaciones"} por asunto`}
		startContent={<Search className="size-4 text-muted-ink" aria-hidden="true" />}
		isClearable
		onClear={() => state.setFilter("query", "")}
		classNameContainer="w-full md:w-72"
		className="bg-paper dark:bg-paper"
	/>
);

export const DesktopFilters = ({ state, folders, tags, box, columns, onRefresh, refreshing }: FilterControlsProps & { box: MailBox; columns: ColumnDef[]; onRefresh: () => void; refreshing: boolean }) => (
	<div className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-3">
		<div className="flex flex-wrap items-center gap-3">
			<SearchInput state={state} box={box} />
			<StateSegment state={state} />
			<div className="ml-auto flex items-center gap-2">
				<ColumnMenu columns={columns} hidden={state.hiddenColumns} onToggle={state.toggleColumn} />
				<Button size="sm" variant="bordered" isIconOnly aria-label="Recargar listado guardado" onClick={onRefresh} className="bg-paper dark:bg-paper">
					<RefreshCw className={cn("size-4", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
				</Button>
			</div>
		</div>
		<div className="flex flex-wrap items-end gap-3">
			<DateRange state={state} />
			<SelectFilters state={state} folders={folders} tags={tags} />
			{state.isFiltered && (
				<Button size="sm" variant="light" onClick={state.resetFilters} className="min-h-9">
					Quitar filtros
				</Button>
			)}
		</div>
	</div>
);

/** M1: búsqueda arriba, filtros en hoja inferior y chips de filtros activos. */
export const MobileFilters = ({ state, folders, tags, box, unreadCount }: FilterControlsProps & { box: MailBox; unreadCount: number | undefined }) => {
	const [open, setOpen] = useState(false);
	const chips: { key: string; label: string; clear: () => void }[] = [];
	if (state.filters.state !== "all") chips.push({ key: "state", label: state.filters.state === "unread" ? `No leídos${unreadCount !== undefined ? ` · ${unreadCount}` : ""}` : "Leídos", clear: () => state.setFilter("state", "all") });
	if (state.filters.dateFrom || state.filters.dateTo) chips.push({ key: "date", label: `${state.filters.dateFrom ?? "…"} – ${state.filters.dateTo ?? "…"}`, clear: () => { state.setFilter("dateFrom", null); state.setFilter("dateTo", null); } });
	if (state.filters.folder) chips.push({ key: "folder", label: folders?.find((f) => f.code === state.filters.folder)?.name ?? "Carpeta", clear: () => state.setFilter("folder", null) });
	if (state.filters.tag) chips.push({ key: "tag", label: tags?.find((t) => t.code === state.filters.tag)?.name ?? "Etiqueta", clear: () => state.setFilter("tag", null) });
	if (state.filters.review !== "all") chips.push({ key: "review", label: state.filters.review === "pending" ? "Pendientes de revisión" : "Revisados", clear: () => state.setFilter("review", "all") });

	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2">
				<div className="min-w-0 flex-1">
					<SearchInput state={state} box={box} />
				</div>
				<Button variant="bordered" onClick={() => setOpen(true)} startContent={<SlidersHorizontal className="size-4" aria-hidden="true" />} className="min-h-11 bg-paper" aria-label={`Filtros${chips.length ? `, ${chips.length} activos` : ""}`}>
					Filtros
				</Button>
			</div>
			{chips.length > 0 && (
				<ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
					{chips.map((c) => (
						<li key={c.key}>
							<button type="button" onClick={c.clear} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 text-sm text-brand" aria-label={`Quitar filtro ${c.label}`}>
								<span aria-hidden="true">✓</span> {c.label} <X className="size-3.5" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
			<Drawer isOpen={open} onClose={() => setOpen(false)} placement="bottom" size="lg" isFloating backdrop="blur" closeButtonLabel="Cerrar filtros">
				<DrawerContent>
					<DrawerHeader className="pt-7">
						<DrawerTitle className="text-lg font-semibold text-ink">Filtros</DrawerTitle>
					</DrawerHeader>
					<DrawerBody>
						<div className="flex flex-col gap-4">
							<StateSegment state={state} />
							<DateRange state={state} />
							<SelectFilters state={state} folders={folders} tags={tags} />
						</div>
					</DrawerBody>
					<DrawerFooter className="flex gap-2">
						<Button variant="bordered" onClick={state.resetFilters} className="min-h-11 flex-1">
							Quitar filtros
						</Button>
						<Button color="primary" onClick={() => setOpen(false)} className="min-h-11 flex-1">
							Ver resultados
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</div>
	);
};
