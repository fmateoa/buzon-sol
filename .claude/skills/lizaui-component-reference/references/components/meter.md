# Meter

- tipo: componente
- import recomendado: `lizaui/meter`
- export principal sugerido: `Meter`

## Resumen

Esta referencia documenta la superficie pública de `meter` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Meter`
- `MeterFill`
- `MeterFillProps`
- `MeterOutput`
- `MeterOutputProps`
- `MeterProps`
- `MeterRoot`
- `MeterRootProps`
- `MeterTrack`
- `MeterTrackProps`
- `meterVariants`
- `MeterVariants`

## Props y tipos clave

### `Meter`

- firma: `export type Meter = { Props: ComponentProps<typeof MeterRoot>; RootProps: ComponentProps<typeof MeterRoot>; OutputProps: ComponentProps<typeof MeterOutput>; TrackProps: ComponentProps<typeof MeterTrack>; FillProps: ComponentProps<typeof MeterFill>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof MeterRoot>`
  - `RootProps`: `ComponentProps<typeof MeterRoot>`
  - `OutputProps`: `ComponentProps<typeof MeterOutput>`
  - `TrackProps`: `ComponentProps<typeof MeterTrack>`
  - `FillProps`: `ComponentProps<typeof MeterFill>`

### `MeterContextValue`

- firma: `interface MeterContextValue { slots?: ReturnType<typeof meterVariants>; state?: MeterRenderProps; }`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof meterVariants>`
  - `state?`: `MeterRenderProps`

### `MeterRootProps`

- firma: `type MeterRootProps = ComponentPropsWithRef<typeof MeterPrimitive> & MeterVariants;`
- hereda o referencia: `ComponentPropsWithRef<typeof MeterPrimitive>`, `MeterVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `MeterOutputProps`

- firma: `type MeterOutputProps = ComponentPropsWithRef<"span"> & { children?: ReactNode; };`
- hereda o referencia: `ComponentPropsWithRef<"span">`
- propiedades detectadas:
  - `children?`: `ReactNode`

### `MeterTrackProps`

- firma: `type MeterTrackProps = ComponentPropsWithRef<"div"> & { children?: ReactNode; };`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas:
  - `children?`: `ReactNode`

### `MeterFillProps`

- firma: `type MeterFillProps = ComponentPropsWithRef<"div"> & { children?: ReactNode; style?: CSSProperties; };`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas:
  - `children?`: `ReactNode`
  - `style?`: `CSSProperties`

### `MeterVariants`

- firma: `export type MeterVariants = VariantProps<typeof meterVariants>;`
- hereda o referencia: `VariantProps<typeof meterVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `meterVariants`
- fuente: `lizaui/src/theme/color/meter.ts`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `primary`
- `size`: `sm`, `md`, `lg`; default: `md`

## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `react-aria-components/Meter`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Meter, MeterOutput, MeterTrack, MeterFill } from "lizaui/meter";

export function ExampleMeter() {
	return (
		<Meter value={65} minValue={0} maxValue={100} color="primary">
			<MeterOutput />
			<MeterTrack><MeterFill /></MeterTrack>
		</Meter>
	);
}
```

## Archivos fuente

- `lizaui/src/components/meter/index.ts`
- `lizaui/src/components/meter/meter.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/meter.ts`
