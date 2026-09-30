# Scroll Area

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `ScrollArea`

## Resumen

Esta referencia documenta la superficie pública de `scroll-area` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `ScrollArea`
- `ScrollBar`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.



## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-scroll-area`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { ScrollArea } from "lizaui/ui";

export function ExampleScrollArea() {
	return <ScrollArea />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/scroll-area.tsx`
- `lizaui/src/lib/utils.ts`
