import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { Table, type TableKeyCurrent } from "lizaui/table";
import { Button } from "lizaui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "lizaui/ui";
import { Columns3 } from "lucide-react";
import type { Page } from "@/domain/types";
import { PAGE_SIZES, type ListState } from "@/hooks/use-list-state";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { QueryError } from "./query-error";

/**
 * Columna de listado. `lizaui/table` no exporta `ColumnDef`; este tipo es
 * estructuralmente compatible con su `dataHeader` (id, header, sort, size, límites).
 * No se usan `pinned`, `isStickyChecks` ni `isStickyAction`.
 */
export type ColumnDef = {
	id: string;
	header: string;
	sort?: boolean;
	size?: number;
	minWidth?: number;
	maxWidth?: number;
	resizable?: boolean;
	information?: string;
	/** No se puede ocultar desde el menú de columnas. */
	lockVisible?: boolean;
};

/** Fondo de las filas del cuerpo: blanco, con gris suave al pasar el cursor (el encabezado conserva el de lizaui). */
export const TABLE_ROW_CLASS = "bg-paper hover:bg-surface-2";

/**
 * lizaui oculta el encabezado de una columna oculta pero no sus celdas: sin esto las filas se
 * corren una posición. `renderCells` devuelve un fragmento con una celda por columna (mismo orden
 * que `columns`, luego la de acciones); aquí se descartan las de las columnas ocultas.
 */
export const withoutHiddenCells = (cells: ReactNode, columns: ColumnDef[], hidden: string[]): ReactNode => {
	if (hidden.length === 0 || !isValidElement(cells)) return cells;
	const raw = (cells as ReactElement<{ children?: ReactNode }>).props.children;
	if (!Array.isArray(raw)) return cells;
	return Children.toArray(raw.filter((_, index) => !(index < columns.length && hidden.includes(columns[index]!.id))));
};

/**
 * Listado paginado con `Table` de lizaui (no `DataTable`). Reglas aplicadas:
 * - Encabezado y filtros se mantienen con 0 resultados; los errores van fuera de la tabla.
 * - `isLoading` solo en la primera carga; en recargas se conserva la página a media opacidad.
 * - Las filas no aceptan `onClick`: la última celda contiene los botones de acción.
 * - El número y orden de celdas de cada fila coincide con `columns` + acciones.
 */
interface ListTableProps<T> {
	label: string;
	columns: ColumnDef[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el estado es genérico en filtros/orden
	state: ListState<any, any>;
	page: Page<T> | undefined;
	isLoading: boolean;
	isFetching: boolean;
	error: unknown;
	onRetry?: () => void;
	rowKey: (item: T) => string;
	rowName: (item: T) => string;
	renderCells: (item: T) => ReactNode;
	renderFilter?: (column: ColumnDef) => ReactNode;
	selectable?: boolean;
	isSelectable?: (item: T) => boolean;
	rowClassName?: (item: T) => string | undefined;
	emptyContent: ReactNode;
	/** `false` en listados de solo lectura (sin columna de acciones). */
	hasActions?: boolean;
	actionLabel?: string;
	actionWidth?: number;
	batchBar?: ReactNode;
	countNoun?: [string, string];
	summaryExtra?: ReactNode;
	hideSummary?: boolean;
}

export const ListTable = <T extends object>({
	label,
	columns,
	state,
	page,
	isLoading,
	isFetching,
	error,
	onRetry,
	rowKey,
	rowName,
	renderCells,
	renderFilter,
	selectable = false,
	isSelectable = () => true,
	rowClassName,
	emptyContent,
	hasActions = true,
	actionLabel = "Acciones",
	actionWidth = 110,
	batchBar,
	countNoun = ["registro", "registros"],
	summaryExtra,
	hideSummary,
}: ListTableProps<T>) => {
	const rows = page?.rows ?? [];
	const selectableRows = rows.filter(isSelectable);
	const allSelected = selectableRows.length > 0 && selectableRows.every((r) => state.selection.some((s: TableKeyCurrent) => s.id === rowKey(r)));
	const disabledKeys = rows.filter((r) => !isSelectable(r)).map(rowKey);
	const total = page?.total ?? 0;
	const from = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
	const to = Math.min(total, state.page * state.pageSize);

	return (
		<div className="flex flex-col gap-3">
			{error ? <QueryError error={error} onRetry={onRetry} /> : null}
			{batchBar}
			<div className={cn("transition-opacity", isFetching && !isLoading && "opacity-50")} aria-busy={isFetching}>
				<Table
					ariaLabel={label}
					dataHeader={columns}
					isChecks={selectable}
					isActions={hasActions}
					actionLabel={actionLabel}
					widthAction={actionWidth}
					selectKeys={state.selection}
					disabledKeys={disabledKeys}
					sortDescriptor={state.sortDescriptor}
					onSortChange={state.toggleSort}
					hiddenColumns={state.hiddenColumns}
					color="primary"
					classNameContainer="bg-paper border border-line p-0"
				>
					<Table.Header>
						<Table.HeaderRow valueCheck={allSelected} disabledCheck={selectableRows.length === 0} onChangeCheck={(checked) => state.setSelection(checked ? selectableRows.map((r) => ({ id: rowKey(r), name: rowName(r) })) : [])}>
							{({ item }) => <Table.HeaderColumn header={item} text={item.header} size={item.size} minWidth={item.minWidth} maxWidth={item.maxWidth} />}
						</Table.HeaderRow>
						{renderFilter && <Table.SearchRow>{({ item }) => <Table.SearchColumn className="py-1.5 text-left font-normal">{renderFilter(item)}</Table.SearchColumn>}</Table.SearchRow>}
					</Table.Header>
					<Table.Body data={rows} rowKey={(item) => rowKey(item)} isLoading={isLoading} loadingLabel="Cargando registros…" emptyContent={isLoading ? undefined : emptyContent}>
						{({ item }) => (
							<Table.BodyRow keyCurrent={{ id: rowKey(item), name: rowName(item) }} isCheck={isSelectable(item)} onChangeCheck={(key) => state.toggleSelection(key)} className={cn(TABLE_ROW_CLASS, rowClassName?.(item))}>
								{withoutHiddenCells(renderCells(item), columns, state.hiddenColumns)}
							</Table.BodyRow>
						)}
					</Table.Body>
				</Table>
			</div>
			{total > 0 && (
				<ListFooter
					from={from}
					to={to}
					total={total}
					page={state.page}
					pageSize={state.pageSize}
					onChange={state.setPage}
					countNoun={countNoun}
					extra={summaryExtra}
					hideSummary={hideSummary}
				/>
			)}
		</div>
	);
};

export const ListFooter = ({
	from,
	to,
	total,
	page,
	pageSize,
	onChange,
	countNoun = ["registro", "registros"],
	extra,
	hideSummary = false,
}: {
	from: number;
	to: number;
	total: number;
	page: number;
	pageSize: number;
	onChange: (page: number, pageSize: number) => void;
	countNoun?: [string, string];
	extra?: ReactNode;
	/** La pantalla ya muestra el conteo sobre la tabla. */
	hideSummary?: boolean;
}) => {
	const lastPage = Math.max(1, Math.ceil(total / pageSize));
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-ink">
			<div className="flex flex-wrap items-center gap-3">
				{!hideSummary && (
					<span aria-live="polite">
						{formatCount(total)} {total === 1 ? countNoun[0] : countNoun[1]} · Mostrando {formatCount(from)}–{formatCount(to)}
					</span>
				)}
				{extra}
				<Select value={String(pageSize)} onValueChange={(v) => onChange(1, Number(v))}>
					<SelectTrigger size="sm" className="h-9 min-w-36 border-transparent bg-transparent shadow-none" aria-label="Registros por página">
						<SelectValue>{pageSize} por página</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{PAGE_SIZES.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<nav aria-label="Paginación" className="flex items-center gap-3">
				<Button size="sm" variant="bordered" disabled={page <= 1} onClick={() => onChange(page - 1, pageSize)} className="min-h-9 bg-paper">
					‹ Anterior
				</Button>
				<span className="text-ink-2">
					Página {formatCount(page)} de {formatCount(lastPage)}
				</span>
				<Button size="sm" variant="bordered" disabled={page >= lastPage} onClick={() => onChange(page + 1, pageSize)} className="min-h-9 bg-paper">
					Siguiente ›
				</Button>
			</nav>
		</div>
	);
};

/** Menú de columnas: alterna `hiddenColumns` y permanece abierto tras cada cambio. */
export const ColumnMenu = ({ columns, hidden, onToggle, className }: { columns: ColumnDef[]; hidden: string[]; onToggle: (id: string) => void; className?: string }) => (
	<DropdownMenu>
		<DropdownMenuTrigger asChild>
			<Button size="sm" variant="bordered" startContent={<Columns3 className="size-4" aria-hidden="true" />} className={cn("bg-paper", className)}>
				Columnas
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			<DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
			<DropdownMenuSeparator />
			{columns.map((c) => (
				<DropdownMenuCheckboxItem
					key={c.id}
					checked={!hidden.includes(c.id)}
					disabled={c.lockVisible === true || (!hidden.includes(c.id) && columns.length - hidden.length <= 1)}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={() => onToggle(c.id)}
				>
					{c.header}
				</DropdownMenuCheckboxItem>
			))}
		</DropdownMenuContent>
	</DropdownMenu>
);

/** Select de filtro con opción «todos». */
export const FilterSelect = <V extends string>({
	value,
	onChange,
	options,
	label,
	className,
}: {
	value: V;
	onChange: (value: V) => void;
	options: { value: V; label: string }[];
	label: string;
	className?: string;
}) => (
	<Select value={value} onValueChange={(v) => onChange(v as V)}>
		<SelectTrigger size="sm" className={cn("h-9 w-full min-w-28 bg-paper dark:bg-paper dark:hover:bg-surface", className)} aria-label={label}>
			<SelectValue />
		</SelectTrigger>
		<SelectContent>
			{options.map((o) => (
				<SelectItem key={o.value} value={o.value}>
					{o.label}
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);
