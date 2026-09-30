# useConfirmationAlert

- tipo: hook
- import recomendado: `lizaui`
- export principal sugerido: `useConfirmationAlert`

## Resumen

Esta referencia documenta la superficie pública de `useConfirmationAlert` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `ConfirmationAlertProps`
- `useConfirmationAlert`

## Props y tipos clave

### `ConfirmationAlertProps`

- firma: `export interface ConfirmationAlertProps { title?: React.ReactNode; description?: React.ReactNode; body?: React.ReactNode; isOpen: boolean; loading?: boolean; params?: unknown; }`
- propiedades detectadas:
  - `title?`: `React.ReactNode`
  - `description?`: `React.ReactNode`
  - `body?`: `React.ReactNode`
  - `isOpen`: `boolean`
  - `loading?`: `boolean`
  - `params?`: `unknown`

### `ModalMap`

- firma: `type ModalMap = Record<string, ConfirmationAlertProps>;`
- hereda o referencia: `Record<string, ConfirmationAlertProps>`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.



## Dependencias detectadas

- familias principales: `Custom React`
- imports externos observados: `react`
## Recomendaciones de uso

- Usa este hook desde el entrypoint raíz del paquete para mantener imports estables.
- El retorno del hook es la fuente principal de estado y acciones; normalmente se consume junto con un componente visual.
- Es especialmente útil junto a `AlertConfirmation` para flujos destructivos o confirmaciones asíncronas.
## Ejemplo de uso

```tsx
import { useConfirmationAlert } from "lizaui";

export function ExampleConfirmation() {
	const { alert, showAlert, hideAlert } = useConfirmationAlert();

	return (
		<>
			<button onClick={() => showAlert({ title: "Eliminar", description: "Esta acción no se puede deshacer." })}>Confirmar</button>
			{alert.isOpen && <div role="alertdialog">{alert.title}<button onClick={hideAlert}>Cerrar</button></div>}
		</>
	);
}
```

## Archivos fuente

- `lizaui/src/hooks/use-confirmation.ts`
