# Time Input

- tipo: componente
- import recomendado: `lizaui/time-input`
- export principal sugerido: `TimePickerInput`

## Resumen

Esta referencia documenta la superficie pública de `time-input` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `TimePickerInput`
- `TimePickerInputProps`

## Props y tipos clave

### `TimePickerInputProps`

- firma: `export interface TimePickerInputProps extends TimePickerProps { id?: string; onChange: (value: string | null) => void; time: string | null; name: string; handleAddTime?: (e: any) => void; disabled?: boolean; label?: string; required?: boolean; isClearable?: boolean; error?: string; touched?: boolean; isErrorText?: boolean; onBlurField?: (name: string) => void; }`
- hereda o referencia: `TimePickerProps`
- propiedades detectadas:
  - `id?`: `string`
  - `onChange`: `(value: string | null) => void`
  - `time`: `string | null`
  - `name`: `string`
  - `handleAddTime?`: `(e: any) => void`
  - `disabled?`: `boolean`
  - `label?`: `string`
  - `required?`: `boolean`
  - `isClearable?`: `boolean`
  - `error?`: `string`
  - `touched?`: `boolean`
  - `isErrorText?`: `boolean`
  - `onBlurField?`: `(name: string) => void`



## Dependencias detectadas

- familias principales: `react-time-picker`
- imports externos observados: `react`, `react-time-picker`, `styled-components`
## Recomendaciones de uso

- La base técnica detectada es react-time-picker.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { TimePickerInput } from "lizaui/time-input";

export function ExampleTimePickerInput() {
	return <TimePickerInput label="Ejemplo" />;
}
```

## Archivos fuente

- `lizaui/src/components/time-input/index.ts`
- `lizaui/src/components/time-input/time-picker-input.tsx`
- `lizaui/src/components/time-input/time-picker.styled.tsx`
- `lizaui/src/lib/utils.ts`
