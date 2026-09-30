# Progress Bar

- tipo: componente
- import recomendado: `lizaui/progress-bar`
- export principal sugerido: `ProgressBar`

## Resumen

Esta referencia documenta la superficie pública de `progress-bar` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `ProgressBar`
- `ProgressBarFill`
- `ProgressBarFillProps`
- `ProgressBarOutput`
- `ProgressBarOutputProps`
- `ProgressBarProps`
- `ProgressBarRoot`
- `ProgressBarRootProps`
- `ProgressBarTrack`
- `ProgressBarTrackProps`
- `progressBarVariants`
- `ProgressBarVariants`

## Props y tipos clave

### `ProgressBar`

- firma: `export type ProgressBar = { Props: ComponentProps<typeof ProgressBarRoot>; RootProps: ComponentProps<typeof ProgressBarRoot>; OutputProps: ComponentProps<typeof ProgressBarOutput>; TrackProps: ComponentProps<typeof ProgressBarTrack>; FillProps: ComponentProps<typeof ProgressBarFill>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof ProgressBarRoot>`
  - `RootProps`: `ComponentProps<typeof ProgressBarRoot>`
  - `OutputProps`: `ComponentProps<typeof ProgressBarOutput>`
  - `TrackProps`: `ComponentProps<typeof ProgressBarTrack>`
  - `FillProps`: `ComponentProps<typeof ProgressBarFill>`

### `ProgressBarContextValue`

- firma: `interface ProgressBarContextValue { slots?: ReturnType<typeof progressBarVariants>; state?: ProgressBarRenderProps; }`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof progressBarVariants>`
  - `state?`: `ProgressBarRenderProps`

### `ProgressBarRootProps`

- firma: `type ProgressBarRootProps = ComponentPropsWithRef<typeof ProgressBarPrimitive> & ProgressBarVariants;`
- hereda o referencia: `ComponentPropsWithRef<typeof ProgressBarPrimitive>`, `ProgressBarVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ProgressBarOutputProps`

- firma: `type ProgressBarOutputProps = ComponentPropsWithRef<"span"> & { children?: ReactNode; };`
- hereda o referencia: `ComponentPropsWithRef<"span">`
- propiedades detectadas:
  - `children?`: `ReactNode`

### `ProgressBarTrackProps`

- firma: `type ProgressBarTrackProps = ComponentPropsWithRef<"div"> & { children?: ReactNode; };`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas:
  - `children?`: `ReactNode`

### `ProgressBarFillProps`

- firma: `type ProgressBarFillProps = ComponentPropsWithRef<"div"> & { children?: ReactNode; style?: CSSProperties; };`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas:
  - `children?`: `ReactNode`
  - `style?`: `CSSProperties`

### `ProgressBarVariants`

- firma: `export type ProgressBarVariants = VariantProps<typeof progressBarVariants>;`
- hereda o referencia: `VariantProps<typeof progressBarVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `progressBarVariants`
- fuente: `lizaui/src/theme/color/progress-bar.ts`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `primary`
- `size`: `sm`, `md`, `lg`; default: `md`

## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `react-aria-components/ProgressBar`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { ProgressBar, ProgressBarOutput, ProgressBarTrack, ProgressBarFill } from "lizaui/progress-bar";

export function ExampleProgressBar() {
	return (
		<ProgressBar value={45} color="success">
			<ProgressBarOutput />
			<ProgressBarTrack><ProgressBarFill /></ProgressBarTrack>
		</ProgressBar>
	);
}
```

## Archivos fuente

- `lizaui/src/components/progress-bar/index.ts`
- `lizaui/src/components/progress-bar/progress-bar.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/progress-bar.ts`
