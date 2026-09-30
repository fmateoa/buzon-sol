# Confirmation

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `AlertConfirmation`

## Resumen

Esta referencia documenta la superficie pública de `confirmation` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `absoluteFullClasses`
- `AlertConfirmation`
- `AlertConfirmationProps`
- `AlertDialog`
- `AlertDialogAction`
- `AlertDialogCancel`
- `AlertDialogContent`
- `AlertDialogDescription`
- `AlertDialogFooter`
- `AlertDialogHeader`
- `AlertDialogOverlay`
- `AlertDialogPortal`
- `AlertDialogTitle`
- `AlertDialogTrigger`
- `baseStyles`
- `button`
- `ButtonVariantProps`
- `cn`
- `collapseAdjacentVariantBorders`
- `colorVariants`
- `COMMON_UNITS`
- `dataFocusVisibleClasses`
- `focusVisibleClasses`
- `groupDataFocusVisibleClasses`
- `hiddenInputClasses`
- `ringClasses`
- `translateCenterClasses`
- `tv`
- `twMergeConfig`

## Props y tipos clave

### `AlertConfirmationProps`

- firma: `export interface AlertConfirmationProps { isOpen: boolean; title?: React.ReactNode; description?: React.ReactNode; body?: React.ReactNode; loading?: boolean; onConfirm?: () => void; onCancel?: () => void; onOpenChange?: (open: boolean) => void; buttonCancelText?: string; buttonConfirmText?: string; showButtonCancel?: boolean; colorButtonConfirm?: ButtonVariantProps["color"]; radiusButtonConfirm?: ButtonVariantProps["radius"]; }`
- propiedades detectadas:
  - `isOpen`: `boolean`
  - `title?`: `React.ReactNode`
  - `description?`: `React.ReactNode`
  - `body?`: `React.ReactNode`
  - `loading?`: `boolean`
  - `onConfirm?`: `() => void`
  - `onCancel?`: `() => void`
  - `onOpenChange?`: `(open: boolean) => void`
  - `buttonCancelText?`: `string`
  - `buttonConfirmText?`: `string`
  - `showButtonCancel?`: `boolean`
  - `colorButtonConfirm?`: `ButtonVariantProps["color"]`
  - `radiusButtonConfirm?`: `ButtonVariantProps["radius"]`

### `ButtonVariantProps`

- firma: `export type ButtonVariantProps = VariantProps<typeof button>;`
- hereda o referencia: `VariantProps<typeof button>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

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

## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-alert-dialog`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { AlertConfirmation } from "lizaui/ui";

export function ExampleAlertConfirmation() {
	return <AlertConfirmation />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/alert-dialog.tsx`
- `lizaui/src/components/ui/confirmation.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/lib/utils.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/theme/color/button.ts`
- `lizaui/src/theme/variants.ts`
