# Accordion

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Accordion`

## Resumen

Esta referencia documenta la superficie pública de `accordion` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Accordion`
- `AccordionContent`
- `AccordionItem`
- `AccordionTrigger`
- `cn`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.



## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-accordion`, `lucide-react`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { Accordion } from "lizaui/ui";

export function ExampleAccordion() {
	return <Accordion />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/accordion.tsx`
- `lizaui/src/lib/utils.ts`
