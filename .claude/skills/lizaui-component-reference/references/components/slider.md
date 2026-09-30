# Slider

- tipo: componente
- import recomendado: `lizaui/slider`
- export principal sugerido: `Slider`

## Resumen

Esta referencia documenta la superficie pública de `slider` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Slider`
- `SliderFill`
- `SliderFillProps`
- `SliderMarks`
- `SliderMarksProps`
- `SliderOutput`
- `SliderOutputProps`
- `SliderProps`
- `SliderRoot`
- `SliderRootProps`
- `SliderThumb`
- `SliderThumbProps`
- `SliderTrack`
- `SliderTrackProps`
- `sliderVariants`
- `SliderVariants`

## Props y tipos clave

### `Slider`

- firma: `export type Slider = { Props: ComponentProps<typeof SliderRoot>; RootProps: ComponentProps<typeof SliderRoot>; OutputProps: ComponentProps<typeof SliderOutput>; TrackProps: ComponentProps<typeof SliderTrack>; FillProps: ComponentProps<typeof SliderFill>; ThumbProps: ComponentProps<typeof SliderThumb>; MarksProps: ComponentProps<typeof SliderMarks>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof SliderRoot>`
  - `RootProps`: `ComponentProps<typeof SliderRoot>`
  - `OutputProps`: `ComponentProps<typeof SliderOutput>`
  - `TrackProps`: `ComponentProps<typeof SliderTrack>`
  - `FillProps`: `ComponentProps<typeof SliderFill>`
  - `ThumbProps`: `ComponentProps<typeof SliderThumb>`
  - `MarksProps`: `ComponentProps<typeof SliderMarks>`

### `SliderContextValue`

- firma: `interface SliderContextValue { slots?: ReturnType<typeof sliderVariants>; state?: SliderRenderProps; }`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof sliderVariants>`
  - `state?`: `SliderRenderProps`

### `SliderRootProps`

- firma: `type SliderRootProps = SliderPrimitiveProps & SliderVariants;`
- hereda o referencia: `SliderPrimitiveProps`, `SliderVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderOutputProps`

- firma: `type SliderOutputProps = SliderOutputPrimitiveProps;`
- hereda o referencia: `SliderOutputPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderTrackProps`

- firma: `type SliderTrackProps = SliderTrackPrimitiveProps;`
- hereda o referencia: `SliderTrackPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderFillProps`

- firma: `interface SliderFillProps extends React.ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderThumbProps`

- firma: `type SliderThumbProps = SliderThumbPrimitiveProps;`
- hereda o referencia: `SliderThumbPrimitiveProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderMarksProps`

- firma: `interface SliderMarksProps extends React.ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SliderVariants`

- firma: `export type SliderVariants = VariantProps<typeof sliderVariants>;`
- hereda o referencia: `VariantProps<typeof sliderVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.



## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Slider, SliderOutput, SliderTrack, SliderFill, SliderThumb } from "lizaui/slider";

export function ExampleSlider() {
	return (
		<Slider defaultValue={35} minValue={0} maxValue={100}>
			<SliderOutput />
			<SliderTrack>
				<SliderFill />
				<SliderThumb />
			</SliderTrack>
		</Slider>
	);
}
```

## Archivos fuente

- `lizaui/src/components/slider/index.ts`
- `lizaui/src/components/slider/slider.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/slider.ts`
