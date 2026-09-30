# Table

- tipo: componente
- import recomendado: `lizaui/table`
- export principal sugerido: `Table`

## Resumen

Esta referencia documenta la superficie pública de `table` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Table`
- `TableHOC`
- `TableKeyCurrent`
- `TableValueSearchProps`
- `useTable`

## Props y tipos clave

### `TableEmptyStateProps`

- firma: `interface TableEmptyStateProps { text?: string; }`
- propiedades detectadas:
  - `text?`: `string`

### `ResizeHandleProps`

- firma: `interface ResizeHandleProps { onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void; isResizing: boolean; className?: string; }`
- propiedades detectadas:
  - `onPointerDown`: `(e: React.PointerEvent<HTMLDivElement>) => void`
  - `isResizing`: `boolean`
  - `className?`: `string`

### `UseColumnResizeProps`

- firma: `interface UseColumnResizeProps { columnId: string; initialWidth?: number; minWidth?: number; maxWidth?: number; onResize?: (columnId: string, width: number) => void; onResizeEnd?: (columnId: string, width: number) => void; }`
- propiedades detectadas:
  - `columnId`: `string`
  - `initialWidth?`: `number`
  - `minWidth?`: `number`
  - `maxWidth?`: `number`
  - `onResize?`: `(columnId: string, width: number) => void`
  - `onResizeEnd?`: `(columnId: string, width: number) => void`

### `UseColumnResizeReturn`

- firma: `export type UseColumnResizeReturn = ReturnType<typeof useColumnResize>;`
- hereda o referencia: `ReturnType<typeof useColumnResize>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableProps`

- firma: `interface TableProps { initialSelectKey?: TableKeyCurrent[]; initialDisabledKeys?: string[]; initialValueSearch?: TableValueSearchProps; initialSortDescriptor?: SortDescriptor | null; initialColumnWidths?: ColumnWidths; initialHiddenColumns?: string[]; /** * When provided, column widths, sort and hidden columns are restored from * and persisted to localStorage under this key. Selection and search * values are session-specific and never persisted. */ persistKey?: string; }`
- propiedades detectadas:
  - `initialSelectKey?`: `TableKeyCurrent[]`
  - `initialDisabledKeys?`: `string[]`
  - `initialValueSearch?`: `TableValueSearchProps`
  - `initialSortDescriptor?`: `SortDescriptor | null`
  - `initialColumnWidths?`: `ColumnWidths`
  - `initialHiddenColumns?`: `string[]`
  - `persistKey?`: `string`

### `PersistedTableState`

- firma: `interface PersistedTableState { columnWidths?: ColumnWidths; sortDescriptor?: SortDescriptor | null; hiddenColumns?: string[]; }`
- propiedades detectadas:
  - `columnWidths?`: `ColumnWidths`
  - `sortDescriptor?`: `SortDescriptor | null`
  - `hiddenColumns?`: `string[]`

### `TableKeyCurrent`

- firma: `export interface TableKeyCurrent { id: string; name: string; [key: string]: any; }`
- propiedades detectadas:
  - `id`: `string`
  - `name`: `string`

### `TableValueSearchProps`

- firma: `export interface TableValueSearchProps { [key: string]: any; }`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SortDirection`

- firma: `export type SortDirection = "asc" | "desc";`
- hereda o referencia: `"asc" | "desc"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SortDescriptor`

- firma: `export interface SortDescriptor { column: string; direction: SortDirection; }`
- propiedades detectadas:
  - `column`: `string`
  - `direction`: `SortDirection`

### `ColumnWidths`

- firma: `export type ColumnWidths = Record<string, number>;`
- hereda o referencia: `Record<string, number>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableHookProps`

- firma: `export interface TableHookProps { selectKeys: TableKeyCurrent[]; disabledKeys: string[]; valueSearch: TableValueSearchProps; sortDescriptor: SortDescriptor | null; columnWidths: ColumnWidths; /** Ids of the columns currently hidden. Pass it to `<Table hiddenColumns={...}>`. */ hiddenColumns: string[]; handleSelectKey: (parameter: TableKeyCurrent) => void; handleSelectKeys: (parameter: TableKeyCurrent[]) => void; handleDisabledKeys: (parameter: string[]) => void; handleSetValueSearch: (key: string, value: string) => void; handleResetSelectKeys: () => void; handleSort: (column: string) => void; handleColumnResize: (columnId: string, width: number) => void; handleColumnResizeEnd: (columnId: string, width: number) => void; /** Toggles the visibility of a single column by id. */ handleToggleColumnVisibility: (columnId: string) => void; /** Replaces the whole hidden-columns list. */ handleHiddenColumns: (columnIds: string[]) => void; }`
- propiedades detectadas:
  - `selectKeys`: `TableKeyCurrent[]`
  - `disabledKeys`: `string[]`
  - `valueSearch`: `TableValueSearchProps`
  - `sortDescriptor`: `SortDescriptor | null`
  - `columnWidths`: `ColumnWidths`
  - `hiddenColumns`: `string[]`
  - `handleSelectKey`: `(parameter: TableKeyCurrent) => void`
  - `handleSelectKeys`: `(parameter: TableKeyCurrent[]) => void`
  - `handleDisabledKeys`: `(parameter: string[]) => void`
  - `handleSetValueSearch`: `(key: string, value: string) => void`
  - `handleResetSelectKeys`: `() => void`
  - `handleSort`: `(column: string) => void`
  - `handleColumnResize`: `(columnId: string, width: number) => void`
  - `handleColumnResizeEnd`: `(columnId: string, width: number) => void`
  - `handleToggleColumnVisibility`: `(columnId: string) => void`
  - `handleHiddenColumns`: `(columnIds: string[]) => void`

### `TableShareProps`

- firma: `export interface TableShareProps { color?: ExcludeType<ColorProps, "secondary">; isChecks?: boolean; selectKeys?: TableKeyCurrent[]; disabledKeys?: string[]; isActions?: boolean; /** * When true (and `isChecks` is enabled), the checkbox column stays pinned * to the left edge while scrolling horizontally. */ isStickyChecks?: boolean; /** * When true (and `isActions` is enabled), the action column stays pinned * to the right edge while scrolling horizontally. */ isStickyAction?: boolean; /** Optional label rendered in the action column header. */ actionLabel?: string; actionClassName?: string; widthAction?: number; sortDescriptor?: SortDescriptor | null; onSortChange?: (column: string) => void; columnWidths?: ColumnWidths; onColumnResize?: (columnId: string, width: number) => void; onColumnResizeEnd?: (columnId: string, width: number) => void; }`
- propiedades detectadas:
  - `color?`: `ExcludeType<ColorProps, "secondary">`
  - `isChecks?`: `boolean`
  - `selectKeys?`: `TableKeyCurrent[]`
  - `disabledKeys?`: `string[]`
  - `isActions?`: `boolean`
  - `isStickyChecks?`: `boolean`
  - `isStickyAction?`: `boolean`
  - `actionLabel?`: `string`
  - `actionClassName?`: `string`
  - `widthAction?`: `number`
  - `sortDescriptor?`: `SortDescriptor | null`
  - `onSortChange?`: `(column: string) => void`
  - `columnWidths?`: `ColumnWidths`
  - `onColumnResize?`: `(columnId: string, width: number) => void`
  - `onColumnResizeEnd?`: `(columnId: string, width: number) => void`

### `TableColumnsProps`

- firma: `export interface TableColumnsProps { id: string; header: string; search?: { placeholder: string; key: string; inputType?: "text" | "date" | "number" | "email" | "url" | "tel"; }; controlType?: "input" | "datePicker" | "select"; sort?: boolean; size?: number; information?: string; colspan?: number; resizable?: boolean; minWidth?: number; maxWidth?: number; /** * When true, this column stays pinned to the left edge while scrolling * horizontally. Pinned columns should define a `size` (or be resizable) * so their sticky offset can be computed reliably. */ pinned?: boolean; [key: string]: any; }`
- propiedades detectadas:
  - `id`: `string`
  - `header`: `string`
  - `search?`: `{ placeholder: string; key: string; inputType?: "text" | "date" | "number" | "email" | "url" | "tel"; }`
  - `controlType?`: `"input" | "datePicker" | "select"`
  - `sort?`: `boolean`
  - `size?`: `number`
  - `information?`: `string`
  - `colspan?`: `number`
  - `resizable?`: `boolean`
  - `minWidth?`: `number`
  - `maxWidth?`: `number`
  - `pinned?`: `boolean`

### `PinnedColumnInfo`

- firma: `/** Sticky offset info for a left-pinned column, keyed by its dataHeader index. */ export interface PinnedColumnInfo { left: number; /** True for the right-most pinned column, which renders the elevation shadow. */ isLast: boolean; }`
- propiedades detectadas:
  - `left`: `number`
  - `isLast`: `boolean`

### `TableContextProps`

- firma: `export interface TableContextProps extends TableShareProps { totalColumn?: number; pinnedColumns?: Record<number, PinnedColumnInfo>; /** Column definitions shared with header/search rows through context. */ dataHeader?: TableColumnsProps[]; /** dataHeader indexes of hidden columns; rows skip these cells positionally. */ hiddenColumnIndexes?: Set<number>; }`
- hereda o referencia: `TableShareProps`
- propiedades detectadas:
  - `totalColumn?`: `number`
  - `pinnedColumns?`: `Record<number, PinnedColumnInfo>`
  - `dataHeader?`: `TableColumnsProps[]`
  - `hiddenColumnIndexes?`: `Set<number>`

### `TableProps`

- firma: `export interface TableProps extends TableShareProps { classNameContainer?: string; classNameSubContainer?: string; className?: string; children: ReactNode; spacing?: number; dataHeader?: TableColumnsProps[]; /** Accessible name announced by screen readers for the `<table>` element. */ ariaLabel?: string; /** * Ids of columns to hide. Header, search and body cells of these columns * are removed positionally, so rows keep rendering all their cells. */ hiddenColumns?: string[]; }`
- hereda o referencia: `TableShareProps`
- propiedades detectadas:
  - `classNameContainer?`: `string`
  - `classNameSubContainer?`: `string`
  - `className?`: `string`
  - `children`: `ReactNode`
  - `spacing?`: `number`
  - `dataHeader?`: `TableColumnsProps[]`
  - `ariaLabel?`: `string`
  - `hiddenColumns?`: `string[]`

### `TableHeaderProps`

- firma: `export interface TableHeaderProps { children: ReactNode; className?: string; dataHeader?: TableColumnsProps[]; }`
- propiedades detectadas:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `dataHeader?`: `TableColumnsProps[]`

### `TableHeaderRowRenderProps`

- firma: `export interface TableHeaderRowRenderProps { item: TableColumnsProps; index: number; }`
- propiedades detectadas:
  - `item`: `TableColumnsProps`
  - `index`: `number`

### `TableHeaderRowBaseProps`

- firma: `export interface TableHeaderRowBaseProps { dataHeader?: TableColumnsProps[]; className?: string; valueCheck?: boolean; onChangeCheck?: (value: boolean) => void; disabledCheck?: boolean; }`
- propiedades detectadas:
  - `dataHeader?`: `TableColumnsProps[]`
  - `className?`: `string`
  - `valueCheck?`: `boolean`
  - `onChangeCheck?`: `(value: boolean) => void`
  - `disabledCheck?`: `boolean`

### `TableHeaderRowProps`

- firma: `export type TableHeaderRowProps = (TableHeaderRowBaseProps & { children: (props: TableHeaderRowRenderProps) => ReactNode; }) | (TableHeaderRowBaseProps & { children: ReactNode; });`
- hereda o referencia: `(TableHeaderRowBaseProps & { children: (props: TableHeaderRowRenderProps) => ReactNode; }) | (TableHeaderRowBaseProps & { children: ReactNode; })`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableHeaderColumnProps`

- firma: `export interface TableHeaderColumnProps { header?: TableColumnsProps; className?: string; children?: ReactNode; color?: ExcludeType<ColorProps, "secondary">; icon?: ReactNode; text?: string; style?: React.CSSProperties; size?: number; colspan?: number; resizable?: boolean; minWidth?: number; maxWidth?: number; onResize?: (width: number) => void; onResizeEnd?: (width: number) => void; }`
- propiedades detectadas:
  - `header?`: `TableColumnsProps`
  - `className?`: `string`
  - `children?`: `ReactNode`
  - `color?`: `ExcludeType<ColorProps, "secondary">`
  - `icon?`: `ReactNode`
  - `text?`: `string`
  - `style?`: `React.CSSProperties`
  - `size?`: `number`
  - `colspan?`: `number`
  - `resizable?`: `boolean`
  - `minWidth?`: `number`
  - `maxWidth?`: `number`
  - `onResize?`: `(width: number) => void`
  - `onResizeEnd?`: `(width: number) => void`

### `TableSearchRowRenderProps`

- firma: `export interface TableSearchRowRenderProps { item: TableColumnsProps; index: number; }`
- propiedades detectadas:
  - `item`: `TableColumnsProps`
  - `index`: `number`

### `TableSearchRowBaseProps`

- firma: `export interface TableSearchRowBaseProps { dataHeader?: TableColumnsProps[]; className?: string; }`
- propiedades detectadas:
  - `dataHeader?`: `TableColumnsProps[]`
  - `className?`: `string`

### `TableSearchRowProps`

- firma: `export type TableSearchRowProps = (TableSearchRowBaseProps & { children: (props: TableSearchRowRenderProps) => ReactNode; }) | (TableSearchRowBaseProps & { children: ReactNode; });`
- hereda o referencia: `(TableSearchRowBaseProps & { children: (props: TableSearchRowRenderProps) => ReactNode; }) | (TableSearchRowBaseProps & { children: ReactNode; })`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableSearchColumnProps`

- firma: `export interface TableSearchColumnProps { style?: React.CSSProperties; className?: string; children?: ReactNode; colspan?: number; }`
- propiedades detectadas:
  - `style?`: `React.CSSProperties`
  - `className?`: `string`
  - `children?`: `ReactNode`
  - `colspan?`: `number`

### `TableBodyProps`

- firma: `export interface TableBodyProps<TData> { children: (props: { item: TData; index: number; }) => React.ReactNode | ReactNode; data?: TData[]; className?: string; emptyText?: string; /** * Custom content rendered when there is no data. Takes precedence over * `emptyText` and replaces the default empty state entirely. */ emptyContent?: ReactNode; isLoading?: boolean; loadingLabel?: string; /** * Optional function to get a stable key for each row. * If not provided, index will be used (not recommended for paginated/dynamic data). */ rowKey?: (item: TData, index: number) => React.Key; }`
- propiedades detectadas:
  - `children`: `(props: { item: TData; index: number; }) => React.ReactNode | ReactNode`
  - `data?`: `TData[]`
  - `className?`: `string`
  - `emptyText?`: `string`
  - `emptyContent?`: `ReactNode`
  - `isLoading?`: `boolean`
  - `loadingLabel?`: `string`
  - `rowKey?`: `(item: TData, index: number) => React.Key`

### `TableBodyRowProps`

- firma: `export interface TableBodyRowProps { className?: string; children: ReactNode; keyCurrent: TableKeyCurrent; onChangeCheck?: (keyCurrent: TableKeyCurrent, value: boolean) => void; style?: React.CSSProperties; // ======== disabled?: boolean; isCheck?: boolean; }`
- propiedades detectadas:
  - `className?`: `string`
  - `children`: `ReactNode`
  - `keyCurrent`: `TableKeyCurrent`
  - `onChangeCheck?`: `(keyCurrent: TableKeyCurrent, value: boolean) => void`
  - `style?`: `React.CSSProperties`
  - `disabled?`: `boolean`
  - `isCheck?`: `boolean`

### `TableBodyColumnProps`

- firma: `export interface TableBodyColumnProps { className?: string; text?: string; children?: ReactNode; style?: React.CSSProperties; colspan?: number; }`
- propiedades detectadas:
  - `className?`: `string`
  - `text?`: `string`
  - `children?`: `ReactNode`
  - `style?`: `React.CSSProperties`
  - `colspan?`: `number`

### `TableHOCContainerProps`

- firma: `export interface TableHOCContainerProps<TData> { (props: TableProps): JSX.Element; Header: FC<TableHeaderProps>; HeaderRow: FC<TableHeaderRowProps>; HeaderColumn: FC<TableHeaderColumnProps>; SearchRow: FC<TableSearchRowProps>; SearchColumn: FC<TableSearchColumnProps>; Body: FC<TableBodyProps<TData>>; BodyRow: FC<TableBodyRowProps>; BodyColumn: FC<TableBodyColumnProps>; }`
- propiedades detectadas:
  - `Header`: `FC<TableHeaderProps>`
  - `HeaderRow`: `FC<TableHeaderRowProps>`
  - `HeaderColumn`: `FC<TableHeaderColumnProps>`
  - `SearchRow`: `FC<TableSearchRowProps>`
  - `SearchColumn`: `FC<TableSearchColumnProps>`
  - `Body`: `FC<TableBodyProps<TData>>`
  - `BodyRow`: `FC<TableBodyRowProps>`
  - `BodyColumn`: `FC<TableBodyColumnProps>`

### `ExcludeType`

- firma: `export type ExcludeType<T, U extends string | number | symbol> = T extends U ? never : T;`
- hereda o referencia: `T extends U ? never : T`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ColorProps`

- firma: `export type ColorProps = "primary" | "secondary" | "success" | "warning" | "danger" | "default";`
- hereda o referencia: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.
## Funciones exportadas

- `useColumnResize`: `export function useColumnResize({ columnId, initialWidth = 150, minWidth = 80, maxWidth = 800, onResize, onResizeEnd, }: UseColumnResizeProps): unknown`

## Demos y variaciones reales

### `lizaui/src/demo/table-multi-sort-demo.tsx`
- demos/componentes locales: `TableMultiSortDemo`
- componentes usados: `Table`
- props vistas en demos: `Table.dataHeader=columns`, `Table.sortDescriptor=sortDescriptor`, `Table.onSortChange=handleSort`, `Table.isChecks=false`, `Table.isActions=false`, `Table.header=item`, `Table.data=sortedUsers`, `Table.keyCurrent={ id: item.id, name: item.name, value: item `

### `lizaui/src/demo/table-resize-demo.tsx`
- demos/componentes locales: `TableResizeDemo`
- componentes usados: `Table`
- props vistas en demos: `Table.dataHeader=columns`, `Table.selectKeys=selectKeys`, `Table.sortDescriptor=sortDescriptor`, `Table.onSortChange=handleSort`, `Table.columnWidths=columnWidths`, `Table.onColumnResize=handleColumnResize`, `Table.onColumnResizeEnd=handleColumnResizeEnd`, `Table.isChecks=true`, `Table.isStickyChecks=true`, `Table.isActions=true`, `Table.isStickyAction=true`, `Table.actionLabel=Acciones`, `Table.hiddenColumns=hiddenColumns`, `Table.color=primary`, `Table.dataHeader=columns`, `Table.valueCheck=true`, `Table.data=true`, `Table.data=true`
## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `clsx`, `lucide-react`, `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Table } from "lizaui/table";

export function ExampleTable() {
	return <Table color="primary" />;
}
```

## Archivos fuente

- `lizaui/src/components/table/body/table-body-column.tsx`
- `lizaui/src/components/table/body/table-body-row.tsx`
- `lizaui/src/components/table/body/table-body.tsx`
- `lizaui/src/components/table/body/table-empty-state.tsx`
- `lizaui/src/components/table/context/pinned-cell.context.tsx`
- `lizaui/src/components/table/context/table.context.tsx`
- `lizaui/src/components/table/header/resize-handle.tsx`
- `lizaui/src/components/table/header/table-header-column.tsx`
- `lizaui/src/components/table/header/table-header-row.tsx`
- `lizaui/src/components/table/header/table-header.tsx`
- `lizaui/src/components/table/hook/use-column-resize.tsx`
- `lizaui/src/components/table/hook/use-sticky-columns.tsx`
- `lizaui/src/components/table/hook/use-table-context.tsx`
- `lizaui/src/components/table/hook/use-table.tsx`
- `lizaui/src/components/table/index.ts`
- `lizaui/src/components/table/interface/table-share.interface.ts`
- `lizaui/src/components/table/interface/table.interface.ts`
- `lizaui/src/components/table/search/table-search-column.tsx`
- `lizaui/src/components/table/search/table-search-row.tsx`
- `lizaui/src/components/table/table.tsx`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
