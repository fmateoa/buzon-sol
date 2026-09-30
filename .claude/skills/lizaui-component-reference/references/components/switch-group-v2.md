# Switch Group V2

- tipo: componente
- import recomendado: `lizaui/switch-group-v2`
- export principal sugerido: `SwitchGroup`

## Resumen

Esta referencia documenta la superficie pública de `switch-group-v2` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `SwitchGroup`
- `SwitchGroupProps`
- `SwitchGroupRoot`
- `SwitchGroupRootProps`
- `SwitchGroupV2`
- `switchGroupVariants`
- `SwitchGroupVariants`

## Props y tipos clave

### `SwitchGroup`

- firma: `export type SwitchGroup = { Props: ComponentProps<typeof SwitchGroupRoot>; RootProps: ComponentProps<typeof SwitchGroupRoot>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof SwitchGroupRoot>`
  - `RootProps`: `ComponentProps<typeof SwitchGroupRoot>`

### `SwitchGroupRootProps`

- firma: `interface SwitchGroupRootProps extends React.ComponentPropsWithRef<"div">, SwitchGroupVariants { }`
- hereda o referencia: `React.ComponentPropsWithRef<"div">`, `SwitchGroupVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `SwitchGroupVariants`

- firma: `export type SwitchGroupVariants = VariantProps<typeof switchGroupVariants>;`
- hereda o referencia: `VariantProps<typeof switchGroupVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `switchGroupVariants`
- fuente: `lizaui/src/theme/color/switch-group-v2.ts`
- `orientation`: `horizontal`, `vertical`; default: `vertical`

## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`
## Recomendaciones de uso

- La base técnica detectada es Custom React.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { SwitchGroup } from "lizaui/switch-group-v2";

export function ExampleSwitchGroup() {
	return <SwitchGroup />;
}
```

## Archivos fuente

- `lizaui/src/components/switch-group-v2/index.ts`
- `lizaui/src/components/switch-group-v2/switch-group-v2.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/switch-group-v2.ts`
