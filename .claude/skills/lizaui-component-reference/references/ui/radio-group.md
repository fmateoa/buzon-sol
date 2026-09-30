# Radio Group

- tipo: familia UI
- import recomendado: `lizaui/ui`
- export principal sugerido: `RadioGroup`

## Resumen

Esta referencia documenta la superficie pública de `radio-group` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `cn`
- `RadioGroup`
- `RadioGroupItem`

## Props y tipos clave

- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.


## Demos y variaciones reales

### `lizaui/src/demo/radio-group-demo.tsx`
- demos/componentes locales: `BasicDemo`, `ControlledDemo`, `CustomIndicatorDemo`, `CustomRenderFunctionDemo`, `DeliveryAndPaymentDemo`, `DisabledDemo`, `HorizontalDemo`, `InSurfaceDemo`, `RadioGroupDemo`, `TailwindClassesDemo`, `UncontrolledDemo`, `ValidationDemo`, `VariantsDemo`
- variaciones visibles: `Usage`, `Basic Plan`, `Premium Plan`, `Business Plan`, `Custom Indicator`, `Horizontal Orientation`, `Starter`, `Pro`, `Teams`, `Controlled`, `Uncontrolled`, `Validation`, `Disabled`, `Variants`, `Option 1`, `Option 2`, `In Surface`, `Delivery & Payment`, `Custom Render Function`, `Passing Tailwind Classes`
- componentes usados: `RadioGroup`
- props vistas en demos: `RadioGroup.defaultValue=premium`, `RadioGroup.name=plan-basic`, `RadioGroup.defaultValue=premium`, `RadioGroup.name=plan-custom-indicator`, `RadioGroup.defaultValue=pro`, `RadioGroup.name=plan-horizontal`, `RadioGroup.orientation=horizontal`, `RadioGroup.name=plan-controlled`, `RadioGroup.value=value`, `RadioGroup.onChange=setValue`, `RadioGroup.defaultValue=pro`, `RadioGroup.name=plan-uncontrolled`, `RadioGroup.onChange=setSelection`, `RadioGroup.isInvalid=!!error`, `RadioGroup.isRequired=true`, `RadioGroup.name=plan-validation`, `RadioGroup.value=value`, `RadioGroup.onChange=true`
## Dependencias detectadas

- familias principales: `Radix UI`
- imports externos observados: `@radix-ui/react-radio-group`, `lucide-react`, `react`
## Recomendaciones de uso

- La base técnica detectada es Radix UI.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { RadioGroup } from "lizaui/ui";

export function ExampleRadioGroup() {
	return <RadioGroup />;
}
```

## Archivos fuente

- `lizaui/src/components/ui/radio-group.tsx`
- `lizaui/src/lib/utils.ts`
