# Especificación frontend v2

## 1. Base técnica y alcance frontend

React 19, TypeScript estricto, Tailwind CSS v4 y `lizaui` instalada desde npm. La referencia local de componentes es `.claude/skills/lizaui-component-reference/SKILL.md` y el código de `C:\Users\cmate\OneDrive\Documentos\busui` se usa **solo para consulta**, sin modificarlo. Antes de consumir un componente, comprobar export público, tipos `.d.ts`, peerDependencies y demo de la versión instalada. La línea visual y jerarquía vienen del [proyecto Claude Design de Buzón SOL](https://claude.ai/design/p/28bc9ee9-1a5e-4d16-a303-542e8c875f14?file=Buzon+SOL+-+Dise%C3%B1o+UX.dc.html): importar mediante el MCP `claude_design` (`https://api.anthropic.com/v1/design/mcp`, autenticación con `/design-login`), leer `Buzon SOL - Diseño UX.dc.html` y su dependencia `support.js`, e implementar el archivo de diseño. No convertir su HTML en arquitectura React.

La instalación publicada es `npm i lizaui`; preferir el comando equivalente `pnpm add lizaui` si el proyecto se inicia con pnpm o ya usa su lockfile. Respetar el gestor existente si es otro y no mezclar lockfiles.

Implementar todos los hitos frontend FE-0 a FE-5 del [plan](../plan/frontend.md): shell adaptable, selector de cuenta, resumen, bandejas, filtros/paginación, metadatos y lectura confirmada simulada, actividad y pantallas de administración con datos ficticios tipados. Las acciones reales de credencial, programación, lectura, descarga y auditoría se conectan por contratos internos cuando exista backend. No crear endpoints ni respuestas inventadas ni conectar el navegador directamente a SUNAT.

## 2. Responsabilidades y datos

- Componentes de presentación reciben modelos y callbacks tipados. La autorización mostrada viene de una sesión de app y permisos devueltos por backend; no se infiere del nombre de rol.
- Adaptador de datos local tipado para prototipo, intercambiable por cliente del backend. Modelos mínimos: `AppUser`, `RolePermissions`, `VisibleAccount`, `MailboxSummary`, `InventoryRun`, `MailItemMetadata`, `MailDetail`, `RemoteReadState`, `LocalReviewState`, `AttachmentState`, `AuditEntry`. Los IDs de cuenta y elemento son opacos; no poner RUC ni token en rutas o claves de caché visibles.
- TanStack Query v5 para datos del servidor cuando exista servicio. Query keys incluyen cuenta y filtros; datos del servidor no se duplican en Zustand. Zustand solo para estado de cliente compartido que lo justifique, por ejemplo preferencia local de panel; formularios temporales y estado de tabla pueden vivir en hooks/componentes.
- Formik + Yup para formularios implementados (login, cuenta, rol, usuario, programador) si se incluyen en la entrega. No agregar formularios vacíos por completar el sitemap. Acciones y errores se modelan con resultado tipado; no inventar autenticación ni renovación de tokens del backend.
- CSS global: Tailwind v4, `tw-animate-css` y `@source` al `node_modules/lizaui/dist` real desde la ubicación del CSS. Usar tokens de lizaui; excepciones visuales documentadas. Componente faltante: wrapper en `src/components/custom/` con referencia al componente de lizaui que inspira tokens y accesibilidad.

## 3. Componentes previstos y verificación

Usar `Table` de `lizaui/table` para listados tabulares, **no `DataTable`**. La librería local muestra entrypoints públicos para `lizaui/button`, `lizaui/checkbox`, `lizaui/modal`, `lizaui/pagination` y `lizaui/select-input`; validar la versión npm antes de fijar sus exports, props o composición. Priorizar lizaui también para alertas, menús, skeletons y campos. No importar `Dialog*` desde `lizaui/ui`; la referencia de la librería dirige los modales a `lizaui/modal`.

| Patrón | Requisito de implementación |
|---|---|
| Tabla de bandeja | Columnas definidas fuera del componente y mismo orden en encabezado, filtros y filas. No fijar columnas. Un botón en celda abre metadatos/detalle: `Table.BodyRow` no acepta `onClick`. `Table.SearchColumn` crea `<th>` y necesita alineación/espaciado apropiados. |
| Hook de tabla | Encapsular filtros, orden, página y selección. Usar `useTable({ persistKey })` / `usePagination` solo si la versión instalada lo confirma. Filtro u orden → página 1; página/filtro/orden → limpiar selección. Texto con debounce ~350 ms. |
| Servicio de lista | Query key con cuenta, bandeja, filtros, orden y página; `placeholderData: keepPreviousData` si es una consulta paginada real. Error en alerta fuera de la tabla; encabezado y filtros persisten en vacío. |
| Paginación | `Pagination` de lizaui debajo de tabla cuando volumen/diseño lo pidan; tamaños 10/20/50/100 y resumen. Totales parciales se etiquetan como tales. |
| Selección | Solo si permite una acción prevista por producto (por ejemplo lectura explícita múltiple). No crear CRUD ni acciones masivas por capacidades genéricas de Table. |
| Formularios | Labels, errores asociados, foco tras error, validación de horario y permisos. La Clave SOL es campo de solo escritura y se borra de estado cliente al cerrar/guardar. |

## 4. Tablas de gestión

Las listas de **Cuentas, Usuarios y Roles** usan `Table` de `lizaui/table` con las operaciones que cada entidad permita. Auditoría usa el mismo patrón de listado y filtros, pero es de solo lectura. Estas reglas no convierten la bandeja de Mensajes/Notificaciones en un CRUD: no se editan, activan ni desactivan mensajes en SUNAT.

- Antes de codificar, leer las referencias de `table`, `pagination`, `checkbox`, `button`, `modal` y `select-input` en la skill y verificar las props contra los `.d.ts` instalados. No usar `DataTable` ni inventar props. Usar `lizaui/modal` para crear, editar y confirmar.
- Definir `dataHeader` fuera del componente con `id`, `header`, `sort`, `size`, `minWidth`, `maxWidth`, `resizable` e `information` según admita la API real. El `id` ordenable debe corresponder a la clave aceptada por el contrato de lista. No usar `pinned`, `isStickyChecks` ni `isStickyAction`. Mantener igual número y orden de columnas entre encabezado, filtros y filas; la última columna de cada fila contiene las acciones.
- Componer `Table.Header` con `HeaderRow` (checkbox de «seleccionar todo» cuando haya selección) y `SearchRow` (un filtro por columna), y `Table.Body` con `rowKey`, `emptyText` e `isLoading` solo durante la primera carga, tras comprobar esa API. `Table.SearchColumn` crea un `<th>`: aplicar `text-left font-normal` a filtros que lo necesiten. Mantener encabezado y filtros al quedar cero resultados; mostrar errores aparte. Durante una recarga, conservar la página anterior a media opacidad. Abrir detalle mediante un `Button` en una celda, nunca con `onClick` en `Table.BodyRow`.
- Envolver `useTable({ persistKey })` y `usePagination` en un hook propio, si la versión instalada los exporta. Filtro u orden reinicia a página 1; cambiar página, filtro u orden vacía la selección. Aplicar debounce de unos 350 ms a texto; usar selects lizaui para filtros de lista. El menú de columnas usa `DropdownMenuCheckboxItem`, alterna `hiddenColumns`, conserva la elección con `persistKey` y permanece abierto tras cada cambio, conforme a la API real.
- Poner `Pagination` debajo de la tabla, con tamaños 10, 20, 50 y 100 y resumen «N registros»; cambiar tamaño vuelve a página 1 y no se muestra paginación cuando no hay registros. Mientras haya adaptador local, este reproduce filtros, orden, paginación y la forma de página tipada. Al conectar backend, pasar página, tamaño, filtros y orden al servicio, incluirlos en la query key y usar `placeholderData: keepPreviousData`; no duplicar los datos de servidor en Zustand.
- Acciones por fila: editar, activar/desactivar y las propias de la entidad, solo si el producto las contempla. El hook entrega al componente acciones ya filtradas por permisos; «Nuevo» aparece solo con permiso de creación. Los modales de alta/edición y la confirmación de cambio de estado usan controles lizaui. La Clave SOL sigue siendo de solo escritura.
- Barra de lote solo cuando hay selección, permiso y acción aplicable. La confirmación enumera los nombres afectados. Con backend real, enviar una petición por registro mediante `Promise.allSettled`, mostrar un único resultado con éxitos y fallos y refrescar la lista; un fallo no revierte los demás. El adaptador local debe permitir probar esa misma semántica sin simular llamadas a SUNAT.
- Verificar en tests el reinicio de página, limpieza de selección, ciclo de orden ascendente/descendente/sin orden, filtro sin acentos, selección total, confirmación de lote y ocultación de columnas cuando esas funciones estén presentes. La parametrización SQL, lista blanca de `ORDER BY`, validación de filtros y tests del constructor de consultas pertenecen al backend, no a este frontend.

## 5. Contrato de interacción frontend–backend (semántico)

El backend deberá entregar sesión de app/permisos/cuentas visibles; resúmenes y páginas de metadatos por cuenta; estado/progreso de consulta; detalle **solo tras un comando de lectura explícito**; referencias de archivos y descarga autorizada; usuarios, roles, configuración, auditoría y avisos. Este documento no asigna rutas HTTP ni forma JSON definitiva. El frontend envía `accountId` opaco y los comandos separados `startInventory`, `readContent`, `downloadFile`, `setReviewed`, `replaceCredential`, `testConnection`, `saveSchedule`, `resumeRun`. El servidor valida permiso, cuenta y estado para cada comando; un error `forbidden`, `needsCredential`, `paused`, `remoteExpired`, `remoteUnavailable` o `partial` se traduce a los estados UX definidos. Ver [spec backend](../backend/spec.md). La conexión concreta se definirá en una fase posterior.

La bandeja no debe pedir detalle al montar una fila, previsualizar, navegar con teclado, generar un tooltip ni calcular adjuntos. Abrir ruta de detalle solo muestra metadatos hasta el comando explícito `readContent`. Una respuesta tardía de la cuenta A nunca actualiza la vista de B. El HTML remoto se presenta sanitizado y aislado de los estilos/JS de la aplicación.

## 6. Pruebas de aceptación frontend

1. Lógica de tabla: reset de página, limpieza de selección, alternancia de orden, debounce y estado vacío con filtros visibles.
2. Cuenta y permisos: selector solo con cuentas autorizadas; ruta directa no muestra datos ajenos; cambiar cuenta no filtra datos ni estado de la anterior.
3. Lectura: navegación al metadato no llama `readContent`; la confirmación sí, una vez; cancelar no llama; «Revisado» no cambia el estado remoto.
4. Inventario parcial/completo y error de credencial presentan textos, conteos y acciones correctos; sin «total verificado» para un barrido incompleto.
5. Compilar, `tsc`, lint y pruebas existentes. Revisar escritorio 1280×820 y móvil ~390 px frente al artefacto; documentar diferencias visibles.
