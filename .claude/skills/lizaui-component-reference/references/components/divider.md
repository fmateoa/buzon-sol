# Divider

- tipo: componente
- import recomendado: `lizaui/divider`
- export principal sugerido: `Divider`

## Resumen

Esta referencia documenta la superficie pública de `divider` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Divider`
- `DividerProps`

## Props y tipos clave

### `DividerProps`

- firma: `export interface DividerProps extends Omit<UseDividerProps, "children"> { }`
- hereda o referencia: `Omit<UseDividerProps, "children">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `HTMLHeroUIProps`

- firma: `interface HTMLHeroUIProps<T extends keyof JSX.IntrinsicElements> extends React.HTMLAttributes<HTMLElement> { as?: T | React.ElementType; className?: string; }`
- hereda o referencia: `React.HTMLAttributes<HTMLElement>`
- propiedades detectadas:
  - `as?`: `T | React.ElementType`
  - `className?`: `string`

### `PropGetter`

- firma: `type PropGetter = (props?: Record<string, any>) => Record<string, any>;`
- hereda o referencia: `(props?: Record<string, any>) => Record<string, any>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Props`

- firma: `interface Props extends HTMLHeroUIProps<"hr"> { ref?: Ref<HTMLElement>; }`
- hereda o referencia: `HTMLHeroUIProps<"hr">`
- propiedades detectadas:
  - `ref?`: `Ref<HTMLElement>`

### `UseDividerProps`

- firma: `export type UseDividerProps = Props & DividerVariantProps & Omit<AriaSeparatorProps, "elementType">;`
- hereda o referencia: `Props`, `DividerVariantProps`, `Omit<AriaSeparatorProps, "elementType">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `UseDividerReturn`

- firma: `export type UseDividerReturn = ReturnType<typeof useDivider>;`
- hereda o referencia: `ReturnType<typeof useDivider>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Orientation`

- firma: `export type Orientation = "horizontal" | "vertical";`
- hereda o referencia: `"horizontal" | "vertical"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SeparatorProps`

- firma: `export interface SeparatorProps extends HTMLAttributes<HTMLElement> { /** * The orientation of the separator. * @default "horizontal" */ orientation?: Orientation; /** * Whether to use the `Slot` component from Radix UI instead of rendering a default tag. */ asChild?: boolean; }`
- hereda o referencia: `HTMLAttributes<HTMLElement>`
- propiedades detectadas:
  - `orientation?`: `Orientation`
  - `asChild?`: `boolean`

### `SeparatorAria`

- firma: `export interface SeparatorAria { separatorProps: HTMLAttributes<HTMLElement>; Separator: React.ElementType; }`
- propiedades detectadas:
  - `separatorProps`: `HTMLAttributes<HTMLElement>`
  - `Separator`: `React.ElementType`

### `DividerVariantProps`

- firma: `export type DividerVariantProps = VariantProps<typeof divider>;`
- hereda o referencia: `VariantProps<typeof divider>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.
## Funciones exportadas

- `useDivider`: `export function useDivider(props: UseDividerProps): unknown`
- `useSeparator`: `export function useSeparator(props: SeparatorProps): SeparatorAria`
## Variantes detectadas

### `divider`
- fuente: `lizaui/src/theme/color/divider.ts`
- `orientation`: `horizontal`, `vertical`; default: `horizontal`

## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-slot`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Divider } from "lizaui/divider";

export function ExampleDivider() {
	return <Divider />;
}
```

## Archivos fuente

- `lizaui/src/components/divider/divider.tsx`
- `lizaui/src/components/divider/index.ts`
- `lizaui/src/components/divider/use-divider.ts`
- `lizaui/src/components/divider/use-separator.ts`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/divider.ts`
