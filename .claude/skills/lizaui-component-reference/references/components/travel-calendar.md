# Travel Calendar

- tipo: componente
- import recomendado: `lizaui/travel-calendar`
- export principal sugerido: `CalendarTravelForm`

## Resumen

Esta referencia documenta la superficie pública de `travel-calendar` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `CalendarTravelForm`
- `DateObject`

## Props y tipos clave

### `CalendarFormatInput`

- firma: `export type CalendarFormatInput = keyof typeof CALENDAR_FORMAT_ALIASES;`
- hereda o referencia: `keyof typeof CALENDAR_FORMAT_ALIASES`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CalendarFormat`

- firma: `export type CalendarFormat = (typeof CALENDAR_FORMAT_ALIASES)[CalendarFormatInput];`
- hereda o referencia: `(typeof CALENDAR_FORMAT_ALIASES)[CalendarFormatInput]`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CalendarDatePart`

- firma: `type CalendarDatePart = "day" | "month" | "year";`
- hereda o referencia: `"day" | "month" | "year"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Props`

- firma: `interface Props extends CalendarProps { name: string; style?: CSSProperties; value: DateObject | string; handleChange?: (selectedDates: DateObject | DateObject[] | null) => void; handleChangeMonth?: (selectedDates: DateObject) => void; onBlur?: (e: React.FocusEvent) => void; onOpenCalendar?: () => void; refParent?: React.RefObject<HTMLElement>; width?: number | "auto"; hour?: string; errors?: any; touched?: any; idHtml?: string; inputStyle?: CSSProperties; loading?: boolean; containerStylePopover?: Partial<CSSStyleDeclaration> | undefined; maxLength?: number; isClose?: boolean; lang?: CalendarLang; format?: CalendarFormatInput; travelPrices?: TravelPrice[]; /** Fecha mínima seleccionable, ej. "2026-02-28 06:47:00". Hacia atrás se deshabilitan. null/undefined = sin límite. */ minSelectableDate?: string | null; showActionsButtons?: boolean; readOnly?: boolean; disabled?: boolean; }`
- hereda o referencia: `CalendarProps`
- propiedades detectadas:
  - `name`: `string`
  - `style?`: `CSSProperties`
  - `value`: `DateObject | string`
  - `handleChange?`: `(selectedDates: DateObject | DateObject[] | null) => void`
  - `handleChangeMonth?`: `(selectedDates: DateObject) => void`
  - `onBlur?`: `(e: React.FocusEvent) => void`
  - `onOpenCalendar?`: `() => void`
  - `refParent?`: `React.RefObject<HTMLElement>`
  - `width?`: `number | "auto"`
  - `hour?`: `string`
  - `errors?`: `any`
  - `touched?`: `any`
  - `idHtml?`: `string`
  - `inputStyle?`: `CSSProperties`
  - `loading?`: `boolean`
  - `containerStylePopover?`: `Partial<CSSStyleDeclaration> | undefined`
  - `maxLength?`: `number`
  - `isClose?`: `boolean`
  - `lang?`: `CalendarLang`
  - `format?`: `CalendarFormatInput`
  - `travelPrices?`: `TravelPrice[]`
  - `minSelectableDate?`: `string | null`
  - `showActionsButtons?`: `boolean`
  - `readOnly?`: `boolean`
  - `disabled?`: `boolean`

### `UseCalendarDropdownProps`

- firma: `interface UseCalendarDropdownProps { onOpenCalendar?: () => void; readOnly: boolean; disabled: boolean; }`
- propiedades detectadas:
  - `onOpenCalendar?`: `() => void`
  - `readOnly`: `boolean`
  - `disabled`: `boolean`

### `PresetItem`

- firma: `export interface PresetItem { key: string; label: string; getValue?: () => DateObject | DateObject[] | null; action?: () => void; separator?: boolean; // para agrupar visualmente }`
- propiedades detectadas:
  - `key`: `string`
  - `label`: `string`
  - `getValue?`: `() => DateObject | DateObject[] | null`
  - `action?`: `() => void`
  - `separator?`: `boolean`

### `UseCalendarPresetsProps`

- firma: `interface UseCalendarPresetsProps { selectedDate: Date | null; minDateKey: string | null; enabledDatesSet: Set<string>; hasTravelPrices: boolean; handleChange?: (selectedDates: DateObject | DateObject[] | null) => void; /** Aplica la fecha elegida (refleja en el input y cierra el popover). */ onSelect: (date: Date) => void; }`
- propiedades detectadas:
  - `selectedDate`: `Date | null`
  - `minDateKey`: `string | null`
  - `enabledDatesSet`: `Set<string>`
  - `hasTravelPrices`: `boolean`
  - `handleChange?`: `(selectedDates: DateObject | DateObject[] | null) => void`
  - `onSelect`: `(date: Date) => void`

### `TravelPrice`

- firma: `export interface TravelPrice { dateTravel: string | Date; priceTravel: number; }`
- propiedades detectadas:
  - `dateTravel`: `string | Date`
  - `priceTravel`: `number`

### `UseCalendarPricingProps`

- firma: `interface UseCalendarPricingProps { travelPrices: TravelPrice[]; /** Fecha mínima seleccionable, ej. "2026-02-28 06:47:00". null/undefined = sin límite. */ minSelectableDate: string | null; normalizedFormat: CalendarFormat; lang: CalendarLang; }`
- propiedades detectadas:
  - `travelPrices`: `TravelPrice[]`
  - `minSelectableDate`: `string | null`
  - `normalizedFormat`: `CalendarFormat`
  - `lang`: `CalendarLang`

### `UseCalendarValueProps`

- firma: `interface UseCalendarValueProps { value: unknown; normalizedFormat: CalendarFormat; minDateKey: string | null; handleChange?: (selectedDates: DateObject | DateObject[] | null) => void; /** Se invoca tras elegir una fecha en el calendario (p.ej. para cerrar el popover). */ onClose: () => void; }`
- propiedades detectadas:
  - `value`: `unknown`
  - `normalizedFormat`: `CalendarFormat`
  - `minDateKey`: `string | null`
  - `handleChange?`: `(selectedDates: DateObject | DateObject[] | null) => void`
  - `onClose`: `() => void`

### `CalendarLang`

- firma: `export type CalendarLang = "es" | "en";`
- hereda o referencia: `"es" | "en"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `PresetButtonProps`

- firma: `interface PresetButtonProps { label: string; active: boolean; disabled: boolean; onClick: () => void; }`
- propiedades detectadas:
  - `label`: `string`
  - `active`: `boolean`
  - `disabled`: `boolean`
  - `onClick`: `() => void`
## Funciones exportadas

- `useCalendarDropdown`: `export function useCalendarDropdown({ onOpenCalendar, readOnly, disabled }: UseCalendarDropdownProps): unknown`
- `useCalendarPresets`: `export function useCalendarPresets({ selectedDate, minDateKey, enabledDatesSet, hasTravelPrices, handleChange, onSelect, }: UseCalendarPresetsProps): unknown`
- `useCalendarPricing`: `export function useCalendarPricing({ travelPrices, minSelectableDate, normalizedFormat, lang }: UseCalendarPricingProps): unknown`
- `useCalendarValue`: `export function useCalendarValue({ value, normalizedFormat, minDateKey, handleChange, onClose }: UseCalendarValueProps): unknown`

## Demos y variaciones reales

### `lizaui/src/demo/travel-calendar-demo.tsx`
- demos/componentes locales: `TravelCalendarDemo`
- componentes usados: `CalendarTravelForm`, `DateObject`
- props vistas en demos: `CalendarTravelForm.name=travelDate`, `CalendarTravelForm.value=selectedDate`, `CalendarTravelForm.lang=es`, `CalendarTravelForm.format=DD/MM/YYYY`, `CalendarTravelForm.numberOfMonths=2`, `CalendarTravelForm.showActionsButtons=true`, `CalendarTravelForm.minSelectableDate=`${travelCalendarResponse.data[0]?.travelDate`, `CalendarTravelForm.travelPrices=travelPrices`, `CalendarTravelForm.handleChange=true`, `DateObject.string=true`
## Dependencias detectadas

- familias principales: `react-multi-date-picker`
- imports externos observados: `react`, `react-date-object`, `react-icons/fi`, `react-multi-date-picker`, `react-tiny-popover`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es react-multi-date-picker.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { CalendarTravelForm } from "lizaui/travel-calendar";

export function ExampleCalendarTravelForm() {
	return <CalendarTravelForm label="Ejemplo" />;
}
```

## Archivos fuente

- `lizaui/src/components/travel-calendar/calendar-format.ts`
- `lizaui/src/components/travel-calendar/calendar-travel-form.tsx`
- `lizaui/src/components/travel-calendar/hook/use-calendar-dropdown.ts`
- `lizaui/src/components/travel-calendar/hook/use-calendar-presets.ts`
- `lizaui/src/components/travel-calendar/hook/use-calendar-pricing.tsx`
- `lizaui/src/components/travel-calendar/hook/use-calendar-value.ts`
- `lizaui/src/components/travel-calendar/index.ts`
- `lizaui/src/components/travel-calendar/locale.ts`
- `lizaui/src/components/travel-calendar/preset-button.tsx`
