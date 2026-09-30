# Tooltip

- tipo: componente
- import recomendado: `lizaui/tooltip`
- export principal sugerido: `Tooltip`

## Resumen

Esta referencia documenta la superficie pública de `tooltip` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Tooltip`

## Props y tipos clave

### `TooltipProps`

- firma: `interface TooltipProps { children: React.ReactNode; content: React.ReactNode; placement?: "top" | "bottom" | "left" | "right"; className?: string; classNameWrapper?: string; showArrow?: boolean; }`
- propiedades detectadas:
  - `children`: `React.ReactNode`
  - `content`: `React.ReactNode`
  - `placement?`: `"top" | "bottom" | "left" | "right"`
  - `className?`: `string`
  - `classNameWrapper?`: `string`
  - `showArrow?`: `boolean`



## Dependencias detectadas

- familias principales: `Floating UI`
- imports externos observados: `@floating-ui/react`, `clsx`, `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Floating UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Tooltip } from "lizaui/tooltip";

export function ExampleTooltip() {
	return <Tooltip content="Más información"><button>Hover</button></Tooltip>;
}
```

## Archivos fuente

- `lizaui/src/components/tooltip/index.ts`
- `lizaui/src/components/tooltip/tooltip.tsx`
