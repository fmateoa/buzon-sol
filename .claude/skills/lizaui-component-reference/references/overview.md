# LizaUI Reference Overview

## Alcance

- este skill cubre los entrypoints públicos de `lizaui/*`, `lizaui/ui` y los hooks públicos del entrypoint raíz `lizaui`
- las referencias se generan desde el código fuente real para mantener imports, tipos y nombres alineados
- cuando un componente hereda props de Radix, React Aria o HTML, la referencia lista primero las props locales detectables y deja explícita la herencia
- cada referencia puede incluir variantes de `tailwind-variants`/`cva`, demos reales de `src/demo` y props observadas en esos demos

## Conteo detectado

- componentes públicos: 28
- familias UI: 28
- hooks públicos: 4

## Cómo usar estas referencias

1. Identifica el entrypoint público que vas a usar.
2. Lee primero el archivo correspondiente en `references/components`, `references/ui` o `references/hooks`.
3. Para props locales y tipos, revisa `Props y tipos clave`; para valores permitidos de estilos usa `Variantes detectadas`.
4. Para patrones de uso reales, revisa `Demos y variaciones reales`, que apunta a `lizaui/src/demo` cuando existe.
5. Si necesitas el detalle exacto de props heredadas, consulta también los archivos fuente listados al final de cada referencia.
6. Si la librería cambió, vuelve a generar estas referencias con `node .agents/skills/lizaui-component-reference/scripts/generate_references.mjs`.

## Guías especializadas

- `SelectInput` y `Autocomplete` async: `references/select-input-and-autocomplete.md`

## Índice de componentes

- `autocomplete`: `references/components/autocomplete.md`
- `button`: `references/components/button.md`
- `button-group`: `references/components/button-group.md`
- `button-v2`: `references/components/button-v2.md`
- `calendar`: `references/components/calendar.md`
- `checkbox`: `references/components/checkbox.md`
- `chip`: `references/components/chip.md`
- `data-table`: `references/components/data-table.md`
- `divider`: `references/components/divider.md`
- `drawer`: `references/components/drawer.md`
- `form-tabs`: `references/components/form-tabs.md`
- `meter`: `references/components/meter.md`
- `modal`: `references/components/modal.md`
- `pagination`: `references/components/pagination.md`
- `phone-input`: `references/components/phone-input.md`
- `progress-bar`: `references/components/progress-bar.md`
- `radio`: `references/components/radio.md`
- `radio-group`: `references/components/radio-group.md`
- `ripple`: `references/components/ripple.md`
- `select-input`: `references/components/select-input.md`
- `slider`: `references/components/slider.md`
- `switch-group-v2`: `references/components/switch-group-v2.md`
- `table`: `references/components/table.md`
- `time-input`: `references/components/time-input.md`
- `toggle-switch`: `references/components/toggle-switch.md`
- `toolbar`: `references/components/toolbar.md`
- `tooltip`: `references/components/tooltip.md`
- `travel-calendar`: `references/components/travel-calendar.md`

## Índice de UI

- `accordion`: `references/ui/accordion.md`
- `alert-dialog`: `references/ui/alert-dialog.md`
- `aspect-ratio`: `references/ui/aspect-ratio.md`
- `avatar`: `references/ui/avatar.md`
- `badge`: `references/ui/badge.md`
- `card`: `references/ui/card.md`
- `command`: `references/ui/command.md`
- `confirmation`: `references/ui/confirmation.md`
- `context-menu`: `references/ui/context-menu.md`
- `dropdown-menu`: `references/ui/dropdown-menu.md`
- `hover-card`: `references/ui/hover-card.md`
- `input`: `references/ui/input.md`
- `input-group`: `references/ui/input-group.md`
- `input-otp`: `references/ui/input-otp.md`
- `label`: `references/ui/label.md`
- `label-error`: `references/ui/label-error.md`
- `menubar`: `references/ui/menubar.md`
- `navigation-menu`: `references/ui/navigation-menu.md`
- `popover`: `references/ui/popover.md`
- `radio-group`: `references/ui/radio-group.md`
- `resizable`: `references/ui/resizable.md`
- `scroll-area`: `references/ui/scroll-area.md`
- `select`: `references/ui/select.md`
- `sheet`: `references/ui/sheet.md`
- `skeleton`: `references/ui/skeleton.md`
- `switch`: `references/ui/switch.md`
- `tabs`: `references/ui/tabs.md`
- `textarea`: `references/ui/textarea.md`

## Índice de hooks

- `use-confirmation`: `references/hooks/use-confirmation.md`
- `use-draggable`: `references/hooks/use-draggable.md`
- `use-drawer`: `references/hooks/use-drawer.md`
- `use-modal`: `references/hooks/use-modal.md`

