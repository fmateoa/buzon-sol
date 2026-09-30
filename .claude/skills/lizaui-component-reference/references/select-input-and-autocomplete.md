# SelectInput and Autocomplete

Guía especializada para la API moderna de selección de LizaUI 11.0.5. Está basada en los tipos, componentes, hooks, demos y pruebas de `lizaui/src/components/select-input`.

## Elegir la API correcta

LizaUI expone tres superficies diferentes que no deben confundirse:

| Necesidad                                 | Import público        | API                                              | Base                  |
| ----------------------------------------- | --------------------- | ------------------------------------------------ | --------------------- |
| Opciones locales, valor controlado por ID | `lizaui/select-input` | `SelectInput`                                    | `react-select`        |
| Opciones remotas, valor controlado por ID | `lizaui/select-input` | `Autocomplete`                                   | `react-select/async`  |
| Input de texto con dropdown legado        | `lizaui/autocomplete` | `InputAutocompleteForm`                          | implementación propia |
| Select compound de bajo nivel             | `lizaui/ui`           | `Select`, `SelectTrigger`, `SelectContent`, etc. | Radix Select          |

Para código nuevo de formularios y búsquedas remotas, normalmente corresponde `SelectInput` o `Autocomplete` desde `lizaui/select-input`.

## Imports públicos

Los componentes y los tipos se importan desde entrypoints diferentes:

```tsx
import { Autocomplete, SelectInput } from "lizaui/select-input";
import type {
  AutoCompleteProps,
  OnchangeSelectProps,
  SelectInputRef,
  SelectOption,
  SelectProps,
} from "lizaui";
```

No uses imports profundos a `lizaui/src/*`. `SelectInput` y `Autocomplete` tienen una API curada sobre `react-select`; no aceptan automáticamente todas las props de esa librería.

## Modelo de opciones y valores

Una opción pública tiene este contrato:

```ts
type SelectOptionId = string | number | null;

interface SelectOption<Id extends SelectOptionId = SelectOptionId> {
  id: Id;
  name?: string | number | null;
  isDisabled?: boolean;
  disabled?: boolean; // Deprecated; use isDisabled.
}
```

Extiende el contrato para conservar campos del dominio:

```ts
interface CityOption extends SelectOption<number> {
  code: string;
  countryName: string;
}
```

Reglas importantes:

- `value` contiene el ID o los IDs, no el objeto completo.
- En modo simple usa `number | string | null | undefined` según el ID.
- En modo múltiple usa un array readonly de IDs, `null` o `undefined`.
- El ID numérico `0` es válido y no representa vacío.
- `null`, `undefined` y `""` representan ausencia de selección en modo simple. No uses `null` ni `""` como ID real de una opción controlada.
- Los IDs se comparan mediante `String(id ?? "")`. No mezcles IDs equivalentes como `1` y `"1"` en el mismo conjunto; colisionan.
- Usa `isDisabled`. `disabled` solo existe para compatibilidad.
- La etiqueta visible se obtiene de `String(option.name ?? "")`.

## Selección simple

Tipa la opción y fija el modo simple para obtener callbacks precisos:

```tsx
import { SelectInput } from "lizaui/select-input";
import type { SelectOption } from "lizaui";
import { useState } from "react";

interface StatusOption extends SelectOption<number> {
  description?: string;
}

const statusOptions: readonly StatusOption[] = [
  { id: 0, name: "Pending" },
  { id: 1, name: "Confirmed" },
  { id: 2, name: "Cancelled", isDisabled: true },
];

export function StatusSelect() {
  const [statusId, setStatusId] = useState<number | null>(null);

  return (
    <SelectInput<StatusOption, false>
      required
      data={statusOptions}
      id="statusId"
      label="Status"
      name="statusId"
      selectAllMode="off"
      value={statusId}
      onChange={({ action, item }) => {
        setStatusId(action === "clear" ? null : item.id);
      }}
    />
  );
}
```

Aunque `item` conserva una forma legacy durante `clear`, su `id` se reemplaza por `""`. Usa `action === "clear"` y guarda `null` o el valor vacío que corresponda al formulario. `data` siempre es un array: contiene la selección completa incluso en modo simple y queda vacío al limpiar.

## Selección múltiple

En modo múltiple, deriva el estado completo desde `data`; no reconstruyas la selección usando solamente `item`:

```tsx
import { SelectInput } from "lizaui/select-input";
import type { SelectOption } from "lizaui";
import { useState } from "react";

interface RoleOption extends SelectOption<number> {
  permissionCount: number;
}

const roleOptions: readonly RoleOption[] = [
  { id: 1, name: "Seller", permissionCount: 8 },
  { id: 2, name: "Supervisor", permissionCount: 14 },
];

export function RoleMultiSelect() {
  const [roleIds, setRoleIds] = useState<readonly number[]>([]);

  return (
    <SelectInput<RoleOption, true>
      isMulti
      data={roleOptions}
      label="Roles"
      name="roleIds"
      selectAllMode="off"
      value={roleIds}
      onChange={({ data }) => setRoleIds(data.map((option) => option.id))}
    />
  );
}
```

`item` representa la opción afectada al seleccionar, quitar o deseleccionar. En un clear múltiple puede contener las opciones eliminadas. `data` es la fuente confiable de la selección resultante.

El marcador de selección múltiple es visual y no introduce un checkbox interactivo dentro de la opción. `isCheckMultiOptions={false}` oculta ese marcador.

## Select all

La API moderna usa `selectAllMode`:

| Modo          | Comportamiento                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `"off"`       | Ningún ID es especial. Usa este valor por defecto en consumidores que no tienen una opción “All”.                         |
| `"all"`       | Seleccionar la opción sentinel selecciona todas las opciones; completar todas las opciones también incorpora el sentinel. |
| `"exclusive"` | La opción sentinel queda sola; seleccionar una opción regular elimina el sentinel y viceversa.                            |

`selectAllOptionId` identifica el sentinel y su default es `0`. La prop legacy `isItemAll` está deprecada: `"only"` se traduce a `"exclusive"`; `"all"` y `"off"` conservan su significado. Si ambas props existen, `selectAllMode` tiene prioridad.

El modo efectivo por default del componente es `"all"`, porque `isItemAll` conserva el default legacy `"all"`. Por eso los consumidores nuevos deben declarar `selectAllMode="off"` cuando no existe un sentinel real.

Declara siempre el modo de forma explícita en código nuevo:

```tsx
<SelectInput
  isMulti
  data={options}
  selectAllMode="all"
  selectAllOptionId={0}
  value={selectedIds}
  onChange={({ data }) => setSelectedIds(data.map(({ id }) => id))}
/>
```

Si `0` es una opción normal, usa `selectAllMode="off"`.

## Autocomplete async

`Autocomplete` comparte el contrato visual, controlado y de eventos de `SelectInput`, pero sustituye `data` por:

```ts
loadOption: (inputValue: string) => Promise<readonly Option[]>;
defaultOptions?: boolean | readonly Option[];
cacheOptions?: boolean; // default: true
```

Ejemplo con búsqueda remota, clearing y cancelación:

```tsx
import { Autocomplete } from "lizaui/select-input";
import type { SelectOption } from "lizaui";
import { useCallback, useEffect, useRef, useState } from "react";

interface CityOption extends SelectOption<number> {
  code: string;
}

async function searchCities(
  query: string,
  signal: AbortSignal,
): Promise<readonly CityOption[]> {
  const response = await fetch(
    `/api/cities?query=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!response.ok) throw new Error("Unable to load cities");
  return response.json() as Promise<readonly CityOption[]>;
}

export function CityAutocomplete() {
  const [cityId, setCityId] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadOption = useCallback(async (inputValue: string) => {
    const query = inputValue.trim();
    if (query.length < 2) return [];

    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;

    try {
      return await searchCities(query, request.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return [];
      throw error;
    }
  }, []);

  return (
    <Autocomplete<CityOption, false>
      defaultOptions={false}
      label="City"
      loadOption={loadOption}
      name="cityId"
      selectAllMode="off"
      value={cityId}
      onChange={({ action, item }) => {
        setCityId(action === "clear" ? null : item.id);
      }}
    />
  );
}
```

### Estrategias de carga inicial

Elige una sola estrategia:

| Configuración                                    | Resultado                                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sin `defaultOptions`, o `defaultOptions={false}` | No consulta al montar y no muestra opciones hasta que el usuario escribe.                                                              |
| `defaultOptions={initialOptions}`                | Muestra esas opciones inmediatamente y las incorpora al caché de selección; no necesita una consulta vacía.                            |
| `defaultOptions` o `defaultOptions={true}`       | `react-select/async` invoca `loadOption("")` al montar. Úsalo solamente si el endpoint admite una consulta vacía.                      |
| Carga externa en `onMenuOpen`                    | Resérvala para lazy loading intencional, controla `loading/loaded` en el consumidor y pasa el resultado como array a `defaultOptions`. |

Antipatrón que produce peticiones duplicadas o carreras:

```tsx
<Autocomplete
  defaultOptions
  loadOption={loadOption}
  onMenuOpen={() => void loadOption("")}
/>
```

`onMenuOpen` siempre se reenvía y se ejecuta cada vez que abre el menú. El componente no espera una promesa devuelta por ese callback. No lo uses como segunda carga inicial y no pases callbacks vacíos como `onMenuOpen={() => undefined}`.

Si realmente necesitas lazy loading externo:

```tsx
const [initialOptions, setInitialOptions] = useState<readonly CityOption[]>([]);
const [initialLoading, setInitialLoading] = useState(false);
const initialLoadedRef = useRef(false);

const handleMenuOpen = async () => {
  if (initialLoadedRef.current || initialLoading) return;
  initialLoadedRef.current = true;
  setInitialLoading(true);

  try {
    setInitialOptions(await fetchPopularCities());
  } catch {
    initialLoadedRef.current = false;
  } finally {
    setInitialLoading(false);
  }
};

<Autocomplete
  defaultOptions={initialOptions}
  isLoading={initialLoading}
  loadOption={loadOption}
  onMenuOpen={handleMenuOpen}
/>;
```

### Selección, resultados y caché

El autocomplete mantiene conceptos separados:

- `value`: ID o IDs seleccionados externamente.
- resultado actual: array resuelto por la última llamada relevante de `loadOption`.
- opciones iniciales: array de `defaultOptions`.
- caché de selección: unión por ID de opciones iniciales y resultados cargados, necesaria para resolver el objeto correspondiente a `value`.
- caché de consultas: comportamiento de `react-select/async`, controlado por `cacheOptions`.

Si editas un registro con un ID preseleccionado, incluye su opción en `defaultOptions` o asegúrate de que ya haya sido cargada. Un ID que no existe en las opciones disponibles no puede mostrar su etiqueta.

Las respuestas async se incorporan al caché por ID incluso si llegan fuera de orden. Esto evita perder opciones seleccionadas, pero no cancela trabajo de red: si importa el costo de la petición, implementa `AbortController` o control de secuencia en el consumidor.

Cuando `loadOption` devuelve un array vacío, LizaUI intenta filtrar localmente por `name` las opciones ya disponibles. Por eso un resultado remoto vacío puede seguir mostrando coincidencias del caché local.

## Contrato de onChange

Todas las variantes llaman:

```ts
interface OnchangeSelectProps<Option, IsMulti> {
  item: Option | readonly Option[] | null;
  data: readonly Option[];
  action:
    | "clear"
    | "select-option"
    | "deselect-option"
    | "remove-value"
    | "pop-value"
    | "create-option";
}
```

La forma exacta de `item` depende del literal `isMulti`. Reglas de consumo:

- simple: usa `item` para la opción afectada, pero detecta clearing mediante `action`;
- múltiple: usa `data` como selección completa;
- `data` siempre es array por compatibilidad, incluso en simple;
- no uses comprobaciones falsy (`if (!item.id)`) porque rompen el ID `0`;
- no infieras clearing por `item === null`; en simple existe una forma legacy con `id: ""`.

## Formularios, errores y accesibilidad

- `id` se asigna al combobox. Si se omite, React `useId()` genera uno estable y compatible con SSR.
- `label` se asocia mediante `htmlFor`/`inputId`.
- Sin `label`, proporciona `aria-label` o `aria-labelledby`. Si no se proporciona, existe un fallback basado en `name` o `placeholder`, pero un nombre accesible explícito es preferible.
- `required` configura `aria-required` y participa en la validación nativa del formulario.
- `name` identifica el control y también se restaura en el evento `onBlur` cuando `react-select` no lo entrega.
- `form` permite asociarlo a un formulario por ID.
- El error solo es visible y marca `aria-invalid` cuando hay `error`, alguna entrada de `touched` es verdadera y el control no está deshabilitado.
- Un array de errores se une con comas; un array de `touched` es válido si al menos un elemento es verdadero.
- El error visible tiene un ID `${inputId}-error` y se conecta con `aria-errormessage`/`aria-describedby`.
- `isSearchable={false}` se reenvía al combobox y debe usarse cuando el usuario no puede escribir.

Integración con Formik:

```tsx
<Autocomplete<PersonOption, false>
  required
  defaultOptions={initialPeople}
  error={formik.errors.personId}
  label="Person"
  loadOption={loadPeople}
  name="personId"
  selectAllMode="off"
  touched={formik.touched.personId}
  value={formik.values.personId}
  onBlur={formik.handleBlur}
  onChange={({ action, item }) => {
    void formik.setFieldValue("personId", action === "clear" ? null : item.id);
  }}
/>
```

## Portales y SSR

- `SelectInput` usa portal por default (`isPortal=true`).
- `Autocomplete` no usa portal por default (`isPortal=false`).
- Con portal, el menú se monta en `document.body` solamente en cliente; durante SSR el target es `null` y no se accede directamente a `document`.
- Usa `isPortal` cuando el menú está dentro de un contenedor con overflow o stacking context que podría recortarlo.
- `menuPosition` acepta los valores de `react-select` y su default es `"absolute"`.
- `widthMenu` acepta número o string y su default es `"100%"`.

## Renderizado y comportamiento visual

- `childrenOption={({ data, isSelected }) => ...}` personaliza el contenido de cada opción.
- `childrenSingleValue={({ data }) => ...}` personaliza el valor simple seleccionado.
- `startValueContent` agrega contenido al inicio del control.
- `showDropdownIndicator` controla el indicador del menú.
- `showCheckItemSelected` controla la marca visual de la opción seleccionada.
- `isCheckMultiOptions` controla el marcador visual del modo múltiple.
- `color`: `"primary" | "secondary" | "success" | "warning" | "danger" | "default"`; default `"default"`.
- `size`: `"sm" | "md" | "lg"`; default `"md"`.
- `radius`: `"xs" | "sm" | "md" | "lg" | "full" | "none" | "input"`; default `"input"`.
- `isClearable`: default `true`.
- `isSearchable`: default `true`.
- `maxMenuHeight`: default `200`.
- `placeholder`: default `"Select"`.
- `noOptionsMessage`: default `"No options"`.
- `loadingMessage`: default `"Loading..."`.
- `pattern` sanea el texto de búsqueda usando los patrones públicos de LizaUI.
- `classNameContainer` estiliza el wrapper del campo.
- `ref` expone el `SelectInstance<Option, IsMulti>` de `react-select` para acciones imperativas como `focus()` y `blur()`.

## Migración desde InputAutocompleteForm

`InputAutocompleteForm` de `lizaui/autocomplete` controla texto, no un ID de `react-select`. No cambies el import sin adaptar el estado:

| Legacy                | API moderna                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `data`                | `defaultOptions` para datos iniciales o resultado de `loadOption`                          |
| `value` de texto      | `value` con ID simple o array de IDs                                                       |
| `onChange` del input  | la consulta llega a `loadOption(inputValue)`                                               |
| `onClickItem(option)` | `onChange({ item, data, action })`                                                         |
| `errors`              | `error`                                                                                    |
| `loading`             | `isLoading`                                                                                |
| `readOnly`            | evalúa `disabled` o `isSearchable={false}` según la intención; no son equivalentes exactos |

Mantén `InputAutocompleteForm` solamente cuando el formulario necesita controlar por separado el texto libre y la opción seleccionada, o cuando dependa de sus callbacks y layout legacy.

## Checklist de revisión

- El componente viene de `lizaui/select-input`, salvo que se haya elegido conscientemente la API legacy o Radix.
- La opción tiene un tipo concreto y el callback conoce el modo simple/múltiple.
- `value` contiene IDs, no opciones.
- `0` se compara explícitamente y nunca con una condición falsy.
- Clearing usa `action === "clear"`.
- Multi-select deriva el estado desde `data`.
- `selectAllMode` está declarado y `selectAllOptionId` coincide con el sentinel.
- Existe una sola estrategia de carga inicial del autocomplete.
- `onMenuOpen` no duplica `loadOption("")` y tiene guardas si hace lazy loading.
- La opción seleccionada está presente en `defaultOptions` o en el caché de resultados.
- Los errores requieren `touched` y están asociados al campo.
- Hay `label`, `aria-label` o `aria-labelledby`.
- Se prueban teclado, clearing, ID `0`, required, “All”, respuestas fuera de orden, SSR y portales según el caso.
