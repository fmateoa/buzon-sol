# Button Group

- tipo: componente
- import recomendado: `lizaui/button-group`
- export principal sugerido: `ButtonGroup`

## Resumen

Esta referencia documenta la superficie pública de `button-group` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `BUTTON_GROUP_CHILD`
- `ButtonGroup`
- `ButtonGroupContext`
- `ButtonGroupProps`
- `ButtonGroupRoot`
- `ButtonGroupRootProps`
- `ButtonGroupSeparator`
- `ButtonGroupSeparatorProps`
- `buttonGroupVariants`
- `ButtonGroupVariants`

## Props y tipos clave

### `ButtonGroupVariants`

- firma: `export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;`
- hereda o referencia: `VariantProps<typeof buttonGroupVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ButtonGroupContext`

- firma: `/* ------------------------------------------------------------------------------------------------- * ButtonGroup Context * -----------------------------------------------------------------------------------------------*/ type ButtonGroupContext = { slots?: ReturnType<typeof buttonGroupVariants>; size?: ButtonV2RootProps["size"]; variant?: ButtonV2RootProps["variant"]; isDisabled?: ButtonV2RootProps["isDisabled"]; fullWidth?: ButtonV2RootProps["fullWidth"]; };`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof buttonGroupVariants>`
  - `size?`: `ButtonV2RootProps["size"]`
  - `variant?`: `ButtonV2RootProps["variant"]`
  - `isDisabled?`: `ButtonV2RootProps["isDisabled"]`
  - `fullWidth?`: `ButtonV2RootProps["fullWidth"]`

### `ButtonGroupRootProps`

- firma: `/* ------------------------------------------------------------------------------------------------- * ButtonGroup Root * -----------------------------------------------------------------------------------------------*/ interface ButtonGroupRootProps extends Omit<ComponentPropsWithRef<"div">, "className">, Pick<ButtonV2RootProps, "size" | "variant">, ButtonGroupVariants { /** The orientation of the button group */ orientation?: "horizontal" | "vertical"; /** Whether all buttons in the group are disabled */ isDisabled?: boolean; /** Custom className */ className?: string; }`
- hereda o referencia: `Omit<ComponentPropsWithRef<"div">, "className">`, `Pick<ButtonV2RootProps, "size" | "variant">`, `ButtonGroupVariants`
- propiedades detectadas:
  - `orientation?`: `"horizontal" | "vertical"`
  - `isDisabled?`: `boolean`
  - `className?`: `string`

### `ButtonGroupSeparatorProps`

- firma: `/* ------------------------------------------------------------------------------------------------- * ButtonGroup Separator * -----------------------------------------------------------------------------------------------*/ interface ButtonGroupSeparatorProps extends ComponentPropsWithRef<"span"> { className?: string; }`
- hereda o referencia: `ComponentPropsWithRef<"span">`
- propiedades detectadas:
  - `className?`: `string`

### `ButtonGroup`

- firma: `export type ButtonGroup = { Props: ComponentProps<typeof ButtonGroupRoot>; RootProps: ComponentProps<typeof ButtonGroupRoot>; SeparatorProps: ComponentProps<typeof ButtonGroupSeparator>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof ButtonGroupRoot>`
  - `RootProps`: `ComponentProps<typeof ButtonGroupRoot>`
  - `SeparatorProps`: `ComponentProps<typeof ButtonGroupSeparator>`

## Variantes detectadas

### `buttonGroupVariants`
- fuente: `lizaui/src/components/button-group/button-group.styles.ts`
- `fullWidth`: `false`, `true`; default: `false`
- `orientation`: `horizontal`, `vertical`; default: `horizontal`
## Demos y variaciones reales

### `lizaui/src/demo/button-group-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ButtonGroupDemo`, `DisabledDemo`, `ExamplesDemo`, `FullWidthDemo`, `OrientationDemo`, `SizesDemo`, `VariantsDemo`, `WithIconsDemo`, `WithoutSeparatorDemo`
- variaciones visibles: `Basic`, `Variants`, `Sizes`, `Orientation`, `With Icons`, `Full Width`, `Disabled`, `Without Separator`, `Real-world Examples`
- componentes usados: `ButtonGroup`
- props vistas en demos: `ButtonGroup.variant=variant`, `ButtonGroup.size=size`, `ButtonGroup.variant=tertiary`, `ButtonGroup.orientation=vertical`, `ButtonGroup.variant=tertiary`, `ButtonGroup.variant=secondary`, `ButtonGroup.variant=tertiary`, `ButtonGroup.fullWidth=true`, `ButtonGroup.fullWidth=true`, `ButtonGroup.isDisabled=true`, `ButtonGroup.isDisabled=true`, `ButtonGroup.variant=tertiary`, `ButtonGroup.variant=tertiary`, `ButtonGroup.variant=tertiary`, `ButtonGroup.variant=tertiary`, `ButtonGroup.variant=tertiary`
## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { ButtonGroup } from "lizaui/button-group";
import { ButtonV2 } from "lizaui/button-v2";

export function ExampleButtonGroup() {
	return (
		<ButtonGroup variant="secondary" size="md">
			<ButtonV2>Anterior</ButtonV2>
			<ButtonV2>Siguiente</ButtonV2>
		</ButtonGroup>
	);
}
```

## Archivos fuente

- `lizaui/src/components/button-group/button-group.styles.ts`
- `lizaui/src/components/button-group/button-group.tsx`
- `lizaui/src/components/button-group/index.ts`
- `lizaui/src/lib/tv.ts`
