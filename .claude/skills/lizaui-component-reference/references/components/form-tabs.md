# Form Tabs

- tipo: componente
- import recomendado: `lizaui/form-tabs`
- export principal sugerido: `FormTabs`

## Resumen

Esta referencia documenta la superficie pública de `form-tabs` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `FormTabs`
- `FormTabsList`
- `FormTabsTrigger`

## Props y tipos clave

### `FormTabsSize`

- firma: `type FormTabsSize = "sm" | "md" | "lg";`
- hereda o referencia: `"sm" | "md" | "lg"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `FormTabsRadius`

- firma: `type FormTabsRadius = "none" | "sm" | "md" | "lg" | "full";`
- hereda o referencia: `"none" | "sm" | "md" | "lg" | "full"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `FormTabsVariant`

- firma: `type FormTabsVariant = "solid" | "bordered";`
- hereda o referencia: `"solid" | "bordered"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `FormTabsContextValue`

- firma: `type FormTabsContextValue = { value: string; setValue: (v: string) => void; registerTrigger: (value: string, el: HTMLButtonElement | null) => void; getTriggerEl: (value: string) => HTMLButtonElement | null; listRef: React.RefObject<HTMLDivElement | null>; useHighlightPill: boolean; highlightClassName?: string; size: FormTabsSize; radius: FormTabsRadius; variant: FormTabsVariant; fullWidth: boolean; keyboardSelection: string | null; setKeyboardSelection: React.Dispatch<React.SetStateAction<string | null>>; };`
- propiedades detectadas:
  - `value`: `string`
  - `setValue`: `(v: string) => void`
  - `registerTrigger`: `(value: string, el: HTMLButtonElement | null) => void`
  - `getTriggerEl`: `(value: string) => HTMLButtonElement | null`
  - `listRef`: `React.RefObject<HTMLDivElement | null>`
  - `useHighlightPill`: `boolean`
  - `highlightClassName?`: `string`
  - `size`: `FormTabsSize`
  - `radius`: `FormTabsRadius`
  - `variant`: `FormTabsVariant`
  - `fullWidth`: `boolean`
  - `keyboardSelection`: `string | null`
  - `setKeyboardSelection`: `React.Dispatch<React.SetStateAction<string | null>>`

### `FormTabsProps`

- firma: `interface FormTabsProps { defaultValue: string; value?: string; onValueChange?: (value: string) => void; children: React.ReactNode; className?: string; id?: string; highlightClassName?: string; useHighlightPill?: boolean; size?: FormTabsSize; radius?: FormTabsRadius; variant?: FormTabsVariant; fullWidth?: boolean; }`
- propiedades detectadas:
  - `defaultValue`: `string`
  - `value?`: `string`
  - `onValueChange?`: `(value: string) => void`
  - `children`: `React.ReactNode`
  - `className?`: `string`
  - `id?`: `string`
  - `highlightClassName?`: `string`
  - `useHighlightPill?`: `boolean`
  - `size?`: `FormTabsSize`
  - `radius?`: `FormTabsRadius`
  - `variant?`: `FormTabsVariant`
  - `fullWidth?`: `boolean`

### `TabsListProps`

- firma: `interface TabsListProps { children: React.ReactNode; className?: string; }`
- propiedades detectadas:
  - `children`: `React.ReactNode`
  - `className?`: `string`

### `TabsTriggerProps`

- firma: `interface TabsTriggerProps { value: string; disabled?: boolean; children: React.ReactNode; className?: string; }`
- propiedades detectadas:
  - `value`: `string`
  - `disabled?`: `boolean`
  - `children`: `React.ReactNode`
  - `className?`: `string`
## Funciones exportadas

- `FormTabs`: `export function FormTabs({ defaultValue, value, onValueChange, children, className, id, highlightClassName = "bg-content1 shadow-sm", useHighlightPill = true, size = "md", radius = "md", variant = "solid", fullWidth = false, }: FormTabsProps): unknown`
- `FormTabsList`: `export function FormTabsList({ children, className, ...props }: TabsListProps): unknown`

## Demos y variaciones reales

### `lizaui/src/demo/form-tabs.demo.tsx`
- componentes usados: `FormTabs`, `FormTabsList`, `FormTabsTrigger`
- props vistas en demos: `FormTabs.defaultValue=photos`, `FormTabs.size=sm`, `FormTabs.radius=full`, `FormTabs.defaultValue=photos`, `FormTabs.size=md`, `FormTabs.radius=md`, `FormTabs.defaultValue=photos`, `FormTabs.size=lg`, `FormTabs.radius=lg`, `FormTabs.defaultValue=photos`, `FormTabs.size=sm`, `FormTabs.radius=full`, `FormTabs.defaultValue=music`, `FormTabs.size=md`, `FormTabs.radius=full`, `FormTabs.defaultValue=photos`, `FormTabs.size=lg`, `FormTabs.radius=full`
## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `framer-motion`, `react`
## Recomendaciones de uso

- La base técnica detectada es Framer Motion.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { FormTabs } from "lizaui/form-tabs";

export function ExampleFormTabs() {
	return <FormTabs variant="solid" defaultValue="general" />;
}
```

## Archivos fuente

- `lizaui/src/components/form-tabs/form-tabs.tsx`
- `lizaui/src/components/form-tabs/index.ts`
- `lizaui/src/lib/utils.ts`
