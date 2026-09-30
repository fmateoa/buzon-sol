# Input Group

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Input`

## Resumen

Esta referencia documenta la superficie pública de `input-group` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Input`
- `InputGroup`
- `InputGroupAddon`
- `InputGroupButton`
- `InputGroupInput`
- `InputGroupText`
- `InputGroupTextarea`
- `InputProps`
- `LabelError`
- `LabelErrorType`
- `Textarea`

## Props y tipos clave

### `InputProps`

- firma: `export type InputProps = { id?: string; type?: "text" | "date" | "number" | "email" | "password" | "url" | "tel"; error?: string; touched?: boolean; isErrorText?: boolean; classNameContainer?: string; startContent?: React.ReactNode; endContent?: React.ReactNode; pattern?: PatternInputType; onClear?: () => void; label?: string; required?: boolean; isClearable?: boolean; startClassName?: string; endClassName?: string; onClickInput?: ({ e }: { e: React.MouseEvent<HTMLInputElement>; }) => void; } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & VariantProps<typeof inputStyles>;`
- hereda o referencia: `Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">`, `VariantProps<typeof inputStyles>`
- propiedades detectadas:
  - `id?`: `string`
  - `type?`: `"text" | "date" | "number" | "email" | "password" | "url" | "tel"`
  - `error?`: `string`
  - `touched?`: `boolean`
  - `isErrorText?`: `boolean`
  - `classNameContainer?`: `string`
  - `startContent?`: `React.ReactNode`
  - `endContent?`: `React.ReactNode`
  - `pattern?`: `PatternInputType`
  - `onClear?`: `() => void`
  - `label?`: `string`
  - `required?`: `boolean`
  - `isClearable?`: `boolean`
  - `startClassName?`: `string`
  - `endClassName?`: `string`
  - `onClickInput?`: `({ e }: { e: React.MouseEvent<HTMLInputElement>; }) => void`

### `LabelErrorType`

- firma: `export type LabelErrorType = Omit<ComponentPropsWithoutRef<"span">, "children"> & { text: string; };`
- hereda o referencia: `Omit<ComponentPropsWithoutRef<"span">, "children">`
- propiedades detectadas:
  - `text`: `string`

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

## Variantes detectadas

### `inputGroupAddonVariants`
- fuente: `lizaui/src/components/ui/input-group.tsx`
- `align`: `inline-start`, `inline-end`, `block-start`, `block-end`; default: `inline-start`

### `inputGroupButtonVariants`
- fuente: `lizaui/src/components/ui/input-group.tsx`
- `size`: `xs`, `sm`, `icon-xs`, `icon-sm`; default: `xs`

### `inputStyles`
- fuente: `lizaui/src/components/ui/input.tsx`
- `size`: `sm`, `md`, `lg`; default: `md`
- `radius`: `none`, `sm`, `md`, `lg`, `input`, `full`; default: `input`

## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `class-variance-authority`, `clsx`, `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Input } from "lizaui/ui";

export function ExampleInput() {
	return <Input />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/input-group.tsx`
- `lizaui/src/components/ui/input.tsx`
- `lizaui/src/components/ui/label-error.tsx`
- `lizaui/src/components/ui/textarea.tsx`
- `lizaui/src/lib/utils.ts`
