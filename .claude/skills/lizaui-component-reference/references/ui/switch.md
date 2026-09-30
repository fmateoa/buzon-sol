# Switch

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `LabelError`

## Resumen

Esta referencia documenta la superficie pública de `switch` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `ActionChangeProps`
- `AutoCompleteProps`
- `CheckboxComponentType`
- `cn`
- `ColorProps`
- `ExcludeType`
- `IconSvgProps`
- `IncludeType`
- `LabelError`
- `LabelErrorType`
- `LegacySelectMode`
- `LegacySelectOption`
- `OnchangeSelectProps`
- `RadiusProps`
- `SelectAllMode`
- `SelectChangedItem`
- `SelectExternalValue`
- `SelectGeneralProps`
- `SelectInputRef`
- `SelectOption`
- `SelectOptionId`
- `SelectProps`
- `SelectResolvedValue`
- `SelectStyleProps`
- `SizeProps`
- `SlotsToClasses`
- `Switch`
- `SwitchComponentType`
- `SwitchProps`

## Props y tipos clave

### `LabelErrorType`

- firma: `export type LabelErrorType = Omit<ComponentPropsWithoutRef<"span">, "children"> & { text: string; };`
- hereda o referencia: `Omit<ComponentPropsWithoutRef<"span">, "children">`
- propiedades detectadas:
  - `text`: `string`

### `SwitchProps`

- firma: `export type SwitchProps = VariantProps<typeof SwitchClassProps> & SwitchComponentType;`
- hereda o referencia: `VariantProps<typeof SwitchClassProps>`, `SwitchComponentType`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `CheckboxComponentType`

- firma: `export type CheckboxComponentType = { id?: string; /** * @description * Propiedad para colocar el tamaño del checkbox. * @type * Puede recibir **"sm"** | **"md"** | **"lg"** * @value * El valor por defecto es **"md"** */ /** * @description * Propiedad para bloquear el chip, mostrando una opacidad en el campo * @type * Puede recibir **"boolean"** */ disabled?: boolean; /** * @description * Propiedad para colocar el texto al aldo del checkbox. * @type * Puede recibir **"string"** */ label?: string; /** * @description * Propiedad para colocar la descripcion abajo del texto. * @type * Puede recibir **"string"** */ description?: string; /** * @description * Propiedad para decidir la posicion de los texto del checkbox * @type * Puede recibir **"start"** | **"end"** * @value * El valor por defecto es **start** */ positionLabel?: "start" | "end"; /** * @description * Propiedad para colocar un aserisco en el texto. * @type * Puede recibir **"boolean"** */ required?: boolean; /** * @description * Propiedad para mostrar un texto de error * @type * Puede recibir **"string"** -> pensado en el formik */ error?: string; /** * @description * Propiedad para pasar si el valor a hizo objecto del focus del onblur * @type * Puede recibir **"boolean"** -> pensado en el formik */ touched?: boolean; /** * @description * Propiedad para ingresar valores en el checkbox * @value * El campo es requerido */ value: boolean; /** * @description * Propiedad para lanzar un evento de cambio de estado del valor del checkbox * @type * Retorna un valor (state) => de tipo boolean * @value * El campo es requerido */ onChange: (state: boolean) => void; /** * @description * Propiedad lanzar un evento click */ onClick?: (e: React.MouseEvent) => void; /** * @description * Propiedad para brindar clases personalizadas al componente */ className?: string; };`
- propiedades detectadas:
  - `id?`: `string`
  - `disabled?`: `boolean`
  - `label?`: `string`
  - `description?`: `string`
  - `positionLabel?`: `"start" | "end"`
  - `required?`: `boolean`
  - `error?`: `string`
  - `touched?`: `boolean`
  - `value`: `boolean`
  - `onChange`: `(state: boolean) => void`
  - `onClick?`: `(e: React.MouseEvent) => void`
  - `className?`: `string`

### `ExcludeType`

- firma: `export type ExcludeType<T, U extends string | number | symbol> = T extends U ? never : T;`
- hereda o referencia: `T extends U ? never : T`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `IncludeType`

- firma: `export type IncludeType<T, U extends any[]> = T | U[number];`
- hereda o referencia: `T | U[number]`
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

### `IconSvgProps`

- firma: `export interface IconSvgProps extends SVGProps<SVGSVGElement> { width?: number | string; height?: number | string; fill?: string; size?: number | string; orientation?: "vertical" | "horizontal"; }`
- hereda o referencia: `SVGProps<SVGSVGElement>`
- propiedades detectadas:
  - `width?`: `number | string`
  - `height?`: `number | string`
  - `fill?`: `string`
  - `size?`: `number | string`
  - `orientation?`: `"vertical" | "horizontal"`

### `SelectGeneralProps`

- firma: `export type SelectGeneralProps<Option extends SelectOption = LegacySelectOption, IsMulti extends boolean = boolean> = { "aria-label"?: string; "aria-labelledby"?: string; id?: string; maxMenuHeight?: number; minMenuHeight?: number; placeholder?: ReactNode; classNameContainer?: string; onChange: (change: OnchangeSelectProps<Option, IsMulti>) => void; onBlur?: FocusEventHandler<HTMLInputElement>; color?: ColorProps; widthMenu?: number | string; error?: string | readonly string[]; touched?: boolean | readonly boolean[]; startValueContent?: ReactNode; childrenOption?: (state: { data: Option; isSelected: boolean; }) => ReactNode; childrenSingleValue?: (state: { data: Option; }) => ReactNode; isSearchable?: boolean; isMulti?: IsMulti; disabled?: boolean; name?: string; value?: SelectExternalValue<Option["id"], IsMulti>; onMenuOpen?: () => void; isLoading?: boolean; size?: ExcludeType<SizeProps, "xs">; radius?: RadiusProps; /** @deprecated Use `selectAllMode`. `only` maps to `exclusive`. */ isItemAll?: "only" | "all" | "off"; selectAllMode?: SelectAllMode; selectAllOptionId?: SelectOptionId; menuPosition?: MenuPosition; isPortal?: boolean; menuIsOpen?: boolean; isClearable?: boolean; showDropdownIndicator?: boolean; pattern?: PatternInputType; /** Shows a visual checkbox marker for multi-select options. The option remains the only interactive element. */ isCheckMultiOptions?: boolean; required?: boolean; label?: ReactNode; showCheckItemSelected?: boolean; form?: string; noOptionsMessage?: (state: { inputValue: string; }) => ReactNode; loadingMessage?: (state: { inputValue: string; }) => ReactNode; };`
- propiedades detectadas:
  - `"aria-label"?`: `string`
  - `"aria-labelledby"?`: `string`
  - `id?`: `string`
  - `maxMenuHeight?`: `number`
  - `minMenuHeight?`: `number`
  - `placeholder?`: `ReactNode`
  - `classNameContainer?`: `string`
  - `onChange`: `(change: OnchangeSelectProps<Option, IsMulti>) => void`
  - `onBlur?`: `FocusEventHandler<HTMLInputElement>`
  - `color?`: `ColorProps`
  - `widthMenu?`: `number | string`
  - `error?`: `string | readonly string[]`
  - `touched?`: `boolean | readonly boolean[]`
  - `startValueContent?`: `ReactNode`
  - `childrenOption?`: `(state: { data: Option; isSelected: boolean; }) => ReactNode`
  - `childrenSingleValue?`: `(state: { data: Option; }) => ReactNode`
  - `isSearchable?`: `boolean`
  - `isMulti?`: `IsMulti`
  - `disabled?`: `boolean`
  - `name?`: `string`
  - `value?`: `SelectExternalValue<Option["id"], IsMulti>`
  - `onMenuOpen?`: `() => void`
  - `isLoading?`: `boolean`
  - `size?`: `ExcludeType<SizeProps, "xs">`
  - `radius?`: `RadiusProps`
  - `isItemAll?`: `"only" | "all" | "off"`
  - `selectAllMode?`: `SelectAllMode`
  - `selectAllOptionId?`: `SelectOptionId`
  - `menuPosition?`: `MenuPosition`
  - `isPortal?`: `boolean`
  - `menuIsOpen?`: `boolean`
  - `isClearable?`: `boolean`
  - `showDropdownIndicator?`: `boolean`
  - `pattern?`: `PatternInputType`
  - `isCheckMultiOptions?`: `boolean`
  - `required?`: `boolean`
  - `label?`: `ReactNode`
  - `showCheckItemSelected?`: `boolean`
  - `form?`: `string`
  - `noOptionsMessage?`: `(state: { inputValue: string; }) => ReactNode`
  - `loadingMessage?`: `(state: { inputValue: string; }) => ReactNode`

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

### `SelectChangedItem`

- firma: `export type SelectChangedItem<Option extends SelectOption, IsMulti extends boolean> = boolean extends IsMulti ? Option : IsMulti extends true ? Option | readonly Option[] | null : Option;`
- hereda o referencia: `boolean extends IsMulti ? Option : IsMulti extends true ? Option | readonly Option[] | null : Option`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `LegacySelectOption`

- firma: `/** * Compatibility default for consumers that have not migrated their callback to * `OnchangeSelectProps<MyOption, true | false>` yet. New code should always pass * its concrete option type. */ export type LegacySelectOption = any;`
- hereda o referencia: `any`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `LegacySelectMode`

- firma: `export type LegacySelectMode = any;`
- hereda o referencia: `any`
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

### `SwitchComponentType`

- firma: `export type SwitchComponentType = { id?: string | null; /** * @description * Propiedad para colocar el tamaño del toggle. * @type * Puede recibir **"sm"** | **"md"** | **"lg"** * @value * El valor por defecto es **"md"** */ disabled?: boolean; /** * @description * Propiedad para colocar el texto al aldo del toggle. * @type * Puede recibir **"string"** */ label?: string; /** * @description * Propiedad para colocar la descripcion abajo del texto. * @type * Puede recibir **"string"** */ description?: string; /** * @description * Propiedad para decidir la posicion de los texto del toggle * @type * Puede recibir **"start"** | **"end"** * @value * El valor por defecto es **start** */ positionLabel?: "start" | "end"; /** * @description * Propiedad para colocar un aserisco en el texto. * @type * Puede recibir **"boolean"** */ required?: boolean; /** * @description * Propiedad para mostrar un texto de error * @type * Puede recibir **"string"** -> pensado en el formik */ error?: string; /** * @description * Propiedad para pasar si el valor a hizo objecto del focus del onblur * @type * Puede recibir **"boolean"** -> pensado en el formik */ touched?: boolean; /** * @description * Propiedad para ingresar valores en el toggle * @type * Puede recibir **"boolean"** */ value: boolean; /** * @description * Propiedad para lanzar un evento de cambio de estado del valor del toggle * @type * Retorna un valor (state) => de tipo boolean * @value * El campo es requerido */ onChange: (state: boolean) => void; /** * @description * Propiedad para brindar clases personalizadas al componente */ className?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; thumbIcon?: React.ReactNode; };`
- propiedades detectadas:
  - `id?`: `string | null`
  - `disabled?`: `boolean`
  - `label?`: `string`
  - `description?`: `string`
  - `positionLabel?`: `"start" | "end"`
  - `required?`: `boolean`
  - `error?`: `string`
  - `touched?`: `boolean`
  - `value`: `boolean`
  - `onChange`: `(state: boolean) => void`
  - `className?`: `string`
  - `leftIcon?`: `React.ReactNode`
  - `rightIcon?`: `React.ReactNode`
  - `thumbIcon?`: `React.ReactNode`

### `SlotsToClasses`

- firma: `/** * This Typescript utility transform a list of slots into a list of {slot: classes} */ export type SlotsToClasses<S extends string> = { [key in S]?: Exclude<ClassValue, 0n>; };`
- hereda o referencia: `{ [key in S]?: Exclude<ClassValue, 0n>; }`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `SwitchClassProps`
- fuente: `lizaui/src/components/ui/switch.tsx`
- `color`: `primary`, `secondary`, `success`, `warning`, `danger`, `default`; default: `primary`
- `size`: `sm`, `md`, `lg`; default: `md`

## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `class-variance-authority`, `clsx`, `framer-motion`, `react`, `tailwind-merge`
## Recomendaciones de uso

- La base técnica detectada es Framer Motion.
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
- `lizaui/src/components/ui/switch.tsx`
- `lizaui/src/lib/utils.ts`
- `lizaui/src/types/checkbox.type.ts`
- `lizaui/src/types/global.ts`
- `lizaui/src/types/icon.type.ts`
- `lizaui/src/types/index.ts`
- `lizaui/src/types/select/select-main.type.ts`
- `lizaui/src/types/select/select.type.ts`
- `lizaui/src/types/switch.type.ts`
- `lizaui/src/types/theme.ts`
