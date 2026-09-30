# Textarea

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Textarea`

## Resumen

Esta referencia documenta la superficie pública de `textarea` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Textarea`

## Props y tipos clave

### `TextareaProps`

- firma: `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { className?: string; classNameContainer?: string; startClassName?: string; endClassName?: string; startContent?: React.ReactNode; endContent?: React.ReactNode; onClear?: () => void; label?: string; id?: string; isClearable?: boolean; required?: boolean; disabled?: boolean; error?: string; touched?: boolean; }`
- hereda o referencia: `React.TextareaHTMLAttributes<HTMLTextAreaElement>`
- propiedades detectadas:
  - `className?`: `string`
  - `classNameContainer?`: `string`
  - `startClassName?`: `string`
  - `endClassName?`: `string`
  - `startContent?`: `React.ReactNode`
  - `endContent?`: `React.ReactNode`
  - `onClear?`: `() => void`
  - `label?`: `string`
  - `id?`: `string`
  - `isClearable?`: `boolean`
  - `required?`: `boolean`
  - `disabled?`: `boolean`
  - `error?`: `string`
  - `touched?`: `boolean`



## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `clsx`, `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Textarea } from "lizaui/ui";

export function ExampleTextarea() {
	return <Textarea />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/textarea.tsx`
- `lizaui/src/lib/utils.ts`
