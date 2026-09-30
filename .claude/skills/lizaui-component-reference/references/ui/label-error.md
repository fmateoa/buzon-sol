# Label Error

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `LabelError`

## Resumen

Esta referencia documenta la superficie pública de `label-error` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `LabelError`
- `LabelErrorType`

## Props y tipos clave

### `LabelErrorType`

- firma: `export type LabelErrorType = Omit<ComponentPropsWithoutRef<"span">, "children"> & { text: string; };`
- hereda o referencia: `Omit<ComponentPropsWithoutRef<"span">, "children">`
- propiedades detectadas:
  - `text`: `string`



## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { LabelError } from "lizaui/ui";

export function ExampleLabelError() {
	return <LabelError />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/label-error.tsx`
