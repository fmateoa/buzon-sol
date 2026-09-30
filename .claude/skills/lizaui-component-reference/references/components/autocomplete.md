# Autocomplete

- tipo: componente
- import recomendado: `lizaui/autocomplete`
- export principal sugerido: `InputAutocompleteForm`

## Resumen

Esta referencia documenta la superficie pública de `autocomplete` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `AutocompleteDropdown`
- `DataValueListItem`
- `DropdownContainerProps`
- `IconInputAutoComplete`
- `InputAutocompleteForm`
- `InputAutocompleteFormProps`
- `OptionListProps`
- `PatterInputAutoComplete`
- `useAutocompleteDropdown`

## Props y tipos clave

### `AutocompleteOptionItemProps`

- firma: `interface AutocompleteOptionItemProps<T extends DataValueListItem = DataValueListItem> { el: T; active: number | string | T[]; onClick: (args: { e?: React.MouseEvent<HTMLLIElement>; el: T; }) => void; isHoverIndex: boolean; setHoverIndex: React.Dispatch<React.SetStateAction<number | null>>; index: number; displayField?: keyof T | string; startOptionIcon?: React.ReactNode; }`
- propiedades detectadas:
  - `el`: `T`
  - `active`: `number | string | T[]`
  - `onClick`: `(args: { e?: React.MouseEvent<HTMLLIElement>; el: T; }) => void`
  - `isHoverIndex`: `boolean`
  - `setHoverIndex`: `React.Dispatch<React.SetStateAction<number | null>>`
  - `index`: `number`
  - `displayField?`: `keyof T | string`
  - `startOptionIcon?`: `React.ReactNode`

### `DataValueListItem`

- firma: `export interface DataValueListItem<Extra extends Record<string, unknown> = Record<string, unknown>> { id: number | string; name: string; key?: string; icon?: string; children?: ReactNode; extra?: Extra; [customField: string]: unknown; }`
- propiedades detectadas:
  - `id`: `number | string`
  - `name`: `string`
  - `key?`: `string`
  - `icon?`: `string`
  - `children?`: `ReactNode`
  - `extra?`: `Extra`

### `IconInputAutoComplete`

- firma: `export interface IconInputAutoComplete { icon: ReactElement; onClick?: (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void; cursor?: "default" | "pointer"; style?: CSSProperties; }`
- propiedades detectadas:
  - `icon`: `ReactElement`
  - `onClick?`: `(e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void`
  - `cursor?`: `"default" | "pointer"`
  - `style?`: `CSSProperties`

### `PatterInputAutoComplete`

- firma: `export type PatterInputAutoComplete = "wholeNumber" | "integer" | "decimal" | "decimalTwoDecimals" | "alphabetic" | "alphanumeric" | "alphanumericNoSpace" | "allCharacter" | "password" | "numericAndSpace" | "expirationDate" | "numericAndComma" | "date-1" | "latitudeAndLongitude" | "everything";`
- hereda o referencia: `"wholeNumber" | "integer" | "decimal" | "decimalTwoDecimals" | "alphabetic" | "alphanumeric" | "alphanumericNoSpace" | "allCharacter" | "password" | "numericAndSpace" | "expirationDate" | "numericAndComma" | "date-1" | "latitudeAndLongitude" | "everything"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `InputAutocompleteFormProps`

- firma: `export interface InputAutocompleteFormProps<T extends DataValueListItem = DataValueListItem> { data: T[]; name?: string; id: number | string; value: string; placeholder?: string; readOnly?: boolean; style?: CSSProperties; height?: number; errors?: Record<string, unknown> | string | null; touched?: Record<string, boolean> | boolean | null; isSearch?: boolean; widthList?: number; loading?: boolean; iconLeft?: IconInputAutoComplete; iconRight?: IconInputAutoComplete; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void; onClickItem?: (el: T) => void; onResetInput?: () => void; onMouseOver?: React.MouseEventHandler<HTMLInputElement>; onMouseEnter?: React.MouseEventHandler<HTMLInputElement>; onMouseLeave?: React.MouseEventHandler<HTMLInputElement>; autoFocus?: boolean; patternInput?: PatterInputAutoComplete; inputId?: string; inputClassName?: string; fixed?: boolean; inputRef?: RefObject<HTMLInputElement>; defaultValue?: string; closeClickOutside?: boolean; type?: "text" | "date" | "number" | "email" | "password" | "url" | "tel"; isInsidePopover?: boolean; textNoData?: string; isEnter?: boolean; maxLength?: number; styleInput?: CSSProperties; emptyContentChildren?: JSX.Element; displayField?: keyof T | string; multiple?: boolean; startOptionIcon?: React.ReactNode; }`
- propiedades detectadas:
  - `data`: `T[]`
  - `name?`: `string`
  - `id`: `number | string`
  - `value`: `string`
  - `placeholder?`: `string`
  - `readOnly?`: `boolean`
  - `style?`: `CSSProperties`
  - `height?`: `number`
  - `errors?`: `Record<string, unknown> | string | null`
  - `touched?`: `Record<string, boolean> | boolean | null`
  - `isSearch?`: `boolean`
  - `widthList?`: `number`
  - `loading?`: `boolean`
  - `iconLeft?`: `IconInputAutoComplete`
  - `iconRight?`: `IconInputAutoComplete`
  - `onChange?`: `(event: React.ChangeEvent<HTMLInputElement>) => void`
  - `onBlur?`: `(event: React.FocusEvent<HTMLInputElement>) => void`
  - `onClickItem?`: `(el: T) => void`
  - `onResetInput?`: `() => void`
  - `onMouseOver?`: `React.MouseEventHandler<HTMLInputElement>`
  - `onMouseEnter?`: `React.MouseEventHandler<HTMLInputElement>`
  - `onMouseLeave?`: `React.MouseEventHandler<HTMLInputElement>`
  - `autoFocus?`: `boolean`
  - `patternInput?`: `PatterInputAutoComplete`
  - `inputId?`: `string`
  - `inputClassName?`: `string`
  - `fixed?`: `boolean`
  - `inputRef?`: `RefObject<HTMLInputElement>`
  - `defaultValue?`: `string`
  - `closeClickOutside?`: `boolean`
  - `type?`: `"text" | "date" | "number" | "email" | "password" | "url" | "tel"`
  - `isInsidePopover?`: `boolean`
  - `textNoData?`: `string`
  - `isEnter?`: `boolean`
  - `maxLength?`: `number`
  - `styleInput?`: `CSSProperties`
  - `emptyContentChildren?`: `JSX.Element`
  - `displayField?`: `keyof T | string`
  - `multiple?`: `boolean`
  - `startOptionIcon?`: `React.ReactNode`

### `DropdownContainerProps`

- firma: `export interface DropdownContainerProps<T extends DataValueListItem = DataValueListItem> { data: T[]; name?: string; height?: number; onClick: (params: { e?: React.MouseEvent<HTMLLIElement | HTMLLabelElement>; el: T; }) => void; active: string | number | T[]; refPartner?: RefObject<HTMLElement> | null; textNoData?: string; isSearch?: boolean; multiple?: boolean; widthList?: number; fixed?: boolean; isLoading?: boolean; isEnter?: boolean; emptyContentChildren?: JSX.Element; displayField?: keyof T | string; startOptionIcon?: React.ReactNode; }`
- propiedades detectadas:
  - `data`: `T[]`
  - `name?`: `string`
  - `height?`: `number`
  - `onClick`: `(params: { e?: React.MouseEvent<HTMLLIElement | HTMLLabelElement>; el: T; }) => void`
  - `active`: `string | number | T[]`
  - `refPartner?`: `RefObject<HTMLElement> | null`
  - `textNoData?`: `string`
  - `isSearch?`: `boolean`
  - `multiple?`: `boolean`
  - `widthList?`: `number`
  - `fixed?`: `boolean`
  - `isLoading?`: `boolean`
  - `isEnter?`: `boolean`
  - `emptyContentChildren?`: `JSX.Element`
  - `displayField?`: `keyof T | string`
  - `startOptionIcon?`: `React.ReactNode`

### `OptionListProps`

- firma: `export interface OptionListProps<T extends DataValueListItem = DataValueListItem> { dataValue: T[]; active: string | number | T[]; onClick: (params: { e?: React.MouseEvent<HTMLLIElement>; el: T; }) => void; multiple: boolean; textNoData: string; hoverIndex: number | null; setHoverIndex: React.Dispatch<React.SetStateAction<number | null>>; showTextNoData?: boolean; emptyContentChildren?: JSX.Element; displayField?: keyof T | string; startOptionIcon?: React.ReactNode; }`
- propiedades detectadas:
  - `dataValue`: `T[]`
  - `active`: `string | number | T[]`
  - `onClick`: `(params: { e?: React.MouseEvent<HTMLLIElement>; el: T; }) => void`
  - `multiple`: `boolean`
  - `textNoData`: `string`
  - `hoverIndex`: `number | null`
  - `setHoverIndex`: `React.Dispatch<React.SetStateAction<number | null>>`
  - `showTextNoData?`: `boolean`
  - `emptyContentChildren?`: `JSX.Element`
  - `displayField?`: `keyof T | string`
  - `startOptionIcon?`: `React.ReactNode`

### `SetDropdownPositionArgs`

- firma: `interface SetDropdownPositionArgs { dropdownRef: RefObject<HTMLElement> | { current: HTMLElement | null; }; anchorRef: RefObject<HTMLElement> | { current: HTMLElement | null; }; height: number; width?: number | "auto"; fixed?: boolean; }`
- propiedades detectadas:
  - `dropdownRef`: `RefObject<HTMLElement> | { current: HTMLElement | null; }`
  - `anchorRef`: `RefObject<HTMLElement> | { current: HTMLElement | null; }`
  - `height`: `number`
  - `width?`: `number | "auto"`
  - `fixed?`: `boolean`

### `DropdownControllerProps`

- firma: `interface DropdownControllerProps { containerRef: RefObject<HTMLElement>; dropdownRef: RefObject<HTMLElement>; onCloseDropDown?: () => void; }`
- propiedades detectadas:
  - `containerRef`: `RefObject<HTMLElement>`
  - `dropdownRef`: `RefObject<HTMLElement>`
  - `onCloseDropDown?`: `() => void`

### `OutsideEvent`

- firma: `type OutsideEvent = MouseEvent | WheelEvent;`
- hereda o referencia: `MouseEvent | WheelEvent`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `Props`

- firma: `interface Props { targetKey: string; }`
- propiedades detectadas:
  - `targetKey`: `string`

### `IconSvgProps`

- firma: `export interface IconSvgProps extends SVGProps<SVGSVGElement> { width?: number | string; height?: number | string; fill?: string; size?: number | string; orientation?: "vertical" | "horizontal"; }`
- hereda o referencia: `SVGProps<SVGSVGElement>`
- propiedades detectadas:
  - `width?`: `number | string`
  - `height?`: `number | string`
  - `fill?`: `string`
  - `size?`: `number | string`
  - `orientation?`: `"vertical" | "horizontal"`
## Funciones exportadas

- `getInitialActiveIndex`: `export function getInitialActiveIndex(data: DataValueListItem[], active: string | number | DataValueListItem[]): unknown`
- `useAutocompleteDropdown`: `export function useAutocompleteDropdown({ containerRef, dropdownRef, onCloseDropDown }: DropdownControllerProps): unknown`

## Demos y variaciones reales

### `lizaui/src/demo/autocomplete-demo.tsx`
- demos/componentes locales: `AutocompleteDemo`
## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `framer-motion`, `lucide-react`, `react`, `usehooks-ts`
## Recomendaciones de uso

- Este entrypoint es el autocomplete legado `InputAutocompleteForm`, no el `Autocomplete` async basado en `react-select`.
- Para búsquedas async nuevas y valores controlados por ID, usa `Autocomplete` desde `lizaui/select-input` y consulta `references/select-input-and-autocomplete.md`.
## Ejemplo de uso

```tsx
import { InputAutocompleteForm } from "lizaui/autocomplete";

export function ExampleInputAutocompleteForm() {
	return <InputAutocompleteForm placeholder="Escribe aquí" value={false} onChange={() => {}} defaultValue="general" />;
}
```

## Archivos fuente

- `lizaui/src/components/autocomplete/autocomplete-dropdown.tsx`
- `lizaui/src/components/autocomplete/autocomplete-option-item.tsx`
- `lizaui/src/components/autocomplete/autocomplete-option-list.tsx`
- `lizaui/src/components/autocomplete/autocomplete-types.ts`
- `lizaui/src/components/autocomplete/autocomplete-utils.ts`
- `lizaui/src/components/autocomplete/index.ts`
- `lizaui/src/components/autocomplete/input-autocomplete-form.tsx`
- `lizaui/src/components/autocomplete/use-autocomplete-dropdown.ts`
- `lizaui/src/components/autocomplete/use-key-press.ts`
- `lizaui/src/lib/utils.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
