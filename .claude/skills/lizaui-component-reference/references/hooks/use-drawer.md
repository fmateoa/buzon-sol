# useDrawer

- tipo: hook
- import recomendado: `lizaui`
- export principal sugerido: `useDrawer`

## Resumen

Esta referencia documenta la superficie pública de `useDrawer` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `useDrawer`
- `UseDrawerInterface`
- `UseDrawerProps`

## Props y tipos clave

### `UseDrawerInterface`

- firma: `export interface UseDrawerInterface<T = any> { drawerId: string; isDrawer: boolean; isVisibleDrawer: boolean; drawerBody: any; paramBody: T; showDrawer: (value?: any) => void; visibleDrawer: () => void; hiddenDrawer: () => void; closeDrawer: () => void; updateParamBody: (value: T) => void; }`
- propiedades detectadas:
  - `drawerId`: `string`
  - `isDrawer`: `boolean`
  - `isVisibleDrawer`: `boolean`
  - `drawerBody`: `any`
  - `paramBody`: `T`
  - `showDrawer`: `(value?: any) => void`
  - `visibleDrawer`: `() => void`
  - `hiddenDrawer`: `() => void`
  - `closeDrawer`: `() => void`
  - `updateParamBody`: `(value: T) => void`

### `UseDrawerProps`

- firma: `export interface UseDrawerProps { drawerId?: string; defaultOpen?: boolean; }`
- propiedades detectadas:
  - `drawerId?`: `string`
  - `defaultOpen?`: `boolean`
## Funciones exportadas

- `useDrawer`: `export function useDrawer<T = any>(props: UseDrawerProps = {}): UseDrawerInterface<T>`


## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`
## Recomendaciones de uso

- Usa este hook desde el entrypoint raíz del paquete para mantener imports estables.
- El retorno del hook es la fuente principal de estado y acciones; normalmente se consume junto con un componente visual.
- Sirve para drawers/sheets con payload dinámico y apertura imperativa.
## Ejemplo de uso

```tsx
import { useDrawer } from "lizaui";

export function ExampleHook() {
	const state = useDrawer();
	return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
```

## Archivos fuente

- `lizaui/src/hooks/use-drawer.ts`
