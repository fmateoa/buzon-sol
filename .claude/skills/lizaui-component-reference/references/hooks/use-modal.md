# useModalHooks

- tipo: hook
- import recomendado: `lizaui`
- export principal sugerido: `useModalHooks`

## Resumen

Esta referencia documenta la superficie pública de `useModalHooks` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `SizeModalInterface`
- `useModalHooks`
- `UseModalType`

## Props y tipos clave

### `SizeModalInterface`

- firma: `export type SizeModalInterface = "smaller" | "small" | "medium" | "large" | "x-large" | "full";`
- hereda o referencia: `"smaller" | "small" | "medium" | "large" | "x-large" | "full"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `UseModalType`

- firma: `export interface UseModalType<T = any> { modalId: string; isOpen: boolean; isVisibleModal: boolean; paramBody: T | null; showModal: (params?: T, content?: React.ReactNode) => void; closeModal: () => void; visibleModal: () => void; hiddenModal: () => void; updateParamBody: (params: T) => void; toggleModal: () => void; }`
- propiedades detectadas:
  - `modalId`: `string`
  - `isOpen`: `boolean`
  - `isVisibleModal`: `boolean`
  - `paramBody`: `T | null`
  - `showModal`: `(params?: T, content?: React.ReactNode) => void`
  - `closeModal`: `() => void`
  - `visibleModal`: `() => void`
  - `hiddenModal`: `() => void`
  - `updateParamBody`: `(params: T) => void`
  - `toggleModal`: `() => void`
## Funciones exportadas

- `useModalHooks`: `export function useModalHooks<T = any>(modalIdRef?: string): UseModalType<T>`


## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`
## Recomendaciones de uso

- Usa este hook desde el entrypoint raíz del paquete para mantener imports estables.
- El retorno del hook es la fuente principal de estado y acciones; normalmente se consume junto con un componente visual.
- Encaja bien con `Modal` y con modales controlados por lógica local del componente.
## Ejemplo de uso

```tsx
import { useModalHooks } from "lizaui";
import { Modal, ModalBody, ModalHeader } from "lizaui/modal";

export function ExampleModalHook() {
	const modal = useModalHooks<{ id: number }>();

	return (
		<>
			<button onClick={() => modal.showModal({ id: 7 })}>Abrir</button>
			<Modal isShow={modal.isOpen} isVisible={modal.isVisibleModal} modalId={modal.modalId} size="lg" onClickOutside={modal.closeModal}>
				<ModalHeader title="Detalle" onClick={modal.closeModal} />
				<ModalBody>Payload: {modal.paramBody?.id}</ModalBody>
			</Modal>
		</>
	);
}
```

## Archivos fuente

- `lizaui/src/hooks/use-modal.ts`
