# Sheet

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Sheet`

## Resumen

Esta referencia documenta la superficie pública de `sheet` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Sheet`
- `SheetClose`
- `SheetContent`
- `SheetContentProps`
- `SheetDescription`
- `SheetFooter`
- `SheetHeader`
- `SheetOverlayProps`
- `SheetTitle`
- `SheetTrigger`

## Props y tipos clave

### `SheetOverlayProps`

- firma: `export interface SheetOverlayProps extends React.ComponentProps<typeof SheetPrimitive.Overlay> { backdrop: "transparent" | "opaque" | "blur"; }`
- hereda o referencia: `React.ComponentProps<typeof SheetPrimitive.Overlay>`
- propiedades detectadas:
  - `backdrop`: `"transparent" | "opaque" | "blur"`

### `SheetContentProps`

- firma: `export interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Content> { backdrop?: "transparent" | "opaque" | "blur"; side?: "top" | "right" | "bottom" | "left"; showCloseButton?: boolean; disabled?: boolean; }`
- hereda o referencia: `React.ComponentProps<typeof SheetPrimitive.Content>`
- propiedades detectadas:
  - `backdrop?`: `"transparent" | "opaque" | "blur"`
  - `side?`: `"top" | "right" | "bottom" | "left"`
  - `showCloseButton?`: `boolean`
  - `disabled?`: `boolean`



## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-dialog`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { Sheet } from "lizaui/ui";

export function ExampleSheet() {
	return <Sheet />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/sheet.tsx`
- `lizaui/src/lib/utils.ts`
