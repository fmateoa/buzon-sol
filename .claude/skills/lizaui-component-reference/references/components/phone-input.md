# Phone Input

- tipo: componente
- import recomendado: `lizaui/phone-input`
- export principal sugerido: `PhoneInput`

## Resumen

Esta referencia documenta la superficie pública de `phone-input` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Country`
- `formatPhoneNumber`
- `formatPhoneNumberIntl`
- `getCountryCallingCode`
- `PhoneInput`
- `PhoneInputProps`
- `Value`

## Props y tipos clave

### `PhoneInputProps`

- firma: `export type PhoneInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref"> & Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & { onChange?: (value: RPNInput.Value) => void; label?: string; classNameContainer?: string; includeAllCountries?: boolean; error?: string; touched?: boolean; };`
- hereda o referencia: `Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref">`, `Omit<RPNInput.Props<typeof RPNInput.default>, "onChange">`
- propiedades detectadas:
  - `onChange?`: `(value: RPNInput.Value) => void`
  - `label?`: `string`
  - `classNameContainer?`: `string`
  - `includeAllCountries?`: `boolean`
  - `error?`: `string`
  - `touched?`: `boolean`

### `CountryEntry`

- firma: `type CountryEntry = { label: string; value: RPNInput.Country | undefined; };`
- propiedades detectadas:
  - `label`: `string`
  - `value`: `RPNInput.Country | undefined`

### `CountrySelectProps`

- firma: `type CountrySelectProps = { disabled?: boolean; value: RPNInput.Country; options: CountryEntry[]; onChange: (country: RPNInput.Country) => void; countryOrder?: readonly RPNInput.Country[]; };`
- propiedades detectadas:
  - `disabled?`: `boolean`
  - `value`: `RPNInput.Country`
  - `options`: `CountryEntry[]`
  - `onChange`: `(country: RPNInput.Country) => void`
  - `countryOrder?`: `readonly RPNInput.Country[]`

### `CountrySelectOptionProps`

- firma: `interface CountrySelectOptionProps extends RPNInput.FlagProps { selectedCountry: RPNInput.Country; onChange: (country: RPNInput.Country) => void; onSelectComplete: () => void; }`
- hereda o referencia: `RPNInput.FlagProps`
- propiedades detectadas:
  - `selectedCountry`: `RPNInput.Country`
  - `onChange`: `(country: RPNInput.Country) => void`
  - `onSelectComplete`: `() => void`



## Dependencias detectadas

- familias principales: `react-phone-number-input`
- imports externos observados: `lucide-react`, `react`, `react-phone-number-input`, `react-phone-number-input/flags`
## Recomendaciones de uso

- La base técnica detectada es react-phone-number-input.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { PhoneInput } from "lizaui/phone-input";

export function ExamplePhoneInput() {
	return <PhoneInput defaultCountry="MX" placeholder="Número de teléfono" />;
}
```

## Archivos fuente

- `lizaui/src/components/phone-input/index.ts`
- `lizaui/src/components/phone-input/phone-input.tsx`
- `lizaui/src/lib/utils.ts`
