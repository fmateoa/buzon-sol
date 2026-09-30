# Context Menu

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `ContextMenu`

## Resumen

Esta referencia documenta la superficie pública de `context-menu` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `ContextMenu`
- `ContextMenuCheckboxItem`
- `ContextMenuContent`
- `ContextMenuGroup`
- `ContextMenuItem`
- `ContextMenuLabel`
- `ContextMenuPortal`
- `ContextMenuRadioGroup`
- `ContextMenuRadioItem`
- `ContextMenuSeparator`
- `ContextMenuShortcut`
- `ContextMenuSub`
- `ContextMenuSubContent`
- `ContextMenuSubTrigger`
- `ContextMenuTrigger`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.



## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `lucide-react`, `radix-ui`, `react`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { ContextMenu } from "lizaui/ui";

export function ExampleContextMenu() {
	return <ContextMenu />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/context-menu.tsx`
- `lizaui/src/lib/utils.ts`
