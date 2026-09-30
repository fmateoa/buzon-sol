# Avatar

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Avatar`

## Resumen

Esta referencia documenta la superficie pública de `avatar` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Avatar`
- `AvatarFallback`
- `AvatarImage`
- `AvatarProps`
- `cn`

## Props y tipos clave

### `AvatarProps`

- firma: `export type AvatarProps = React.ComponentProps<typeof AvatarPrimitive.Root> & { color?: "primary" | "secondary" | "success" | "warning" | "danger" | "default"; isBordered?: boolean; size?: "sm" | "md" | "lg"; className?: string; };`
- hereda o referencia: `React.ComponentProps<typeof AvatarPrimitive.Root>`
- propiedades detectadas:
  - `color?`: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`
  - `isBordered?`: `boolean`
  - `size?`: `"sm" | "md" | "lg"`
  - `className?`: `string`

## Variantes detectadas

### `avatarStyles`
- fuente: `lizaui/src/components/ui/avatar.tsx`
- `color`: `primary`, `secondary`, `success`, `warning`, `danger`, `default`; default: `default`
- `isBordered`: `true`, `false`; default: `false`
- `size`: `sm`, `md`, `lg`; default: `md`

## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-avatar`, `class-variance-authority`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Avatar } from "lizaui/ui";

export function ExampleAvatar() {
	return <Avatar />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/avatar.tsx`
- `lizaui/src/lib/utils.ts`
