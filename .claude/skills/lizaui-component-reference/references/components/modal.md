# Modal

- tipo: componente
- import recomendado: `lizaui/modal`
- export principal sugerido: `Modal`

## Resumen

Esta referencia documenta la superficie pública de `modal` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Modal`
- `ModalBody`
- `ModalBodyType`
- `ModalFooter`
- `ModalFooterType`
- `ModalHeader`
- `ModalHeaderType`
- `ModalType`
- `PlacementModalType`
- `ShadowModalType`
- `SizeModalInterface`
- `useModalInterface`

## Props y tipos clave

### `SizeModalInterface`

- firma: `export type SizeModalInterface = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";`
- hereda o referencia: `"xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `ShadowModalType`

- firma: `export type ShadowModalType = "none" | "sm" | "md" | "lg";`
- hereda o referencia: `"none" | "sm" | "md" | "lg"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `PlacementModalType`

- firma: `export type PlacementModalType = "top" | "center" | "bottom";`
- hereda o referencia: `"top" | "center" | "bottom"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `useModalInterface`

- firma: `export interface useModalInterface<T = any> { modalId: string; isModal: boolean; isVisibleModal: boolean; modalBody: any; paramBody: T; showModal: (value?: any) => void; visibleModal: () => void; hiddenModal: () => void; closeModal: () => void; updateParamBody: (value: T) => void; }`
- propiedades detectadas:
  - `modalId`: `string`
  - `isModal`: `boolean`
  - `isVisibleModal`: `boolean`
  - `modalBody`: `any`
  - `paramBody`: `T`
  - `showModal`: `(value?: any) => void`
  - `visibleModal`: `() => void`
  - `hiddenModal`: `() => void`
  - `closeModal`: `() => void`
  - `updateParamBody`: `(value: T) => void`

### `ModalType`

- firma: `export interface ModalType { modalId?: string; ref?: Ref<HTMLDivElement>; size?: SizeModalInterface; children: React.ReactNode; isShow: boolean; isVisible: boolean; isKeyboardDismissDisabled?: boolean; style?: CSSProperties; styleContainer?: CSSProperties; classNameModalContent?: string; classNameOverlay?: string; classNameDialog?: string; classNameContent?: string; width?: number | string; onClickOutside?: () => void; backdrop?: "transparent" | "opaque" | "blur"; shadow?: ShadowModalType; radius?: "none" | "sm" | "md" | "lg"; placement?: PlacementModalType; }`
- propiedades detectadas:
  - `modalId?`: `string`
  - `ref?`: `Ref<HTMLDivElement>`
  - `size?`: `SizeModalInterface`
  - `children`: `React.ReactNode`
  - `isShow`: `boolean`
  - `isVisible`: `boolean`
  - `isKeyboardDismissDisabled?`: `boolean`
  - `style?`: `CSSProperties`
  - `styleContainer?`: `CSSProperties`
  - `classNameModalContent?`: `string`
  - `classNameOverlay?`: `string`
  - `classNameDialog?`: `string`
  - `classNameContent?`: `string`
  - `width?`: `number | string`
  - `onClickOutside?`: `() => void`
  - `backdrop?`: `"transparent" | "opaque" | "blur"`
  - `shadow?`: `ShadowModalType`
  - `radius?`: `"none" | "sm" | "md" | "lg"`
  - `placement?`: `PlacementModalType`

### `ModalBodyType`

- firma: `export interface ModalBodyType { className?: string; style?: CSSProperties; children: React.ReactNode; height?: number | string; onClick?: React.MouseEventHandler<HTMLDivElement> | undefined; id?: string; }`
- propiedades detectadas:
  - `className?`: `string`
  - `style?`: `CSSProperties`
  - `children`: `React.ReactNode`
  - `height?`: `number | string`
  - `onClick?`: `React.MouseEventHandler<HTMLDivElement> | undefined`
  - `id?`: `string`

### `ModalHeaderType`

- firma: `export interface ModalHeaderType { title?: string; showCloseButton?: boolean; onClick?: () => void; className?: string; style?: CSSProperties; children?: React.ReactNode; disabled?: boolean; id?: string; }`
- propiedades detectadas:
  - `title?`: `string`
  - `showCloseButton?`: `boolean`
  - `onClick?`: `() => void`
  - `className?`: `string`
  - `style?`: `CSSProperties`
  - `children?`: `React.ReactNode`
  - `disabled?`: `boolean`
  - `id?`: `string`

### `ModalFooterType`

- firma: `export interface ModalFooterType { className?: string; style?: CSSProperties; children: React.ReactNode; height?: number; }`
- propiedades detectadas:
  - `className?`: `string`
  - `style?`: `CSSProperties`
  - `children`: `React.ReactNode`
  - `height?`: `number`

## Variantes detectadas

### `backdropVariants`
- fuente: `lizaui/src/components/modal/modal.tsx`
- `backdrop`: `transparent`, `opaque`, `blur`; default: `opaque`

### `sizeVariants`
- fuente: `lizaui/src/components/modal/modal.tsx`
- `size`: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `full`; default: `md`

### `radiusVariants`
- fuente: `lizaui/src/components/modal/modal.tsx`
- `radius`: `none`, `sm`, `md`, `lg`; default: `lg`

### `placementVariants`
- fuente: `lizaui/src/components/modal/modal.tsx`
- `placement`: `center`, `top`, `bottom`; default: `center`

### `shadowVariants`
- fuente: `lizaui/src/components/modal/modal.tsx`
- `shadow`: `none`, `sm`, `md`, `lg`; default: `md`
## Demos y variaciones reales

### `lizaui/src/demo/modal-demo.tsx`
- demos/componentes locales: `ModalDemo`

### `lizaui/src/demo/modal-dispach.tsx`

### `lizaui/src/demo/modal-form.tsx`
- variaciones visibles: `Edit profile`
- componentes usados: `Modal`, `ModalBody`, `ModalFooter`, `ModalHeader`
- props vistas en demos: `Modal.backdrop=blur`, `Modal.isShow=isOpen`, `Modal.isVisible=isVisibleModal`, `Modal.modalId=modalId`, `Modal.size=md`, `Modal.onClickOutside=closeModal`, `ModalHeader.title=Edit profile`, `ModalHeader.onClick=closeModal`

### `lizaui/src/demo/modal-local.demo.tsx`
- demos/componentes locales: `LocalModalDemo`
- variaciones visibles: `Modal Local Demo`
- componentes usados: `Modal`, `ModalBody`, `ModalFooter`, `ModalHeader`
- props vistas en demos: `Modal.modalId=modalId`, `Modal.size=2xl`, `Modal.ref=targetRef`, `Modal.placement=center`, `Modal.isVisible=modal.isVisibleModal`, `Modal.isShow=modal.isOpen`, `ModalHeader.title=Modal Local Demo`, `ModalHeader.onClick=modal.closeModal`
## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `class-variance-authority`, `framer-motion`, `react`, `react-dom`
## Recomendaciones de uso

- La base técnica detectada es Framer Motion.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { useDraggable, useModalHooks } from "lizaui";
import { Button } from "lizaui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "lizaui/modal";
import { useRef, type RefObject } from "react";

export function ExampleModal() {
	const modal = useModalHooks<{ id: number }>();
	const targetRef = useRef<HTMLDivElement>(null);
	const { moveProps } = useDraggable({ targetRef: targetRef as RefObject<HTMLElement>, canOverflow: true, isDisabled: !modal.isOpen });

	return (
		<>
			<Button onClick={() => modal.showModal({ id: 7 })}>Abrir</Button>
			<Modal
				ref={targetRef}
				backdrop="blur"
				isShow={modal.isOpen}
				isVisible={modal.isVisibleModal}
				modalId={modal.modalId}
				placement="top"
				size="3xl"
				onClickOutside={modal.closeModal}
			>
				<ModalHeader {...moveProps} title="Editar registro" onClick={modal.closeModal} />
				{modal.isOpen && <ModalBody>Contenido del registro {modal.paramBody?.id}</ModalBody>}
				<ModalFooter>
					<Button variant="light" onClick={modal.closeModal}>Cancelar</Button>
					<Button color="primary">Guardar</Button>
				</ModalFooter>
			</Modal>
		</>
	);
}
```

## Archivos fuente

- `lizaui/src/components/modal/index.ts`
- `lizaui/src/components/modal/modal.tsx`
- `lizaui/src/components/modal/modal.type.ts`
- `lizaui/src/lib/utils.ts`
