# Select

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Select`

## Resumen

Esta referencia documenta la superficie pública de `select` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Select`
- `SelectContent`
- `SelectGroup`
- `SelectItem`
- `SelectLabel`
- `SelectScrollDownButton`
- `SelectScrollUpButton`
- `SelectSeparator`
- `SelectTrigger`
- `SelectValue`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.

## Variantes detectadas

### `selectTriggerStyles`
- fuente: `lizaui/src/components/ui/select.tsx`
- `size`: `default`, `sm`; default: `default`
- `radius`: `none`, `sm`, `md`, `lg`, `input`, `full`; default: `input`
## Demos y variaciones reales

### `lizaui/src/demo/select-demo.tsx`
- demos/componentes locales: `SelectDemo`
## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-select`, `class-variance-authority`, `lucide-react`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "lizaui/ui";

export function ExampleSelect() {
	return (
		<Select defaultValue="mx">
			<SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
			<SelectContent>
				<SelectItem value="mx">México</SelectItem>
				<SelectItem value="co">Colombia</SelectItem>
			</SelectContent>
		</Select>
	);
}
```

## Archivos fuente

- `lizaui/src/components/ui/select.tsx`
- `lizaui/src/lib/utils.ts`
