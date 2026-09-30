# Toolbar

- tipo: componente
- import recomendado: `lizaui/toolbar`
- export principal sugerido: `Toolbar`

## Resumen

Esta referencia documenta la superficie pública de `toolbar` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Toolbar`
- `ToolbarProps`
- `ToolbarRoot`
- `ToolbarRootProps`
- `toolbarVariants`
- `ToolbarVariants`

## Props y tipos clave

### `Toolbar`

- firma: `export type Toolbar = { Props: ComponentProps<typeof ToolbarRoot>; RootProps: ComponentProps<typeof ToolbarRoot>; };`
- propiedades detectadas:
  - `Props`: `ComponentProps<typeof ToolbarRoot>`
  - `RootProps`: `ComponentProps<typeof ToolbarRoot>`

### `ToolbarRootProps`

- firma: `type ToolbarRootProps = ComponentPropsWithRef<typeof ToolbarPrimitive> & ToolbarVariants;`
- hereda o referencia: `ComponentPropsWithRef<typeof ToolbarPrimitive>`, `ToolbarVariants`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ToolbarVariants`

- firma: `export type ToolbarVariants = VariantProps<typeof toolbarVariants>;`
- hereda o referencia: `VariantProps<typeof toolbarVariants>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

## Variantes detectadas

### `toolbarVariants`
- fuente: `lizaui/src/theme/color/toolbar.ts`
- `isAttached`: `false`, `true`; default: `false`
- `orientation`: `horizontal`, `vertical`; default: `horizontal`

## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `react`, `react-aria-components`, `tailwind-variants`
## Recomendaciones de uso

- La base técnica detectada es React Aria.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.
## Ejemplo de uso

```tsx
import { Toolbar } from "lizaui/toolbar";
import { ButtonV2 } from "lizaui/button-v2";

export function ExampleToolbar() {
	return (
		<Toolbar aria-label="Acciones" orientation="horizontal">
			<ButtonV2>Nuevo</ButtonV2>
			<ButtonV2 variant="secondary">Editar</ButtonV2>
		</Toolbar>
	);
}
```

## Archivos fuente

- `lizaui/src/components/toolbar/index.ts`
- `lizaui/src/components/toolbar/toolbar.tsx`
- `lizaui/src/lib/tv.ts`
- `lizaui/src/theme/color/toolbar.ts`
