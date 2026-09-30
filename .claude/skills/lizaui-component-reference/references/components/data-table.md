# Data Table

- tipo: componente
- import recomendado: `lizaui/data-table`
- export principal sugerido: `Table`

## Resumen

Esta referencia documenta la superficie pública de `data-table` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `DataTable`
- `Table`
- `TableBody`
- `TableBodyProps`
- `TableCell`
- `TableCellProps`
- `TableCollection`
- `TableColumn`
- `TableColumnProps`
- `TableColumnResizer`
- `TableColumnResizerProps`
- `TableContent`
- `TableContentProps`
- `TableFooter`
- `TableFooterProps`
- `TableHeader`
- `TableHeaderProps`
- `TableLoadMoreContent`
- `TableLoadMoreContentProps`
- `TableLoadMoreItem`
- `TableLoadMoreItemProps`
- `TableProps`
- `TableResizableContainer`
- `TableResizableContainerProps`
- `TableRoot`
- `TableRootProps`
- `TableRow`
- `TableRowProps`
- `TableScrollContainer`
- `TableScrollContainerProps`
- `tableVariants`
- `TableVariants`

## Props y tipos clave

### `TableRootProps`

- firma: `interface TableRootProps extends ComponentPropsWithRef<"div">, TableVariants { className?: string; children?: React.ReactNode; }`
- hereda o referencia: `ComponentPropsWithRef<"div">`, `TableVariants`
- propiedades detectadas:
  - `className?`: `string`
  - `children?`: `React.ReactNode`

### `TableScrollContainerProps`

- firma: `interface TableScrollContainerProps extends ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableContentProps`

- firma: `interface TableContentProps extends Omit<TablePrimitiveProps, "className"> { className?: string; }`
- hereda o referencia: `Omit<TablePrimitiveProps, "className">`
- propiedades detectadas:
  - `className?`: `string`

### `TableHeaderProps`

- firma: `type TableHeaderProps<T extends object> = TableHeaderPrimitiveProps<T>;`
- hereda o referencia: `TableHeaderPrimitiveProps<T>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableColumnProps`

- firma: `type TableColumnProps = ColumnPrimitiveProps;`
- hereda o referencia: `ColumnPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableBodyProps`

- firma: `type TableBodyProps<T extends object> = TableBodyPrimitiveProps<T>;`
- hereda o referencia: `TableBodyPrimitiveProps<T>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableRowProps`

- firma: `type TableRowProps<T extends object> = React.ComponentProps<typeof RowPrimitive<T>>;`
- hereda o referencia: `React.ComponentProps<typeof RowPrimitive<T>>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableCellProps`

- firma: `type TableCellProps = CellPrimitiveProps;`
- hereda o referencia: `CellPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableFooterProps`

- firma: `interface TableFooterProps extends ComponentPropsWithRef<"div"> { className?: string; }`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas:
  - `className?`: `string`

### `TableResizableContainerProps`

- firma: `type TableResizableContainerProps = React.ComponentProps<typeof ResizableTableContainerPrimitive>;`
- hereda o referencia: `React.ComponentProps<typeof ResizableTableContainerPrimitive>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableColumnResizerProps`

- firma: `type TableColumnResizerProps = React.ComponentProps<typeof ColumnResizerPrimitive>;`
- hereda o referencia: `React.ComponentProps<typeof ColumnResizerPrimitive>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableLoadMoreItemProps`

- firma: `type TableLoadMoreItemProps = TableLoadMoreItemPrimitiveProps;`
- hereda o referencia: `TableLoadMoreItemPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableLoadMoreContentProps`

- firma: `interface TableLoadMoreContentProps extends ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Table`

- firma: `export type Table = { Props: ComponentProps<typeof TableRoot>; RootProps: ComponentProps<typeof TableRoot>; ScrollContainerProps: ComponentProps<typeof TableScrollContainer>; ContentProps: ComponentProps<typeof TableContent>; HeaderProps: ComponentProps<typeof TableHeader>; ColumnProps: ComponentProps<typeof TableColumn>; ColumnResizerProps: ComponentProps<typeof TableColumnResizer>; BodyProps: ComponentProps<typeof TableBody>; RowProps: ComponentProps<typeof TableRow>; CellProps: ComponentProps<typeof TableCell>; FooterProps: ComponentProps<typeof TableFooter>; LoadMoreProps: ComponentProps<typeof TableLoadMoreItem>; LoadMoreContentProps: ComponentProps<typeof TableLoadMoreContent>; ResizableContainerProps: ComponentProps<typeof TableResizableContainer>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof TableRoot>`
  - `RootProps`: `ComponentProps<typeof TableRoot>`
  - `ScrollContainerProps`: `ComponentProps<typeof TableScrollContainer>`
  - `ContentProps`: `ComponentProps<typeof TableContent>`
  - `HeaderProps`: `ComponentProps<typeof TableHeader>`
  - `ColumnProps`: `ComponentProps<typeof TableColumn>`
  - `ColumnResizerProps`: `ComponentProps<typeof TableColumnResizer>`
  - `BodyProps`: `ComponentProps<typeof TableBody>`
  - `RowProps`: `ComponentProps<typeof TableRow>`
  - `CellProps`: `ComponentProps<typeof TableCell>`
  - `FooterProps`: `ComponentProps<typeof TableFooter>`
  - `LoadMoreProps`: `ComponentProps<typeof TableLoadMoreItem>`
  - `LoadMoreContentProps`: `ComponentProps<typeof TableLoadMoreContent>`
  - `ResizableContainerProps`: `ComponentProps<typeof TableResizableContainer>`

### `TableSortDescriptor`

- firma: `export interface TableSortDescriptor { /** The key of the column to sort by. */ column: string | number; /** The direction to sort by. */ direction: SortDirection; }`
- propiedades detectadas:
  - `column`: `string | number`
  - `direction`: `SortDirection`

### `SortDirection`

- firma: `export type SortDirection = "ascending" | "descending";`
- hereda o referencia: `"ascending" | "descending"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `TableVariants`

- firma: `export type TableVariants = Omit<VariantProps<typeof tableVariants>, TableRenderPropsKeys>;`
- hereda o referencia: `Omit<VariantProps<typeof tableVariants>, TableRenderPropsKeys>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `tableVariants`
- fuente: `lizaui/src/theme/color/data-table.ts`
- `variant`: `primary`, `secondary`; default: `primary`
## Demos y variaciones reales

### `lizaui/src/demo/data-table-demo.tsx`
- demos/componentes locales: `DataTableDemo`
- componentes usados: `DataTable`
- props vistas en demos: `DataTable.aria-label=Sortable table`, `DataTable.sortDescriptor=sortDescriptor`, `DataTable.onSortChange=setSortDescriptor`, `DataTable.allowsSorting=true`, `DataTable.isRowHeader=true`, `DataTable.id=name`, `DataTable.allowsSorting=true`, `DataTable.id=role`, `DataTable.allowsSorting=true`, `DataTable.id=status`, `DataTable.allowsSorting=true`, `DataTable.id=email`, `DataTable.id=user.id`

### `lizaui/src/demo/table-multi-sort-demo.tsx`
- demos/componentes locales: `TableMultiSortDemo`
- componentes usados: `Table`
- props vistas en demos: `Table.dataHeader=columns`, `Table.sortDescriptor=sortDescriptor`, `Table.onSortChange=handleSort`, `Table.isChecks=false`, `Table.isActions=false`, `Table.header=item`, `Table.data=sortedUsers`, `Table.keyCurrent={ id: item.id, name: item.name, value: item `

### `lizaui/src/demo/table-resize-demo.tsx`
- demos/componentes locales: `TableResizeDemo`
- componentes usados: `Table`
- props vistas en demos: `Table.dataHeader=columns`, `Table.selectKeys=selectKeys`, `Table.sortDescriptor=sortDescriptor`, `Table.onSortChange=handleSort`, `Table.columnWidths=columnWidths`, `Table.onColumnResize=handleColumnResize`, `Table.onColumnResizeEnd=handleColumnResizeEnd`, `Table.isChecks=true`, `Table.isStickyChecks=true`, `Table.isActions=true`, `Table.isStickyAction=true`, `Table.actionLabel=Acciones`, `Table.hiddenColumns=hiddenColumns`, `Table.color=primary`, `Table.dataHeader=columns`, `Table.valueCheck=true`, `Table.data=true`, `Table.data=true`
## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "lizaui/data-table";

const rows = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }];

export function ExampleDataTable() {
	return (
		<Table aria-label="Usuarios">
			<TableHeader>
				<TableColumn id="name" isRowHeader>Nombre</TableColumn>
			</TableHeader>
			<TableBody items={rows}>
				{(item) => <TableRow>{<TableCell>{item.name}</TableCell>}</TableRow>}
			</TableBody>
		</Table>
	);
}
```

## Archivos fuente

- `lizaui/src/components/data-table/data-table.tsx`
- `lizaui/src/components/data-table/index.ts`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/data-table.ts`
