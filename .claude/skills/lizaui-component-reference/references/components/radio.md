# Radio

- tipo: componente
- import recomendado: `lizaui/radio`
- export principal sugerido: `Radio`

## Resumen

Esta referencia documenta la superficie pública de `radio` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Radio`
- `RadioContent`
- `RadioContentProps`
- `RadioControl`
- `RadioControlProps`
- `RadioIndicator`
- `RadioIndicatorProps`
- `RadioProps`
- `RadioRoot`
- `RadioRootProps`
- `radioVariants`
- `RadioVariants`

## Props y tipos clave

### `RadioGroupVariants`

- firma: `export type RadioGroupVariants = VariantProps<typeof radioGroupVariants>;`
- hereda o referencia: `VariantProps<typeof radioGroupVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `RadioGroupContextValue`

- firma: `interface RadioGroupContextValue { variant?: ColorProps; size?: ExcludeType<SizeProps, "xs">; }`
- propiedades detectadas:
  - `variant?`: `ColorProps`
  - `size?`: `ExcludeType<SizeProps, "xs">`

### `RadioGroupRootProps`

- firma: `interface RadioGroupRootProps extends ComponentPropsWithRef<typeof RadioGroupPrimitive>, RadioGroupVariants { }`
- hereda o referencia: `ComponentPropsWithRef<typeof RadioGroupPrimitive>`, `RadioGroupVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Radio`

- firma: `export type Radio = { Props: ComponentProps<typeof RadioRoot>; RootProps: ComponentProps<typeof RadioRoot>; ControlProps: ComponentProps<typeof RadioControl>; IndicatorProps: ComponentProps<typeof RadioIndicator>; ContentProps: ComponentProps<typeof RadioContent>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof RadioRoot>`
  - `RootProps`: `ComponentProps<typeof RadioRoot>`
  - `ControlProps`: `ComponentProps<typeof RadioControl>`
  - `IndicatorProps`: `ComponentProps<typeof RadioIndicator>`
  - `ContentProps`: `ComponentProps<typeof RadioContent>`

### `RadioVariants`

- firma: `export type RadioVariants = VariantProps<typeof radioVariants>;`
- hereda o referencia: `VariantProps<typeof radioVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `RadioContextValue`

- firma: `interface RadioContextValue { slots?: ReturnType<typeof radioVariants>; state?: RadioRenderProps; }`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof radioVariants>`
  - `state?`: `RadioRenderProps`

### `RadioRootProps`

- firma: `interface RadioRootProps extends RadioPrimitiveProps, RadioVariants { name?: string; }`
- hereda o referencia: `RadioPrimitiveProps`, `RadioVariants`
- propiedades detectadas:
  - `name?`: `string`

### `RadioControlProps`

- firma: `interface RadioControlProps extends ComponentPropsWithRef<"span"> { }`
- hereda o referencia: `ComponentPropsWithRef<"span">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `RadioIndicatorProps`

- firma: `interface RadioIndicatorProps extends Omit<ComponentPropsWithRef<"span">, "children"> { children?: React.ReactNode | ((props: RadioRenderProps) => React.ReactNode); }`
- hereda o referencia: `Omit<ComponentPropsWithRef<"span">, "children">`
- propiedades detectadas:
  - `children?`: `React.ReactNode | ((props: RadioRenderProps) => React.ReactNode)`

### `RadioContentProps`

- firma: `interface RadioContentProps extends ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ExcludeType`

- firma: `export type ExcludeType<T, U extends string | number | symbol> = T extends U ? never : T;`
- hereda o referencia: `T extends U ? never : T`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ColorProps`

- firma: `export type ColorProps = "primary" | "secondary" | "success" | "warning" | "danger" | "default";`
- hereda o referencia: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SizeProps`

- firma: `export type SizeProps = "xs" | "sm" | "md" | "lg";`
- hereda o referencia: `"xs" | "sm" | "md" | "lg"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `radioGroupVariants`
- fuente: `lizaui/src/components/radio-group/radio-group.styles.ts`
- `orientation`: `vertical`, `horizontal`; default: `vertical`
- `size`: `sm`, `md`, `lg`; default: `md`
- `variant`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `primary`

### `radioVariants`
- fuente: `lizaui/src/components/radio/radio.styles.ts`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `primary`
- `size`: `sm`, `md`, `lg`; default: `md`
- `disableAnimation`: `true`, `false`; default: `false`
## Demos y variaciones reales

### `lizaui/src/demo/radio-group-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ControlledDemo`, `CustomIndicatorDemo`, `CustomRenderFunctionDemo`, `DeliveryAndPaymentDemo`, `DisabledDemo`, `HorizontalDemo`, `InSurfaceDemo`, `RadioGroupDemo`, `TailwindClassesDemo`, `UncontrolledDemo`, `ValidationDemo`, `VariantsDemo`
- variaciones visibles: `Usage`, `Basic Plan`, `Premium Plan`, `Business Plan`, `Custom Indicator`, `Horizontal Orientation`, `Starter`, `Pro`, `Teams`, `Controlled`, `Uncontrolled`, `Validation`, `Disabled`, `Variants`, `Option 1`, `Option 2`, `In Surface`, `Delivery & Payment`, `Custom Render Function`, `Passing Tailwind Classes`
- componentes usados: `Radio`
- props vistas en demos: `Radio.value=value`, `Radio.value=option.value`, `Radio.value=option.value`, `Radio.value=basic`, `Radio.value=premium`, `Radio.value=business`, `Radio.value=basic`, `Radio.value=premium`, `Radio.value=business`
## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Radio, RadioControl, RadioIndicator, RadioContent } from "lizaui/radio";

export function ExampleRadio() {
	return (
		<Radio value="agency">
			<RadioControl><RadioIndicator /></RadioControl>
			<RadioContent>Agencia</RadioContent>
		</Radio>
	);
}
```

## Archivos fuente

- `lizaui/src/components/radio-group/radio-group.styles.ts`
- `lizaui/src/components/radio-group/radio-group.tsx`
- `lizaui/src/components/radio/index.ts`
- `lizaui/src/components/radio/radio.styles.ts`
- `lizaui/src/components/radio/radio.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
