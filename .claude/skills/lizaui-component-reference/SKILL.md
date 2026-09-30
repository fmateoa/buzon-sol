---
name: lizaui-component-reference
description: Trabaja con la librería `lizaui` usando su API pública real, código fuente, tipos, variantes, demos y referencias generadas ubicadas en `/Users/leonardo/Documents/busone/lizaui`. Usa este skill siempre que el usuario pida crear, refactorizar, corregir, documentar, explicar, migrar, consumir o actualizar referencias de componentes, hooks, compound components, props, ejemplos, variaciones visuales o wrappers basados en React Aria/Radix/react-select dentro de LizaUI, incluso si menciona `SelectInput`, `Autocomplete`, `InputAutocompleteForm`, `lizaui/select-input`, `lizaui/autocomplete`, `lizaui/ui`, `DataTable`, `Slider`, `Modal`, `Dialog`, `Input`, `Select`, `PhoneInput` o cualquier componente propio de ese design system.
---

# LizaUI Component Reference

Usa este skill para trabajar con la superficie pública real de `lizaui` sin inventar props, imports, variantes ni patrones de composición.

## Resultado esperado

Cuando apliques este skill, entrega:

- el entrypoint público correcto, por ejemplo `lizaui/button`, `lizaui/ui` o `lizaui`
- la referencia exacta a leer para el componente o hook involucrado
- props relevantes, tipos de datos, props heredadas y subcomponentes compound si aplican
- variantes reales detectadas en `tailwind-variants`/`cva`, incluyendo valores permitidos y defaults cuando existan
- demos reales de `lizaui/src/demo` y variaciones observadas cuando existan
- ejemplo de uso alineado con el código real del paquete y sus demos
- riesgos de integración si el componente depende de React Aria, Radix, `react-select`, `react-phone-number-input`, `react-time-picker` u otra base externa

## Flujo recomendado

1. Lee primero `references/overview.md`.
2. Identifica si el caso cae en una de estas superficies:
   - `references/components/*.md` para entrypoints públicos como `lizaui/button` o `lizaui/data-table`
   - `references/ui/*.md` para familias exportadas desde `lizaui/ui`
   - `references/hooks/*.md` para hooks públicos exportados desde `lizaui`
   - [references/select-input-and-autocomplete.md](references/select-input-and-autocomplete.md) para `SelectInput`, el `Autocomplete` async basado en `react-select`, selección simple/múltiple, formularios, portales, clearing, “Select all”, cargas iniciales y migración desde el autocomplete legado
3. En la referencia concreta, revisa en este orden:
   - `Exportaciones públicas` para confirmar el import y nombre exportado
   - `Props y tipos clave` para props locales, tipos de datos y herencias
   - `Variantes detectadas` para valores permitidos de `variant`, `size`, `color`, `orientation`, etc.
   - `Demos y variaciones reales` para patrones usados en `lizaui/src/demo`
   - `Archivos fuente` si necesitas resolver props heredadas o comportamiento interno
4. Usa `references/_inventory.json` si necesitas ubicar rápido un nombre exportado, archivos fuente, variantes, demos o dependencias base.
5. Si el usuario necesita una respuesta exacta sobre props heredadas por React Aria, Radix, HTML o librerías externas, revisa también los archivos fuente listados al final de la referencia.
6. Si el pedido menciona “select” o “autocomplete”, primero desambigua la superficie por el import o las props:
   - `lizaui/select-input`: `SelectInput` estático y `Autocomplete` async; lee la guía especializada completa y `references/components/select-input.md`
   - `lizaui/autocomplete`: `InputAutocompleteForm` legado controlado por texto; lee la sección legacy de la guía y `references/components/autocomplete.md`
   - `lizaui/ui`: `Select` compound basado en Radix; lee `references/ui/select.md`
7. Si `lizaui` cambió, si el usuario pide actualizar este skill, o si sospechas que la referencia está desactualizada, regenera todo con:

```bash
node .agents/skills/lizaui-component-reference/scripts/generate_references.mjs
```

8. Después de regenerar, revisa `references/overview.md` y `references/_inventory.json` para confirmar conteos, entrypoints y exports destacados antes de responder o editar ejemplos.

## Modales: `lizaui/modal` (el `Dialog` de `lizaui/ui` fue eliminado)

`lizaui/ui` ya no exporta `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger`, `DialogOverlay` ni `DialogPortal`. Todo modal nuevo o migrado usa `Modal`, `ModalHeader`, `ModalBody` y `ModalFooter` de `lizaui/modal` (referencia: `references/components/modal.md`). Si ves un `Dialog` de `lizaui/ui` en código viejo, migralo. `AlertDialog`/`AlertConfirmation` y `Sheet` siguen existiendo y no forman parte de esta regla. `CommandDialog` se conserva con la misma API (`open`, `onOpenChange`, `title`, `description`, `className`, `showCloseButton`), ahora montado sobre `Modal`.

Patrón de referencia: `frontend/src/features/itinerary/modal/modal-itenerary.tsx`, con `useModalHooks` + `useDraggable`:

```tsx
const { isOpen, isVisibleModal, closeModal } = modal; // UseModalType de useModalHooks()
const targetRef = useRef<HTMLDivElement>(null);
const { moveProps } = useDraggable({ targetRef: targetRef as RefObject<HTMLElement>, canOverflow: true, isDisabled: !isOpen });

<Modal ref={targetRef} isShow={isOpen} isVisible={isVisibleModal} modalId={modalId} placement="top" size="3xl" onClickOutside={closeModal}>
	<ModalHeader {...moveProps} title="Título" onClick={closeModal} />
	{isOpen && <ModalBody>…</ModalBody>}
	<ModalFooter>…</ModalFooter>
</Modal>
```

Con estado booleano simple (`open`/`onClose`) se pasa `isShow={open} isVisible={open} onClickOutside={onClose}`.

Equivalencias al migrar desde `Dialog`:

- `<Dialog open onOpenChange>` → `isShow` + `isVisible` + `onClickOutside` (clic en el overlay y tecla Escape llaman a `onClickOutside`).
- `DialogContent className="sm:max-w-xl"` → `size="xl"` (`xs`…`5xl`, `full`); para anchos arbitrarios usa `classNameDialog="max-w-[760px]"`, que se fusiona con `tailwind-merge` y gana sobre `size`. `backdrop` se conserva (`transparent | opaque | blur`).
- `DialogHeader` + `DialogTitle` + `DialogDescription` → `ModalHeader title="…"` o `ModalHeader` con hijos (`<h2>` + `<p className="text-sm font-normal text-muted-foreground">`). `ModalHeader` ya trae el botón de cerrar: pásale `onClick` y deja espacio con `pr-14` si hay contenido a la derecha. `showCloseButton={false}` lo oculta.
- Título solo para lectores de pantalla (`DialogTitle className="sr-only"`) → `ModalHeader className="sr-only" title="…"`.
- `DialogClose asChild` / botón X propio → el X de `ModalHeader`, o un `Button` con `onClick={onClose}`.
- `DialogFooter` → `ModalFooter`.
- Contenedor con `p-0` y secciones propias con bordes: no uses `ModalBody` (agrega `px-6` y scroll); pon los hijos directos dentro de `Modal` y usa `classNameDialog="overflow-hidden"`. Para limitar la altura usa `classNameContent="max-h-[…]"` y dale `min-h-0 flex-1 overflow-y-auto` a la zona con scroll (el contenedor interno es `flex flex-col`).

Diferencias de comportamiento con Radix que hay que cubrir a mano:

- **Sin foco automático ni trampa de foco.** Radix enfocaba el primer elemento enfocable; con `Modal` agrega `autoFocus` al input de búsqueda principal.
- **Escape en modales anidados.** Cada `Modal` abierto escucha `keydown` en `document`, así que Escape cierra todos a la vez. Pásale `isKeyboardDismissDisabled={childOpen}` al modal padre mientras el hijo está abierto.
- **Portal en `#modal-root`.** Ese nodo va antes de los portales de Radix (que se agregan al final de `body`) y comparte `z-50`, así que un `DropdownMenu`/`Popover` abierto queda encima del modal, mientras que `AlertConfirmation` sí se ve por encima del modal, que es lo deseado. No subas el `z-index` del modal: taparía los `AlertConfirmation` que se abren desde él.
- **Modal abierto desde un `DropdownMenu` y renderizado dentro de él** (por ejemplo `ShadowLoginControl mode="menu"` en `user-menu-dropdown.tsx`): el dropdown modal de Radix bloquea `pointer-events` y el foco fuera de su contenido, así que el `Modal` no respondería. Usa `<DropdownMenu modal={false}>` y oculta el contenido del dropdown (`invisible`) mientras el modal está abierto.
- **Variables CSS con scope** (por ejemplo `--wsp-*` de `.wsp-root`): el portal pierde el ancestro; pon la clase en `classNameDialog` (`classNameDialog="wsp-root overflow-hidden"`).

## Cómo responder bien con este skill

- Prioriza imports públicos del paquete. Evita recomendar imports profundos a `src/*` salvo que el usuario esté editando la librería misma.
- Si el componente es compound, explica primero la raíz y luego los slots exportados.
- Si la API principal hereda props de Radix, React Aria o HTML, deja claro que además de las props locales acepta la API base del primitive correspondiente.
- Si el componente usa una base externa especializada, menciónala para evitar asumir comportamientos incorrectos.
- Cuando el usuario pregunte por props, distingue entre props locales detectadas, variantes del sistema de estilos y props heredadas de primitives externos.
- Cuando el usuario pida un ejemplo, prioriza los patrones vistos en `Demos y variaciones reales`; si no hay demo, usa el ejemplo generado por la referencia y valida contra los tipos/exports.
- Para `SelectInput` y su `Autocomplete`, no asumas que aceptan cualquier prop de `react-select`: exponen una API curada en `SelectGeneralProps`. Usa solamente las props públicas documentadas.
- En ejemplos nuevos de `lizaui/select-input`, tipa la opción y el modo simple/múltiple, usa IDs como valor controlado, trata el clearing mediante `action === "clear"` y declara `selectAllMode` explícitamente.
- En autocomplete async, elige una sola estrategia de carga inicial. No combines `defaultOptions={true}` con una petición manual `loadOption("")` en `onMenuOpen`.

## Recursos incluidos

- visión general: [references/overview.md](references/overview.md)
- índice estructurado para búsquedas rápidas: [references/_inventory.json](references/_inventory.json)
- referencias de entrypoints públicos: `references/components/*.md`
- referencias de `lizaui/ui`: `references/ui/*.md`
- referencias de hooks públicos: `references/hooks/*.md`
- guía completa de selección y búsqueda async: [references/select-input-and-autocomplete.md](references/select-input-and-autocomplete.md)
- generador determinístico: [scripts/generate_references.mjs](scripts/generate_references.mjs), extrae entrypoints desde `lizaui/package.json`, UI desde `src/components/ui/index.ts`, hooks públicos, props/tipos, variantes y demos desde `lizaui/src/demo`
- metadata UI del skill: [agents/openai.yaml](agents/openai.yaml)

## Verificación mínima

- el import sugerido coincide con la API pública del paquete
- el componente o hook sí existe en `lizaui`
- las props o subcomponentes nombrados aparecen en la referencia correspondiente
- los valores de variantes (`variant`, `size`, `color`, etc.) aparecen en `Variantes detectadas` o en el archivo fuente
- los ejemplos pedidos por el usuario no contradicen los demos reales si existe una demo para ese componente
- si hay herencia de props externas, se explicita
- el ejemplo de uso no contradice la estructura compound real
- los consumidores de `lizaui/select-input` no pasan objetos completos en `value`, no tratan el ID `0` como vacío y no dependen de `item.id` para detectar clearing
- `selectAllMode` y `selectAllOptionId` están definidos explícitamente cuando existe una opción “All” o un ID `0`
- `defaultOptions`, `onMenuOpen` y la carga inicial del autocomplete no producen llamadas duplicadas con una consulta vacía
- ningún consumidor importa `Dialog*` desde `lizaui/ui`; los modales usan `lizaui/modal`
- si se regeneraron referencias, `node .agents/skills/lizaui-component-reference/scripts/generate_references.mjs` termina sin error y el overview/inventory reflejan el código actual
