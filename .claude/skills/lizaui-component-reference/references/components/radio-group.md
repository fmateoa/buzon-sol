# Radio Group

- tipo: componente
- import recomendado: `lizaui/radio-group`
- export principal sugerido: `RadioGroup`

## Resumen

Esta referencia documenta la superficie pública de `radio-group` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `RadioGroup`
- `RadioGroupProps`
- `RadioGroupRoot`
- `RadioGroupRootProps`
- `radioGroupVariants`
- `RadioGroupVariants`

## Props y tipos clave

### `RadioGroup`

- firma: `export type RadioGroup = { Props: ComponentProps<typeof RadioGroupRoot>; RootProps: ComponentProps<typeof RadioGroupRoot>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof RadioGroupRoot>`
  - `RootProps`: `ComponentProps<typeof RadioGroupRoot>`

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
## Demos y variaciones reales

### `lizaui/src/demo/radio-group-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ControlledDemo`, `CustomIndicatorDemo`, `CustomRenderFunctionDemo`, `DeliveryAndPaymentDemo`, `DisabledDemo`, `HorizontalDemo`, `InSurfaceDemo`, `RadioGroupDemo`, `TailwindClassesDemo`, `UncontrolledDemo`, `ValidationDemo`, `VariantsDemo`
- variaciones visibles: `Usage`, `Basic Plan`, `Premium Plan`, `Business Plan`, `Custom Indicator`, `Horizontal Orientation`, `Starter`, `Pro`, `Teams`, `Controlled`, `Uncontrolled`, `Validation`, `Disabled`, `Variants`, `Option 1`, `Option 2`, `In Surface`, `Delivery & Payment`, `Custom Render Function`, `Passing Tailwind Classes`
- componentes usados: `RadioGroup`
- props vistas en demos: `RadioGroup.defaultValue=premium`, `RadioGroup.name=plan-basic`, `RadioGroup.defaultValue=premium`, `RadioGroup.name=plan-custom-indicator`, `RadioGroup.defaultValue=pro`, `RadioGroup.name=plan-horizontal`, `RadioGroup.orientation=horizontal`, `RadioGroup.name=plan-controlled`, `RadioGroup.value=value`, `RadioGroup.onChange=setValue`, `RadioGroup.defaultValue=pro`, `RadioGroup.name=plan-uncontrolled`, `RadioGroup.onChange=setSelection`, `RadioGroup.isInvalid=!!error`, `RadioGroup.isRequired=true`, `RadioGroup.name=plan-validation`, `RadioGroup.value=value`, `RadioGroup.onChange=true`
## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { RadioGroup } from "lizaui/radio-group";
import { Radio, RadioControl, RadioIndicator, RadioContent } from "lizaui/radio";

export function ExampleRadioGroup() {
	return (
		<RadioGroup defaultValue="bus" aria-label="Transporte">
			<Radio value="bus"><RadioControl><RadioIndicator /></RadioControl><RadioContent>Bus</RadioContent></Radio>
			<Radio value="van"><RadioControl><RadioIndicator /></RadioControl><RadioContent>Van</RadioContent></Radio>
		</RadioGroup>
	);
}
```

## Archivos fuente

- `lizaui/src/components/radio-group/index.ts`
- `lizaui/src/components/radio-group/radio-group.styles.ts`
- `lizaui/src/components/radio-group/radio-group.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
