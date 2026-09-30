# Resizable

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `ResizableHandle`

## Resumen

Esta referencia documenta la superficie pública de `resizable` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `ResizableHandle`
- `ResizablePanel`
- `ResizablePanelGroup`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.



## Dependencias detectadas

- familias principales: `react-resizable-panels`
- imports externos observados: `lucide-react`, `react`, `react-resizable-panels`
## Recomendaciones de uso

- La base técnica detectada es react-resizable-panels.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { ResizableHandle } from "lizaui/ui";

export function ExampleResizableHandle() {
	return <ResizableHandle />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/resizable.tsx`
- `lizaui/src/lib/utils.ts`
