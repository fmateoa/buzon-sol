# Calendar

- tipo: componente
- import recomendado: `lizaui/calendar`
- export principal sugerido: `CalendarPicker`

## Resumen

Esta referencia documenta la superficie pública de `calendar` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `CalendarPicker`

## Props y tipos clave

### `CalendarProps`

- firma: `export interface CalendarProps { id?: string; value: ValueCalendar; onChange: (value: ValueCalendar) => void; showDoubleView?: boolean; className?: string; classNameContainer?: string; color?: ExcludeType<ColorProps, "secondary">; minDate?: Date; maxDate?: Date; showCalendar?: boolean; onCloseCalendar?: () => void; onClearCalendar?: () => void; onOpenCalendar?: () => void; loading?: boolean; widthCalendar?: number; disabled?: boolean; error?: string; label?: string; touched?: boolean; required?: boolean; isErrorText?: boolean; tileContent?: React.ReactNode | TileContentFunc; tileDisabled?: ({ date }: { date: Date; }) => boolean; locale?: "es" | "en"; format?: "MM/dd/yyyy" | "MM-dd-yyyy" | "dd/MM/yyyy" | "dd-MM-yyyy" | "yyyy/MM/dd" | "yyyy-MM-dd"; type?: "date-picker" | "date-range-picker"; onInvalidChange?: () => void; size?: ExcludeType<SizeProps, "xs">; radius?: RadiusProps; onKeyUp?: (event: any) => void; onKeyDown?: (event: any) => void; onBlur?: (event: any) => void; showActionButtons?: boolean; dayPlaceholder?: "DD" | "dd" | "Día"; monthPlaceholder?: "MM" | "mm" | "Mes"; yearPlaceholder?: "YYYY" | "yyyy" | "Año"; }`
- propiedades detectadas:
  - `id?`: `string`
  - `value`: `ValueCalendar`
  - `onChange`: `(value: ValueCalendar) => void`
  - `showDoubleView?`: `boolean`
  - `className?`: `string`
  - `classNameContainer?`: `string`
  - `color?`: `ExcludeType<ColorProps, "secondary">`
  - `minDate?`: `Date`
  - `maxDate?`: `Date`
  - `showCalendar?`: `boolean`
  - `onCloseCalendar?`: `() => void`
  - `onClearCalendar?`: `() => void`
  - `onOpenCalendar?`: `() => void`
  - `loading?`: `boolean`
  - `widthCalendar?`: `number`
  - `disabled?`: `boolean`
  - `error?`: `string`
  - `label?`: `string`
  - `touched?`: `boolean`
  - `required?`: `boolean`
  - `isErrorText?`: `boolean`
  - `tileContent?`: `React.ReactNode | TileContentFunc`
  - `tileDisabled?`: `({ date }: { date: Date; }) => boolean`
  - `locale?`: `"es" | "en"`
  - `format?`: `"MM/dd/yyyy" | "MM-dd-yyyy" | "dd/MM/yyyy" | "dd-MM-yyyy" | "yyyy/MM/dd" | "yyyy-MM-dd"`
  - `type?`: `"date-picker" | "date-range-picker"`
  - `onInvalidChange?`: `() => void`
  - `size?`: `ExcludeType<SizeProps, "xs">`
  - `radius?`: `RadiusProps`
  - `onKeyUp?`: `(event: any) => void`
  - `onKeyDown?`: `(event: any) => void`
  - `onBlur?`: `(event: any) => void`
  - `showActionButtons?`: `boolean`
  - `dayPlaceholder?`: `"DD" | "dd" | "Día"`
  - `monthPlaceholder?`: `"MM" | "mm" | "Mes"`
  - `yearPlaceholder?`: `"YYYY" | "yyyy" | "Año"`

### `IconCalendarProps`

- firma: `export interface IconCalendarProps { disabled?: boolean; error?: string; }`
- propiedades detectadas:
  - `disabled?`: `boolean`
  - `error?`: `string`

### `IconCloseProps`

- firma: `export interface IconCloseProps extends IconCalendarProps { onClick: () => void; }`
- hereda o referencia: `IconCalendarProps`
- propiedades detectadas:
  - `onClick`: `() => void`

### `ValuePiece`

- firma: `type ValuePiece = Date | null | string;`
- hereda o referencia: `Date | null | string`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ValueCalendar`

- firma: `export type ValueCalendar = ValuePiece | [ ValuePiece, ValuePiece ];`
- hereda o referencia: `ValuePiece | [ ValuePiece, ValuePiece ]`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ExcludeType`

- firma: `export type ExcludeType<T, U extends string | number | symbol> = T extends U ? never : T;`
- hereda o referencia: `T extends U ? never : T`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ColorProps`

- firma: `export type ColorProps = "primary" | "secondary" | "success" | "warning" | "danger" | "default";`
- hereda o referencia: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SizeProps`

- firma: `export type SizeProps = "xs" | "sm" | "md" | "lg";`
- hereda o referencia: `"xs" | "sm" | "md" | "lg"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `RadiusProps`

- firma: `export type RadiusProps = "xs" | "sm" | "md" | "lg" | "full" | "none" | "input";`
- hereda o referencia: `"xs" | "sm" | "md" | "lg" | "full" | "none" | "input"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.


## Demos y variaciones reales

### `lizaui/src/demo/calendar-demo.tsx`
- demos/componentes locales: `CalendarDemo`
- componentes usados: `CalendarPicker`
- props vistas en demos: `CalendarPicker.type=date-picker`, `CalendarPicker.value=value`, `CalendarPicker.onChange=onChange`, `CalendarPicker.type=date-range-picker`, `CalendarPicker.value=valueRange`, `CalendarPicker.onChange=onChangeRange`, `CalendarPicker.touched=true`, `CalendarPicker.error=Ingrese una fecha calida`, `CalendarPicker.label=Fecha de nacimiento`, `CalendarPicker.required=true`, `CalendarPicker.showDoubleView=true`, `CalendarPicker.minDate=new Date()`, `CalendarPicker.type=date-picker`, `CalendarPicker.value=value`, `CalendarPicker.onChange=onChange`, `CalendarPicker.showActionButtons=false`
## Dependencias detectadas

- familias principales: `Calendars`
- imports externos observados: `@wojtekmaj/react-daterange-picker`, `clsx`, `react`, `react-calendar`, `react-date-picker`, `react-icons/fa`, `react-icons/fa6`, `react-icons/md`, `react-tiny-popover`, `styled-components`, `tailwind-merge`, `uuid`
## Recomendaciones de uso

- La base técnica detectada es Calendars.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { CalendarPicker } from "lizaui/calendar";

export function ExampleCalendarPicker() {
	return <CalendarPicker label="Ejemplo" color="primary" value={false} onChange={() => {}} />;
}
```

## Archivos fuente

- `lizaui/src/components/calendar/date-picker/date-picker.style.ts`
- `lizaui/src/components/calendar/date-picker/date-picker.tsx`
- `lizaui/src/components/calendar/date-picker/interface/date-picker.interface.ts`
- `lizaui/src/components/calendar/icon/icon-calendar.tsx`
- `lizaui/src/components/calendar/index.ts`
- `lizaui/src/components/calendar/interface/calendar-shared.interface.ts`
- `lizaui/src/lib/utils.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
