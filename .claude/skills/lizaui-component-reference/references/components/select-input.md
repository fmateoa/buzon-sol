# Select Input

- tipo: componente
- import recomendado: `lizaui/select-input`
- export principal sugerido: `SelectInput`

## Resumen

Esta referencia documenta la superficie pública de `select-input` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Autocomplete`
- `SelectInput`

## Props y tipos clave

### `UseAsyncOptionsOptions`

- firma: `export interface UseAsyncOptionsOptions<Option extends SelectOption> { defaultOptions?: boolean | readonly Option[]; loadOption: (inputValue: string) => Promise<readonly Option[]>; }`
- propiedades detectadas:
  - `defaultOptions?`: `boolean | readonly Option[]`
  - `loadOption`: `(inputValue: string) => Promise<readonly Option[]>`

### `SelectFieldProps`

- firma: `export interface SelectFieldProps { children: ReactNode; className?: string; errorMessage?: string; errorMessageId: string; inputId: string; isInvalid: boolean; label?: ReactNode; required?: boolean; }`
- propiedades detectadas:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `errorMessage?`: `string`
  - `errorMessageId`: `string`
  - `inputId`: `string`
  - `isInvalid`: `boolean`
  - `label?`: `ReactNode`
  - `required?`: `boolean`

### `NormalizeSelectChangeOptions`

- firma: `export interface NormalizeSelectChangeOptions<Option extends SelectOption, IsMulti extends boolean> { value: OnChangeValue<Option, IsMulti>; meta: ActionMeta<Option>; isMulti: IsMulti; options: readonly Option[]; selectAllMode: SelectAllMode; selectAllOptionId: SelectOptionId; }`
- propiedades detectadas:
  - `value`: `OnChangeValue<Option, IsMulti>`
  - `meta`: `ActionMeta<Option>`
  - `isMulti`: `IsMulti`
  - `options`: `readonly Option[]`
  - `selectAllMode`: `SelectAllMode`
  - `selectAllOptionId`: `SelectOptionId`

### `SelectComponentContext`

- firma: `export interface SelectComponentContext<Option extends SelectOption> { childrenOption?: (state: { data: Option; isSelected: boolean; }) => ReactNode; childrenSingleValue?: (state: { data: Option; }) => ReactNode; childrenValueStart?: ReactNode; errorMessageId?: string; isCheckMultiOptions?: boolean; isInvalid?: boolean; showCheckItemSelected?: boolean; }`
- propiedades detectadas:
  - `childrenOption?`: `(state: { data: Option; isSelected: boolean; }) => ReactNode`
  - `childrenSingleValue?`: `(state: { data: Option; }) => ReactNode`
  - `childrenValueStart?`: `ReactNode`
  - `errorMessageId?`: `string`
  - `isCheckMultiOptions?`: `boolean`
  - `isInvalid?`: `boolean`
  - `showCheckItemSelected?`: `boolean`

### `UseSelectBehaviorOptions`

- firma: `export interface UseSelectBehaviorOptions<Option extends SelectOption, IsMulti extends boolean> { childrenOption?: (state: { data: Option; isSelected: boolean; }) => ReactNode; childrenSingleValue?: (state: { data: Option; }) => ReactNode; color?: ColorProps; disabled?: boolean; error?: string | readonly string[]; id?: string; isCheckMultiOptions?: boolean; isItemAll?: "only" | "all" | "off"; isMulti: IsMulti; isPortal?: boolean; name?: string; onBlur?: FocusEventHandler<HTMLInputElement>; onChange: (change: OnchangeSelectProps<Option, IsMulti>) => void; options: readonly Option[]; pattern?: PatternInputType; radius?: RadiusProps; selectAllMode?: SelectAllMode; selectAllOptionId?: SelectOptionId; showCheckItemSelected?: boolean; showDropdownIndicator?: boolean; size?: ExcludeType<SizeProps, "xs">; startValueContent?: ReactNode; touched?: boolean | readonly boolean[]; value?: SelectExternalValue<Option["id"], IsMulti>; widthMenu?: number | string; }`
- propiedades detectadas:
  - `childrenOption?`: `(state: { data: Option; isSelected: boolean; }) => ReactNode`
  - `childrenSingleValue?`: `(state: { data: Option; }) => ReactNode`
  - `color?`: `ColorProps`
  - `disabled?`: `boolean`
  - `error?`: `string | readonly string[]`
  - `id?`: `string`
  - `isCheckMultiOptions?`: `boolean`
  - `isItemAll?`: `"only" | "all" | "off"`
  - `isMulti`: `IsMulti`
  - `isPortal?`: `boolean`
  - `name?`: `string`
  - `onBlur?`: `FocusEventHandler<HTMLInputElement>`
  - `onChange`: `(change: OnchangeSelectProps<Option, IsMulti>) => void`
  - `options`: `readonly Option[]`
  - `pattern?`: `PatternInputType`
  - `radius?`: `RadiusProps`
  - `selectAllMode?`: `SelectAllMode`
  - `selectAllOptionId?`: `SelectOptionId`
  - `showCheckItemSelected?`: `boolean`
  - `showDropdownIndicator?`: `boolean`
  - `size?`: `ExcludeType<SizeProps, "xs">`
  - `startValueContent?`: `ReactNode`
  - `touched?`: `boolean | readonly boolean[]`
  - `value?`: `SelectExternalValue<Option["id"], IsMulti>`
  - `widthMenu?`: `number | string`

### `UseSelectControllerOptions`

- firma: `export interface UseSelectControllerOptions { id?: string; name?: string; disabled?: boolean; error?: string | readonly string[]; touched?: boolean | readonly boolean[]; pattern?: PatternInputType; isPortal?: boolean; onBlur?: FocusEventHandler<HTMLInputElement>; }`
- propiedades detectadas:
  - `id?`: `string`
  - `name?`: `string`
  - `disabled?`: `boolean`
  - `error?`: `string | readonly string[]`
  - `touched?`: `boolean | readonly boolean[]`
  - `pattern?`: `PatternInputType`
  - `isPortal?`: `boolean`
  - `onBlur?`: `FocusEventHandler<HTMLInputElement>`

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

### `SelectProps`

- firma: `export type SelectProps<Option extends SelectOption = LegacySelectOption, IsMulti extends boolean = boolean> = SelectGeneralProps<Option, IsMulti> & { data: readonly Option[]; };`
- hereda o referencia: `SelectGeneralProps<Option, IsMulti>`
- propiedades detectadas:
  - `data`: `readonly Option[]`

### `AutoCompleteProps`

- firma: `export type AutoCompleteProps<Option extends SelectOption = LegacySelectOption, IsMulti extends boolean = boolean> = SelectGeneralProps<Option, IsMulti> & { loadOption: (inputValue: string) => Promise<readonly Option[]>; defaultOptions?: boolean | readonly Option[]; cacheOptions?: boolean; };`
- hereda o referencia: `SelectGeneralProps<Option, IsMulti>`
- propiedades detectadas:
  - `loadOption`: `(inputValue: string) => Promise<readonly Option[]>`
  - `defaultOptions?`: `boolean | readonly Option[]`
  - `cacheOptions?`: `boolean`

### `SelectStyleProps`

- firma: `export type SelectStyleProps = { color?: ColorProps; widthMenu: number | string; isInvalid?: boolean; size?: ExcludeType<SizeProps, "xs">; radius?: RadiusProps; };`
- propiedades detectadas:
  - `color?`: `ColorProps`
  - `widthMenu`: `number | string`
  - `isInvalid?`: `boolean`
  - `size?`: `ExcludeType<SizeProps, "xs">`
  - `radius?`: `RadiusProps`

### `SelectInputRef`

- firma: `export type SelectInputRef<Option extends SelectOption = LegacySelectOption, IsMulti extends boolean = boolean> = SelectInstance<Option, IsMulti>;`
- hereda o referencia: `SelectInstance<Option, IsMulti>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SelectOptionId`

- firma: `export type SelectOptionId = string | number | null;`
- hereda o referencia: `string | number | null`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SelectOption`

- firma: `export interface SelectOption<Id extends SelectOptionId = SelectOptionId> { id: Id; name?: string | number | null; /** Preferred react-select-compatible disabled flag. */ isDisabled?: boolean; /** @deprecated Use `isDisabled`. Kept for existing LizaUI option data. */ disabled?: boolean; }`
- propiedades detectadas:
  - `id`: `Id`
  - `name?`: `string | number | null`
  - `isDisabled?`: `boolean`
  - `disabled?`: `boolean`

### `ActionChangeProps`

- firma: `export type ActionChangeProps = "clear" | "select-option" | "deselect-option" | "remove-value" | "pop-value" | "create-option";`
- hereda o referencia: `"clear" | "select-option" | "deselect-option" | "remove-value" | "pop-value" | "create-option"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SelectExternalValue`

- firma: `export type SelectExternalValue<Id extends SelectOptionId, IsMulti extends boolean> = IsMulti extends true ? readonly Id[] | null | undefined : Id | null | undefined;`
- hereda o referencia: `IsMulti extends true ? readonly Id[] | null | undefined : Id | null | undefined`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SelectResolvedValue`

- firma: `export type SelectResolvedValue<Option extends SelectOption, IsMulti extends boolean> = IsMulti extends true ? MultiValue<Option> : SingleValue<Option>;`
- hereda o referencia: `IsMulti extends true ? MultiValue<Option> : SingleValue<Option>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `OnchangeSelectProps`

- firma: `export interface OnchangeSelectProps<Option extends SelectOption = LegacySelectOption, IsMulti extends boolean = LegacySelectMode> { item: SelectChangedItem<Option, IsMulti>; /** The complete selection. This remains an array for both single and multi mode for backwards compatibility. */ data: readonly Option[]; action: ActionChangeProps; }`
- propiedades detectadas:
  - `item`: `SelectChangedItem<Option, IsMulti>`
  - `data`: `readonly Option[]`
  - `action`: `ActionChangeProps`

### `SelectAllMode`

- firma: `export type SelectAllMode = "all" | "exclusive" | "off";`
- hereda o referencia: `"all" | "exclusive" | "off"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.



## Dependencias detectadas

- familias principales: `react-select`
- imports externos observados: `react`, `react-icons/go`, `react-icons/io`, `react-icons/io5`, `react-icons/lu`, `react-select`, `react-select/async`, `tailwind-merge`
## Recomendaciones de uso

- Lee también `references/select-input-and-autocomplete.md`: contiene el contrato controlado por IDs, selección simple/múltiple, clearing, Select all, formularios, SSR, portales y estrategias de carga async.
- `SelectInput` y `Autocomplete` exponen una API curada sobre `react-select`; no aceptan automáticamente todas sus props externas.
- Importa los componentes desde `lizaui/select-input` y los tipos públicos (`SelectOption`, `SelectProps`, `AutoCompleteProps`, `OnchangeSelectProps`, `SelectInputRef`) desde `lizaui`.
## Ejemplo de uso

```tsx
import { SelectInput } from "lizaui/select-input";
import { useState } from "react";

const options = [
	{ id: 0, name: "All" },
	{ id: 1, name: "Active" },
	{ id: 2, name: "Inactive" },
] as const;

export function ExampleSelectInput() {
	const [statusId, setStatusId] = useState<number | null>(null);

	return (
		<SelectInput
			isMulti={false}
			data={options}
			label="Status"
			name="statusId"
			placeholder="Select a status"
			selectAllMode="off"
			value={statusId}
			onChange={({ action, item }) => setStatusId(action === "clear" ? null : item.id)}
		/>
	);
}
```

## Archivos fuente

- `lizaui/src/components/select-input/autocomplete/autocomplete.tsx`
- `lizaui/src/components/select-input/autocomplete/use-async-options.ts`
- `lizaui/src/components/select-input/index.ts`
- `lizaui/src/components/select-input/select-components.ts`
- `lizaui/src/components/select-input/select-field.tsx`
- `lizaui/src/components/select-input/select-logic.ts`
- `lizaui/src/components/select-input/select.tsx`
- `lizaui/src/components/select-input/style/select-theme.style.ts`
- `lizaui/src/components/select-input/sub-component/clear-indicator.tsx`
- `lizaui/src/components/select-input/sub-component/control-start.tsx`
- `lizaui/src/components/select-input/sub-component/dropdown-indicator.tsx`
- `lizaui/src/components/select-input/sub-component/index.ts`
- `lizaui/src/components/select-input/sub-component/input-select.tsx`
- `lizaui/src/components/select-input/sub-component/loading-indicator.tsx`
- `lizaui/src/components/select-input/sub-component/loading-message.tsx`
- `lizaui/src/components/select-input/sub-component/no-option-message.tsx`
- `lizaui/src/components/select-input/sub-component/option-item.tsx`
- `lizaui/src/components/select-input/sub-component/select-component-context.ts`
- `lizaui/src/components/select-input/sub-component/single-value.tsx`
- `lizaui/src/components/select-input/use-select-behavior.ts`
- `lizaui/src/components/select-input/use-select-controller.ts`
- `lizaui/src/lib/utils.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
