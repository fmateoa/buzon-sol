# useDraggable

- tipo: hook
- import recomendado: `lizaui`
- export principal sugerido: `useDraggable`

## Resumen

Esta referencia documenta la superficie pública de `useDraggable` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `useDraggable`
- `UseDraggableProps`

## Props y tipos clave

### `UseDraggableProps`

- firma: `export interface UseDraggableProps { /** * Ref to the moving target DOM node. */ targetRef?: React.RefObject<HTMLElement> | null; /** * Whether to disable the target is draggable. * @default false */ isDisabled?: boolean; /** * Whether the target can overflow the viewport. * @default false */ canOverflow?: boolean; }`
- propiedades detectadas:
  - `targetRef?`: `React.RefObject<HTMLElement> | null`
  - `isDisabled?`: `boolean`
  - `canOverflow?`: `boolean`
## Funciones exportadas

- `useDraggable`: `export function useDraggable(props: UseDraggableProps): MoveResult`


## Dependencias detectadas

- familias principales: `React Aria`
- imports externos observados: `@react-aria/interactions`, `react`
## Recomendaciones de uso

- Usa este hook desde el entrypoint raíz del paquete para mantener imports estables.
- El retorno del hook es la fuente principal de estado y acciones; normalmente se consume junto con un componente visual.
- Está orientado a hacer draggable un `ref` DOM, especialmente overlays, modales o paneles flotantes.
## Ejemplo de uso

```tsx
import { useDraggable } from "lizaui";
import { useRef } from "react";

export function ExampleDraggable() {
	const ref = useRef<HTMLDivElement | null>(null);
	useDraggable({ targetRef: ref, canOverflow: false });

	return <div ref={ref} className="fixed top-4 left-4 cursor-move">Arrástrame</div>;
}
```

## Archivos fuente

- `lizaui/src/hooks/use-draggable.ts`
