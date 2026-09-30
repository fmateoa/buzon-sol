# Checkbox

- tipo: componente
- import recomendado: `lizaui/checkbox`
- export principal sugerido: `Checkbox`

## Resumen

Esta referencia documenta la superficie pública de `checkbox` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Checkbox`
- `CheckboxIcon`
- `CheckboxProps`

## Props y tipos clave

### `CheckboxIconProps`

- firma: `type CheckboxIconProps = Partial<ReturnType<UseCheckboxReturn["getIconProps"]>>;`
- hereda o referencia: `Partial<ReturnType<UseCheckboxReturn["getIconProps"]>>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CheckboxProps`

- firma: `export interface CheckboxProps extends UseCheckboxProps { asChild?: boolean; }`
- hereda o referencia: `UseCheckboxProps`
- propiedades detectadas:
  - `asChild?`: `boolean`

### `UseCheckboxProps`

- firma: `export interface UseCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof CheckboxVariantProps>, CheckboxVariantProps { classNames?: SlotsToClasses<CheckboxSlots>; className?: string; icon?: React.ReactNode | ((props: CheckboxIconProps) => React.ReactNode); children?: React.ReactNode; isIndeterminate?: boolean; ref?: React.Ref<HTMLInputElement>; error?: string; touched?: boolean; required?: boolean; }`
- hereda o referencia: `Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof CheckboxVariantProps>`, `CheckboxVariantProps`
- propiedades detectadas:
  - `classNames?`: `SlotsToClasses<CheckboxSlots>`
  - `className?`: `string`
  - `icon?`: `React.ReactNode | ((props: CheckboxIconProps) => React.ReactNode)`
  - `children?`: `React.ReactNode`
  - `isIndeterminate?`: `boolean`
  - `ref?`: `React.Ref<HTMLInputElement>`
  - `error?`: `string`
  - `touched?`: `boolean`
  - `required?`: `boolean`

### `CheckboxIconProps`

- firma: `export interface CheckboxIconProps { id?: string; isSelected: boolean; isIndeterminate?: boolean; disableAnimation?: boolean; className?: string; }`
- propiedades detectadas:
  - `id?`: `string`
  - `isSelected`: `boolean`
  - `isIndeterminate?`: `boolean`
  - `disableAnimation?`: `boolean`
  - `className?`: `string`

### `UseCheckboxReturn`

- firma: `export type UseCheckboxReturn = ReturnType<typeof useCheckbox>;`
- hereda o referencia: `ReturnType<typeof useCheckbox>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CheckboxVariantProps`

- firma: `export type CheckboxVariantProps = VariantProps<typeof checkbox>;`
- hereda o referencia: `VariantProps<typeof checkbox>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CheckboxSlots`

- firma: `export type CheckboxSlots = keyof ReturnType<typeof checkbox>;`
- hereda o referencia: `keyof ReturnType<typeof checkbox>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SlotsToClasses`

- firma: `/** * This Typescript utility transform a list of slots into a list of {slot: classes} */ export type SlotsToClasses<S extends string> = { [key in S]?: Exclude<ClassValue, 0n>; };`
- hereda o referencia: `{ [key in S]?: Exclude<ClassValue, 0n>; }`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.
## Funciones exportadas

- `CheckboxIcon`: `export function CheckboxIcon(props: CheckboxIconProps): unknown`
- `useCheckbox`: `export function useCheckbox(props: UseCheckboxProps): unknown`
## Variantes detectadas

### `checkbox`
- fuente: `lizaui/src/theme/color/checkbox.ts`
- `color`: `default`, `primary`, `secondary`, `success`, `warning`, `danger`; default: `primary`
- `size`: `sm`, `md`, `lg`; default: `md`
- `radius`: `none`, `sm`, `md`, `lg`, `full`
- `lineThrough`: `true`; default: `false`
- `disabled`: `true`; default: `false`
- `isInvalid`: `true`
- `disableAnimation`: `true`, `false`

## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-slot`, `clsx`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Checkbox } from "lizaui/checkbox";

export function ExampleCheckbox() {
	return <Checkbox isSelected defaultSelected>Recibir novedades</Checkbox>;
}
```

## Archivos fuente

- `lizaui/src/components/checkbox/checkbox-icon.tsx`
- `lizaui/src/components/checkbox/checkbox.tsx`
- `lizaui/src/components/checkbox/index.ts`
- `lizaui/src/components/checkbox/use-checkbox.ts`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/classes.ts`
- `lizaui/src/theme/color/checkbox.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
