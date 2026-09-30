# Chip

- tipo: componente
- import recomendado: `lizaui/chip`
- export principal sugerido: `Chip`

## Resumen

Esta referencia documenta la superficie pública de `chip` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Chip`
- `ChipProps`
- `useChip`

## Props y tipos clave

### `ChipProps`

- firma: `export type ChipProps = Omit<UseChipProps, "isOneChar" | "isCloseButtonFocusVisible">;`
- hereda o referencia: `Omit<UseChipProps, "isOneChar" | "isCloseButtonFocusVisible">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `UseChipProps`

- firma: `export type UseChipProps = React.ComponentPropsWithoutRef<"div"> & VariantProps<typeof chip> & { ref?: React.Ref<HTMLDivElement>; classNames?: Partial<Record<keyof ReturnType<typeof chip>, string>>; startContent?: React.ReactNode; endContent?: React.ReactNode; children?: React.ReactNode; isDot?: boolean; onClose?: () => void; };`
- hereda o referencia: `React.ComponentPropsWithoutRef<"div">`, `VariantProps<typeof chip>`
- propiedades detectadas:
  - `ref?`: `React.Ref<HTMLDivElement>`
  - `classNames?`: `Partial<Record<keyof ReturnType<typeof chip>, string>>`
  - `startContent?`: `React.ReactNode`
  - `endContent?`: `React.ReactNode`
  - `children?`: `React.ReactNode`
  - `isDot?`: `boolean`
  - `onClose?`: `() => void`
## Funciones exportadas

- `useChip`: `export function useChip(props: UseChipProps): unknown`
## Variantes detectadas

### `chip`
- fuente: `lizaui/src/theme/color/chip.ts`
- `variant`: `solid`, `bordered`, `light`, `flat`, `faded`, `shadow`, `dot`; default: `solid`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `default`
- `size`: `sm`, `md`, `lg`; default: `md`
- `radius`: `none`, `sm`, `md`, `lg`, `full`; default: `full`
- `isOneChar`: `true`, `false`
- `isCloseable`: `true`, `false`
- `hasStartContent`: `true`
- `hasEndContent`: `true`
- `isDisabled`: `true`; default: `false`
- `isCloseButtonFocusVisible`: `true`

### `tableVariants`
- fuente: `lizaui/src/theme/color/data-table.ts`
- `variant`: `primary`, `secondary`; default: `primary`

### `switchGroupVariants`
- fuente: `lizaui/src/theme/color/switch-group-v2.ts`
- `orientation`: `horizontal`, `vertical`; default: `vertical`

### `switchVariants`
- fuente: `lizaui/src/theme/color/toggle-switch.ts`
- `size`: `lg`, `md`, `sm`; default: `md`

## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `clsx`, `react`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Chip } from "lizaui/chip";

export function ExampleChip() {
	return <Chip />;
}
```

## Archivos fuente

- `lizaui/src/components/chip/chip.tsx`
- `lizaui/src/components/chip/index.ts`
- `lizaui/src/components/chip/use-chip.ts`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/theme/color/chip.ts`
- `lizaui/src/theme/color/data-table.ts`
- `lizaui/src/theme/color/slider.ts`
- `lizaui/src/theme/color/switch-group-v2.ts`
- `lizaui/src/theme/color/toggle-switch.ts`
- `lizaui/src/theme/index.ts`
- `lizaui/src/theme/variants.ts`
