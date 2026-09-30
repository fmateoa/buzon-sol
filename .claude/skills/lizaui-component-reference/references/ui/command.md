# Command

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Command`

## Resumen

Esta referencia documenta la superficie pública de `command` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Command`
- `CommandDialog`
- `CommandDialogProps`
- `CommandEmpty`
- `CommandGroup`
- `CommandInput`
- `CommandItem`
- `CommandList`
- `CommandSeparator`
- `CommandShortcut`

## Props y tipos clave

### `CommandDialogProps`

- firma: `export interface CommandDialogProps { open?: boolean; onOpenChange?: (open: boolean) => void; title?: string; description?: string; className?: string; showCloseButton?: boolean; children?: React.ReactNode; }`
- propiedades detectadas:
  - `open?`: `boolean`
  - `onOpenChange?`: `(open: boolean) => void`
  - `title?`: `string`
  - `description?`: `string`
  - `className?`: `string`
  - `showCloseButton?`: `boolean`
  - `children?`: `React.ReactNode`



## Dependencias detectadas

- familias principales: `cmdk`
- imports externos observados: `cmdk`, `lucide-react`, `react`
## Recomendaciones de uso

- La base técnica detectada es cmdk.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Command } from "lizaui/ui";

export function ExampleCommand() {
	return <Command />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/command.tsx`
- `lizaui/src/lib/utils.ts`
