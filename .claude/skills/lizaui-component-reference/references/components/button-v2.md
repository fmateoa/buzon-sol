# Button V2

- tipo: componente
- import recomendado: `lizaui/button-v2`
- export principal sugerido: `ButtonV2`

## Resumen

Esta referencia documenta la superficie pública de `button-v2` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `BUTTON_GROUP_CHILD`
- `ButtonV2`
- `ButtonV2Props`
- `ButtonV2Root`
- `ButtonV2RootProps`
- `buttonV2Variants`
- `ButtonV2Variants`

## Props y tipos clave

### `ButtonV2Variants`

- firma: `export type ButtonV2Variants = VariantProps<typeof buttonV2Variants>;`
- hereda o referencia: `VariantProps<typeof buttonV2Variants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ButtonV2RootProps`

- firma: `/* ------------------------------------------------------------------------------------------------- * ButtonV2 Root * -----------------------------------------------------------------------------------------------*/ interface ButtonV2RootProps extends ButtonPrimitiveProps, ButtonV2Variants { [BUTTON_GROUP_CHILD]?: boolean; }`
- hereda o referencia: `ButtonPrimitiveProps`, `ButtonV2Variants`
- propiedades detectadas:
  - `[BUTTON_GROUP_CHILD]?`: `boolean`

### `ButtonV2Component`

- firma: `/* ------------------------------------------------------------------------------------------------- * Compound Component * -----------------------------------------------------------------------------------------------*/ type ButtonV2Component = typeof ButtonV2Root & { Root: typeof ButtonV2Root; };`
- hereda o referencia: `typeof ButtonV2Root`
- propiedades detectadas:
  - `Root`: `typeof ButtonV2Root`

### `ButtonV2`

- firma: `export type ButtonV2 = { Props: ButtonV2RootProps; RootProps: ButtonV2RootProps; };`
- propiedades detectadas:
  - `Props`: `ButtonV2RootProps`
  - `RootProps`: `ButtonV2RootProps`
## Funciones exportadas

- `composeTwRenderProps`: `export function composeTwRenderProps<T>(className: string | ((v: T) => string) | undefined, tailwind?: string | ((v: T) => string | undefined)): string | ((v: T) => string)`
## Variantes detectadas

### `buttonV2Variants`
- fuente: `lizaui/src/components/button-v2/button-v2.styles.ts`
- `fullWidth`: `false`, `true`; default: `false`
- `isIconOnly`: `true`; default: `false`
- `size`: `lg`, `md`, `sm`; default: `md`
- `variant`: `danger`, `danger-soft`, `ghost`, `outline`, `primary`, `secondary`, `tertiary`; default: `primary`
## Demos y variaciones reales

### `lizaui/src/demo/button-v2-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ButtonV2Demo`, `DisabledDemo`, `FullWidthDemo`, `IconOnlyDemo`, `LinkButtonDemo`, `LoadingDemo`, `LoadingStateDemo`, `RenderPropDemo`, `SizesDemo`, `SocialDemo`, `VariantsDemo`, `WithIconsDemo`
- variaciones visibles: `Basic`, `Variants`, `Sizes`, `With Icons`, `Icon Only`, `Loading (isPending)`, `Loading State (interactive)`, `Full Width`, `Disabled`, `Social Buttons`, `Link as Button (using buttonV2Variants)`, `Custom Render Function`
- componentes usados: `ButtonV2`
- props vistas en demos: `ButtonV2.onPress=true`, `ButtonV2.variant=secondary`, `ButtonV2.variant=tertiary`, `ButtonV2.variant=outline`, `ButtonV2.variant=ghost`, `ButtonV2.variant=danger`, `ButtonV2.variant=danger-soft`, `ButtonV2.size=sm`, `ButtonV2.size=md`, `ButtonV2.size=lg`, `ButtonV2.variant=secondary`, `ButtonV2.variant=tertiary`, `ButtonV2.variant=danger`, `ButtonV2.isIconOnly=true`, `ButtonV2.size=sm`, `ButtonV2.variant=tertiary`, `ButtonV2.isIconOnly=true`, `ButtonV2.variant=tertiary`
## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { ButtonV2 } from "lizaui/button-v2";

export function ExampleButtonV2() {
	return <ButtonV2 variant="primary" size="md" onPress={() => {}}>Guardar</ButtonV2>;
}
```

## Archivos fuente

- `lizaui/src/components/button-v2/button-v2.styles.ts`
- `lizaui/src/components/button-v2/button-v2.tsx`
- `lizaui/src/components/button-v2/compose.ts`
- `lizaui/src/components/button-v2/index.ts`
- `lizaui/src/lib/tv.ts`
