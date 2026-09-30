# Pagination

- tipo: componente
- import recomendado: `lizaui/pagination`
- export principal sugerido: `Pagination`

## Resumen

Esta referencia documenta la superficie pública de `pagination` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Pagination`
- `PaginationSetValueProps`
- `PaginationValueProps`
- `usePagination`

## Props y tipos clave

### `PaginationValueProps`

- firma: `export interface PaginationValueProps { total: number; limit: number; page: number; siblings: number; }`
- propiedades detectadas:
  - `total`: `number`
  - `limit`: `number`
  - `page`: `number`
  - `siblings`: `number`

### `PaginationSetValueProps`

- firma: `export interface PaginationSetValueProps extends Pick<PaginationValueProps, "page" | "limit"> { text?: string; }`
- hereda o referencia: `Pick<PaginationValueProps, "page" | "limit">`
- propiedades detectadas:
  - `text?`: `string`

### `PaginationProps`

- firma: `export interface PaginationProps extends Partial<Omit<PaginationValueProps, "total">>, Pick<PaginationValueProps, "total"> { className?: string; color?: ExcludeType<ColorProps, "secondary">; onChange?: (value: Pick<PaginationValueProps, "page" | "limit">) => void; isLimitSelect?: boolean; dataLimit?: number[]; translate?: { selectLimit?: string; rowPerPage?: string; of?: string; }; }`
- hereda o referencia: `Partial<Omit<PaginationValueProps, "total">>`, `Pick<PaginationValueProps, "total">`
- propiedades detectadas:
  - `className?`: `string`
  - `color?`: `ExcludeType<ColorProps, "secondary">`
  - `onChange?`: `(value: Pick<PaginationValueProps, "page" | "limit">) => void`
  - `isLimitSelect?`: `boolean`
  - `dataLimit?`: `number[]`
  - `translate?`: `{ selectLimit?: string; rowPerPage?: string; of?: string; }`

### `PaginationItemProps`

- firma: `export interface PaginationItemProps { className?: string; color?: ExcludeType<ColorProps, "secondary">; active?: boolean; children?: ReactNode; text?: string | number; onClick: () => void; }`
- propiedades detectadas:
  - `className?`: `string`
  - `color?`: `ExcludeType<ColorProps, "secondary">`
  - `active?`: `boolean`
  - `children?`: `ReactNode`
  - `text?`: `string | number`
  - `onClick`: `() => void`

### `UsePaginationProps`

- firma: `export interface UsePaginationProps { initialPage?: number; initialLimit?: number; }`
- propiedades detectadas:
  - `initialPage?`: `number`
  - `initialLimit?`: `number`

### `PaginationHookProps`

- firma: `export interface PaginationHookProps extends Pick<PaginationValueProps, "page" | "limit"> { handleSetPagination: (parameter: Pick<PaginationValueProps, "page" | "limit">) => void; }`
- hereda o referencia: `Pick<PaginationValueProps, "page" | "limit">`
- propiedades detectadas:
  - `handleSetPagination`: `(parameter: Pick<PaginationValueProps, "page" | "limit">) => void`

### `ExcludeType`

- firma: `export type ExcludeType<T, U extends string | number | symbol> = T extends U ? never : T;`
- hereda o referencia: `T extends U ? never : T`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ColorProps`

- firma: `export type ColorProps = "primary" | "secondary" | "success" | "warning" | "danger" | "default";`
- hereda o referencia: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.


## Demos y variaciones reales

### `lizaui/src/demo/pagination-demo.tsx`
- demos/componentes locales: `PaginationDemo`
- variaciones visibles: `Colores disponibles`, `Primary`, `Success`, `Danger`, `Warning`, `Default`, `Comportamiento`, `Con selector de límite`, `Sin selector de límite`, `Siblings = 0`, `Siblings = 2`, `Etiquetas personalizadas`, `Hook usePagination`, `Estados de borde`, `Sin resultados`, `Una sola página`
- componentes usados: `Pagination`
- props vistas en demos: `Pagination.color=color`, `Pagination.total=total`, `Pagination.page=pagination.page`, `Pagination.limit=pagination.limit`, `Pagination.siblings=siblings`, `Pagination.isLimitSelect=isLimitSelect`, `Pagination.dataLimit=dataLimit`, `Pagination.translate=translate`, `Pagination.onChange=setPagination`, `Pagination.color=primary`, `Pagination.total=95`, `Pagination.page=compactPagination.page`, `Pagination.limit=compactPagination.limit`, `Pagination.dataLimit=[5, 10, 15, 20]`, `Pagination.onChange=compactPagination.handleSetPagination`
## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `clsx`, `react`, `react-icons/io`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Pagination } from "lizaui/pagination";

export function ExamplePagination() {
	return <Pagination color="primary" />;
}
```

## Archivos fuente

- `lizaui/src/components/pagination/function/index.ts`
- `lizaui/src/components/pagination/hook/use-pagination.tsx`
- `lizaui/src/components/pagination/index.ts`
- `lizaui/src/components/pagination/interface/pagination-share.interface.ts`
- `lizaui/src/components/pagination/interface/pagination.interface.ts`
- `lizaui/src/components/pagination/pagination-item.tsx`
- `lizaui/src/components/pagination/pagination.tsx`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
