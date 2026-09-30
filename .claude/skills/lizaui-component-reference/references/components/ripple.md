# Ripple

- tipo: componente
- import recomendado: `lizaui/ripple`
- export principal sugerido: `Ripple`

## Resumen

Esta referencia documenta la superficie pública de `ripple` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Ripple`
- `RippleProps`
- `RippleType`
- `useRipple`
- `UseRippleReturn`

## Props y tipos clave

### `As`

- firma: `export type As<Props = any> = React.ElementType<Props>;`
- hereda o referencia: `React.ElementType<Props>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `PropsOf`

- firma: `export type PropsOf<T extends As> = React.ComponentPropsWithoutRef<T> & { as?: As; };`
- hereda o referencia: `React.ComponentPropsWithoutRef<T>`
- propiedades detectadas:
  - `as?`: `As`

### `HTMLProps`

- firma: `export type HTMLProps<T extends As = "div", OmitKeys extends keyof any = never> = Omit<PropsOf<T>, "ref" | "color" | "slot" | "size" | "defaultChecked" | "defaultValue" | OmitKeys> & { as?: As; };`
- hereda o referencia: `Omit<PropsOf<T>, "ref" | "color" | "slot" | "size" | "defaultChecked" | "defaultValue" | OmitKeys>`
- propiedades detectadas:
  - `as?`: `As`

### `RippleProps`

- firma: `export interface RippleProps extends HTMLProps<"span"> { ripples: RippleType[]; color?: string; motionProps?: HTMLMotionProps<"span">; style?: React.CSSProperties; onClear: (key: React.Key) => void; }`
- hereda o referencia: `HTMLProps<"span">`
- propiedades detectadas:
  - `ripples`: `RippleType[]`
  - `color?`: `string`
  - `motionProps?`: `HTMLMotionProps<"span">`
  - `style?`: `React.CSSProperties`
  - `onClear`: `(key: React.Key) => void`

### `RippleType`

- firma: `export type RippleType = { key: React.Key; x: number; y: number; size: number; };`
- propiedades detectadas:
  - `key`: `React.Key`
  - `x`: `number`
  - `y`: `number`
  - `size`: `number`

### `UseRippleReturn`

- firma: `export type UseRippleReturn = ReturnType<typeof useRipple>;`
- hereda o referencia: `ReturnType<typeof useRipple>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.
## Funciones exportadas

- `useRipple`: `export function useRipple(props: any = {}): unknown`


## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `framer-motion`, `react`
## Recomendaciones de uso

- La base técnica detectada es Framer Motion.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Ripple } from "lizaui/ripple";

export function ExampleRipple() {
	return <Ripple color="primary" />;
}
```

## Archivos fuente

- `lizaui/src/components/ripple/index.ts`
- `lizaui/src/components/ripple/ripple.tsx`
- `lizaui/src/components/ripple/use-ripple.ts`
