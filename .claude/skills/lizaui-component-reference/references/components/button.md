# Button

- tipo: componente
- import recomendado: `lizaui/button`
- export principal sugerido: `Button`

## Resumen

Esta referencia documenta la superficie pública de `button` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Button`
- `ButtonProps`

## Props y tipos clave

### `ButtonProps`

- firma: `export interface ButtonProps extends UseButtonProps { }`
- hereda o referencia: `UseButtonProps`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `UseButtonProps`

- firma: `export interface UseButtonProps extends ButtonVariantProps, Omit<HTMLAttributes<HTMLElement>, keyof ButtonVariantProps> { ref?: ReactRef<HTMLButtonElement | null>; id?: string; classNames?: SlotsToClasses<ReturnType<typeof button>>; className?: string; asChild?: boolean; children?: ReactNode; isIconOnly?: boolean; isLoading?: boolean; disabled?: boolean; startContent?: ReactNode; endContent?: ReactNode; spinner?: ReactNode; spinnerPlacement?: "start" | "end"; type?: "button" | "submit" | "reset"; }`
- hereda o referencia: `ButtonVariantProps`, `Omit<HTMLAttributes<HTMLElement>, keyof ButtonVariantProps>`
- propiedades detectadas:
  - `ref?`: `ReactRef<HTMLButtonElement | null>`
  - `id?`: `string`
  - `classNames?`: `SlotsToClasses<ReturnType<typeof button>>`
  - `className?`: `string`
  - `asChild?`: `boolean`
  - `children?`: `ReactNode`
  - `isIconOnly?`: `boolean`
  - `isLoading?`: `boolean`
  - `disabled?`: `boolean`
  - `startContent?`: `ReactNode`
  - `endContent?`: `ReactNode`
  - `spinner?`: `ReactNode`
  - `spinnerPlacement?`: `"start" | "end"`
  - `type?`: `"button" | "submit" | "reset"`

### `UseButtonReturn`

- firma: `export type UseButtonReturn = ReturnType<typeof useButton>;`
- hereda o referencia: `ReturnType<typeof useButton>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ButtonVariantProps`

- firma: `export type ButtonVariantProps = VariantProps<typeof button>;`
- hereda o referencia: `VariantProps<typeof button>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SlotsToClasses`

- firma: `/** * This Typescript utility transform a list of slots into a list of {slot: classes} */ export type SlotsToClasses<S extends string> = { [key in S]?: Exclude<ClassValue, 0n>; };`
- hereda o referencia: `{ [key in S]?: Exclude<ClassValue, 0n>; }`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.
## Funciones exportadas

- `useButton`: `export function useButton(props: UseButtonProps): unknown`
## Variantes detectadas

### `button`
- fuente: `lizaui/src/theme/color/button.ts`
- `variant`: `solid`, `bordered`, `light`, `flat`, `faded`, `shadow`, `ghost`; default: `solid`
- `size`: `sm`, `md`, `lg`; default: `md`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `default`
- `radius`: `none`, `sm`, `md`, `lg`, `full`
- `fullWidth`: `true`; default: `false`
- `isDisabled`: `true`; default: `false`
- `isInGroup`: `true`; default: `false`
- `isIconOnly`: `true`, `false`
- `disableAnimation`: `true`, `false`
## Demos y variaciones reales

### `lizaui/src/demo/button-demo.tsx`
- demos/componentes locales: `ButtonDemo`
- componentes usados: `Button`
- props vistas en demos: `Button.isIconOnly=true`, `Button.color=default`, `Button.radius=full`, `Button.size=md`, `Button.variant=light`, `Button.variant=light`, `Button.color=success`, `Button.variant=solid`, `Button.color=default`, `Button.variant=solid`, `Button.color=primary`, `Button.onClick=true`, `Button.variant=ghost`, `Button.color=primary`, `Button.variant=faded`, `Button.variant=bordered`, `Button.color=danger`, `Button.variant=bordered`

### `lizaui/src/demo/button-group-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ButtonGroupDemo`, `DisabledDemo`, `ExamplesDemo`, `FullWidthDemo`, `OrientationDemo`, `SizesDemo`, `VariantsDemo`, `WithIconsDemo`, `WithoutSeparatorDemo`
- variaciones visibles: `Basic`, `Variants`, `Sizes`, `Orientation`, `With Icons`, `Full Width`, `Disabled`, `Without Separator`, `Real-world Examples`

### `lizaui/src/demo/button-v2-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ButtonV2Demo`, `DisabledDemo`, `FullWidthDemo`, `IconOnlyDemo`, `LinkButtonDemo`, `LoadingDemo`, `LoadingStateDemo`, `RenderPropDemo`, `SizesDemo`, `SocialDemo`, `VariantsDemo`, `WithIconsDemo`
- variaciones visibles: `Basic`, `Variants`, `Sizes`, `With Icons`, `Icon Only`, `Loading (isPending)`, `Loading State (interactive)`, `Full Width`, `Disabled`, `Social Buttons`, `Link as Button (using buttonV2Variants)`, `Custom Render Function`
## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-slot`, `clsx`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Button } from "lizaui/button";

export function ExampleButton() {
	return <Button color="primary" variant="solid">Guardar</Button>;
}
```

## Archivos fuente

- `lizaui/src/components/button/button.tsx`
- `lizaui/src/components/button/index.ts`
- `lizaui/src/components/button/spinner.tsx`
- `lizaui/src/components/button/use-button.ts`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/theme/color/button.ts`
- `lizaui/src/theme/variants.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
