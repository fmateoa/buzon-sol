# Badge

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Badge`

## Resumen

Esta referencia documenta la superficie pública de `badge` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `absoluteFullClasses`
- `Badge`
- `BadgeProps`
- `BadgeVariantProps`
- `baseStyles`
- `collapseAdjacentVariantBorders`
- `colorVariants`
- `COMMON_UNITS`
- `dataFocusVisibleClasses`
- `focusVisibleClasses`
- `groupDataFocusVisibleClasses`
- `hiddenInputClasses`
- `ringClasses`
- `sliderVariants`
- `SliderVariants`
- `switchGroupVariants`
- `SwitchGroupVariants`
- `switchVariants`
- `SwitchVariants`
- `tableVariants`
- `TableVariants`
- `translateCenterClasses`
- `tv`
- `twMergeConfig`

## Props y tipos clave

### `BadgeVariantProps`

- firma: `export type BadgeVariantProps = VariantProps<typeof badge>;`
- hereda o referencia: `VariantProps<typeof badge>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `BadgeProps`

- firma: `export type BadgeProps = React.ComponentPropsWithoutRef<"span"> & BadgeVariantProps & { content?: React.ReactNode; className?: string; };`
- hereda o referencia: `React.ComponentPropsWithoutRef<"span">`, `BadgeVariantProps`
- propiedades detectadas:
  - `content?`: `React.ReactNode`
  - `className?`: `string`

### `TableVariants`

- firma: `export type TableVariants = Omit<VariantProps<typeof tableVariants>, TableRenderPropsKeys>;`
- hereda o referencia: `Omit<VariantProps<typeof tableVariants>, TableRenderPropsKeys>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderVariants`

- firma: `export type SliderVariants = VariantProps<typeof sliderVariants>;`
- hereda o referencia: `VariantProps<typeof sliderVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchGroupVariants`

- firma: `export type SwitchGroupVariants = VariantProps<typeof switchGroupVariants>;`
- hereda o referencia: `VariantProps<typeof switchGroupVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchVariants`

- firma: `export type SwitchVariants = VariantProps<typeof switchVariants>;`
- hereda o referencia: `VariantProps<typeof switchVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `badge`
- fuente: `lizaui/src/components/ui/badge.tsx`
- `variant`: `solid`, `flat`, `faded`, `shadow`; default: `solid`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `default`
- `size`: `sm`, `md`, `lg`; default: `md`
- `placement`: `top-right`, `top-left`, `bottom-right`, `bottom-left`; default: `top-right`
- `shape`: `circle`, `rectangle`; default: `rectangle`
- `isInvisible`: `true`; default: `false`
- `isOneChar`: `true`
- `isDot`: `true`
- `disableAnimation`: `true`, `false`
- `showOutline`: `true`, `false`; default: `true`

### `tableVariants`
- fuente: `lizaui/src/theme/color/data-table.ts`
- `variant`: `primary`, `secondary`; default: `primary`

### `switchGroupVariants`
- fuente: `lizaui/src/theme/color/switch-group-v2.ts`
- `orientation`: `horizontal`, `vertical`; default: `vertical`

### `switchVariants`
- fuente: `lizaui/src/theme/color/toggle-switch.ts`
- `size`: `lg`, `md`, `sm`; default: `md`
## Demos y variaciones reales

### `lizaui/src/demo/badge-demo.tsx`
- demos/componentes locales: `BadgeDemo`
- componentes usados: `Badge`
- props vistas en demos: `Badge.color=danger`, `Badge.variant=solid`, `Badge.content=+34`, `Badge.shape=circle`, `Badge.color=danger`, `Badge.variant=solid`, `Badge.content=+34`, `Badge.placement=bottom-left`, `Badge.shape=rectangle`
## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Badge } from "lizaui/ui";

export function ExampleBadge() {
	return <Badge />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/badge.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/theme/color/data-table.ts`
- `lizaui/src/theme/color/slider.ts`
- `lizaui/src/theme/color/switch-group-v2.ts`
- `lizaui/src/theme/color/toggle-switch.ts`
- `lizaui/src/theme/index.ts`
- `lizaui/src/theme/variants.ts`
