# Tabs

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `Tabs`

## Resumen

Esta referencia documenta la superficie pública de `tabs` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `Tabs`
- `TabsContent`
- `TabsList`
- `TabsTrigger`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.


## Demos y variaciones reales

### `lizaui/src/demo/tabs-demo.tsx`
- demos/componentes locales: `TabsDemo`
- componentes usados: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- props vistas en demos: `Tabs.defaultValue=account`, `TabsContent.value=account`, `TabsContent.value=password`, `TabsTrigger.value=account`, `TabsTrigger.value=password`
## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-tabs`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
- La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.
## Ejemplo de uso

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "lizaui/ui";

export function ExampleTabs() {
	return (
		<Tabs defaultValue="general">
			<TabsList>
				<TabsTrigger value="general">General</TabsTrigger>
				<TabsTrigger value="advanced">Avanzado</TabsTrigger>
			</TabsList>
			<TabsContent value="general">Contenido principal</TabsContent>
			<TabsContent value="advanced">Opciones avanzadas</TabsContent>
		</Tabs>
	);
}
```

## Archivos fuente

- `lizaui/src/components/ui/tabs.tsx`
- `lizaui/src/lib/utils.ts`
