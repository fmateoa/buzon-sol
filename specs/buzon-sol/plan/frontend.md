# Plan de desarrollo frontend · Buzón SOL v2

Este plan cubre **solo el frontend**. Puede desarrollarse y verificarse con datos ficticios tipados y un adaptador local, sin esperar la API real. Los acuerdos definitivos de endpoints y la integración frontend–backend se planificarán después de completar los dos desarrollos por separado.

**Fuentes:** [spec frontend](../frontend/spec.md), [UX/UI](../ux-ui/design.md) y [requisitos de producto](../product/requirements.md). Para importar el diseño, usar el MCP `claude_design` (`https://api.anthropic.com/v1/design/mcp`, autenticación con `/design-login`) y el [proyecto Buzón SOL - Diseño UX](https://claude.ai/design/p/28bc9ee9-1a5e-4d16-a303-542e8c875f14?file=Buzon+SOL+-+Dise%C3%B1o+UX.dc.html). Leer `Buzon SOL - Diseño UX.dc.html` y el `support.js` que importa; implementar la interfaz descrita por ese archivo. Los flujos visuales no autorizan llamadas directas del navegador a SUNAT.

| Hito | Entregable frontend | Criterio de cierre |
|---|---|---|
| FE-0 Base | React 19, TypeScript estricto, Tailwind v4, `lizaui` desde el registro npm (preferir `pnpm add lizaui`), rutas, tema y datos ficticios tipados. | Build, `tsc` y lint; imports públicos y peerDependencies de lizaui revisados. |
| FE-1 Acceso y navegación | Login visual de la app, shell de escritorio/móvil, selector de cuentas y guardas de interfaz por permiso; vistas vacías y sin acceso. | Navegación por teclado; solo cuentas del rol en selector; rutas ajenas muestran estado sin acceso con fixtures. |
| FE-2 Resumen y bandejas | Resumen por cuenta, Mensajes/Notificaciones, búsqueda, filtros, orden, paginación, estados completo/parcial/en curso y discrepancia con SUNAT. | Pruebas de reset de página, limpieza de selección, alternancia de orden y vacío con filtros visibles; revisión visual D4/D5/M1. |
| FE-3 Lectura y archivos simulados | Vista de metadatos sin cuerpo, confirmación de no leído, detalle abierto simulado, estados remotos/locales separados, descarga simulada con progreso/error. | Cancelar no invoca `readContent` del adaptador; solo confirmar lo invoca; revisión local no cambia estado remoto; revisión D6/D7/M2/M3. |
| FE-4 Actividad y administración visual | Actividad, progreso y reanudar simulados; cuentas, credencial write-only, programador, usuarios, roles, auditoría y perfil según permisos. Los listados de gestión usan `Table` de lizaui y las reglas CRUD de la [spec frontend](../frontend/spec.md#4-tablas-de-gestión). | Pantallas A1–A6, D8/D10/M4; formulario válido/inválido; clave guardada nunca se vuelve a mostrar; ausencia de permisos bloquea acciones; pruebas de filtros, orden, selección, lotes y columnas cuando apliquen. |
| FE-5 Cierre frontend | Estados de carga/error/pausa, accesibilidad, textos, responsive y contratos del adaptador local documentados. | Build, `tsc`, lint, pruebas existentes y comparación visual a 1280×820 y ~390 px; pendientes para API listados sin inventar endpoints. |

## Regla de independencia

Los componentes reciben datos y callbacks por props; el adaptador local provee los datos de prueba. Se dejan tipos y comandos semánticos (`startInventory`, `readContent`, `downloadFile`, etc.) como frontera de integración, sin asumir rutas HTTP, autenticación del backend o respuestas definitivas. TanStack Query se usa cuando exista un servicio real; Zustand solo para estado cliente compartido necesario.

Antes de instalar, comprobar si existe un lockfile o una configuración de gestor de paquetes. Si el proyecto se inicia desde cero o ya usa pnpm, usar `pnpm add lizaui` y mantener pnpm para las demás dependencias. Si ya usa npm, respetar su lockfile y usar `npm i lizaui`. No mezclar gestores ni importar el código local de `busui`.

## Trazabilidad

| Flujo | Hitos frontend |
|---|---|
| F1 Alta de cuenta | FE-4 |
| F2 Consulta programada | FE-2, FE-4 |
| F3 Inventario manual | FE-2, FE-4 |
| F4 Lectura | FE-3 |
| F5 Descarga | FE-3 |
| F6 Sesión/credencial | FE-2, FE-4 |
| F7 Roles/acceso | FE-1, FE-4 |
