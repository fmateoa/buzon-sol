# Toggle Switch

- tipo: componente
- import recomendado: `lizaui/toggle-switch`
- export principal sugerido: `Switch`

## Resumen

Esta referencia documenta la superficie pública de `toggle-switch` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Switch`
- `SwitchContent`
- `SwitchContentProps`
- `SwitchControl`
- `SwitchControlProps`
- `SwitchIcon`
- `SwitchIconProps`
- `SwitchProps`
- `SwitchRoot`
- `SwitchRootProps`
- `SwitchThumb`
- `SwitchThumbProps`
- `switchVariants`
- `SwitchVariants`
- `ToggleSwitch`

## Props y tipos clave

### `Switch`

- firma: `export type Switch = { Props: ComponentProps<typeof SwitchRoot>; RootProps: ComponentProps<typeof SwitchRoot>; ContentProps: ComponentProps<typeof SwitchContent>; ControlProps: ComponentProps<typeof SwitchControl>; ThumbProps: ComponentProps<typeof SwitchThumb>; IconProps: ComponentProps<typeof SwitchIcon>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof SwitchRoot>`
  - `RootProps`: `ComponentProps<typeof SwitchRoot>`
  - `ContentProps`: `ComponentProps<typeof SwitchContent>`
  - `ControlProps`: `ComponentProps<typeof SwitchControl>`
  - `ThumbProps`: `ComponentProps<typeof SwitchThumb>`
  - `IconProps`: `ComponentProps<typeof SwitchIcon>`

### `SwitchContextValue`

- firma: `interface SwitchContextValue { slots?: ReturnType<typeof switchVariants>; }`
- propiedades detectadas:
  - `slots?`: `ReturnType<typeof switchVariants>`

### `SwitchRootProps`

- firma: `type SwitchRootProps = SwitchPrimitiveProps & SwitchVariants;`
- hereda o referencia: `SwitchPrimitiveProps`, `SwitchVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchControlProps`

- firma: `interface SwitchControlProps extends React.ComponentPropsWithRef<"span"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"span">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchThumbProps`

- firma: `interface SwitchThumbProps extends React.ComponentPropsWithRef<"span"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"span">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchIconProps`

- firma: `interface SwitchIconProps extends React.ComponentPropsWithRef<"span"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"span">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchContentProps`

- firma: `interface SwitchContentProps extends React.ComponentPropsWithRef<"div"> { }`
- hereda o referencia: `React.ComponentPropsWithRef<"div">`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchVariants`

- firma: `export type SwitchVariants = VariantProps<typeof switchVariants>;`
- hereda o referencia: `VariantProps<typeof switchVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `switchVariants`
- fuente: `lizaui/src/theme/color/toggle-switch.ts`
- `size`: `lg`, `md`, `sm`; default: `md`

## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Switch } from "lizaui/toggle-switch";

export function ExampleSwitch() {
	return <Switch />;
}
```

## Archivos fuente

- `lizaui/src/components/toggle-switch/index.ts`
- `lizaui/src/components/toggle-switch/toggle-switch.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/toggle-switch.ts`
