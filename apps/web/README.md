# buzon-sol · frontend (v2)

Implementación de los hitos FE-0 a FE-5 del [plan frontend](../../specs/buzon-sol/plan/03-frontend.md) con **datos ficticios** y un **adaptador local tipado**. No hay API, worker ni conexión con SUNAT: el navegador nunca habla con SUNAT.

## Comandos

Desde la raíz del monorepo (pnpm):

```bash
pnpm install
pnpm dev            # http://localhost:5173, contra la API (ver «Modo backend»)
pnpm dev:prototype  # datos ficticios, sin backend
pnpm typecheck    # tsc -b --noEmit
pnpm lint         # eslint
pnpm test         # vitest (59 pruebas)
pnpm build        # tsc -b && vite build
```

Usuarios ficticios del prototipo (contraseña de prueba en `src/adapters/local/fixtures.ts`): `admin@`, `usuario1@` (Supervisor), `usuario2@` (Analista con el aviso de lectura desactivado), `usuario3@` (Analista), `usuario6@` (Solo consulta), todos en `empresa-demo.test`. Los RUC, personas, asuntos y documentos son inventados.

## Stack

React 19 · TypeScript estricto (`noUncheckedIndexedAccess`) · Vite · Tailwind CSS v4 + `tw-animate-css` · `lizaui` 12.0.10 desde npm · TanStack Query v5 · Formik + Yup · React Router · DOMPurify · Vitest + Testing Library. Sin Zustand: no hubo estado cliente compartido que lo justificara (las preferencias del visor van en `localStorage` con `try/catch`).

## Estructura

```
src/
  domain/        types.ts (modelos) y adapter.ts (interfaz BuzonAdapter, AppError, CommandResult)
  adapters/local fixtures ficticios + LocalAdapter (autorización, filtros, orden, paginación, barridos simulados)
  app/           rutas, providers, query keys, QueryClient
  components/    layout (shell adaptable) y custom (envoltorios sobre lizaui)
  features/      session, accounts, summary, mailbox, detail, activity, profile, admin
  hooks/         useListState (filtros/orden/página/selección), media queries, debounce
  lib/           formato Lima, saneado HTML, puertas SUNAT, permisos, programador, lotes
```

## Frontera con el backend (provisional)

`src/domain/adapter.ts` define `BuzonAdapter`. Las pantallas solo consumen esa interfaz vía TanStack Query; el cliente real del backend deberá implementarla sin tocar componentes. **No define rutas HTTP ni JSON.**

| Tipo | Operaciones |
|---|---|
| Consultas (lanzan `AppError`) | `getSession`, `getSummary`, `listMail`, `listFolders`, `listTags`, `getItemMetadata`, `getRemoteState`, `getActivity`, `listAdminAccounts`, `getAdminAccount`, `getSchedule`, `listAccountUsers`, `listScheduledRuns`, `listUsers`, `listRoles`, `listAdminAccountOptions`, `listAudit` |
| Comandos semánticos (devuelven `CommandResult`) | `startInventory`, `resumeRun`, `readContent`, `downloadFile`, `setReviewed`, `replaceCredential`, `testConnection`, `saveSchedule`, `createAccount`, `updateAccount`, `setAccountActive`, `createUser`, `updateUser`, `setUserStatus`, `createRole`, `updateRole`, `setReadWarning`, `exportAuditCsv`, `login`, `logout` |
| Errores (`AppErrorCode`) | `unauthenticated`, `forbidden`, `not_found`, `needs_credential`, `invalid_credential`, `paused`, `remote_session_expired`, `remote_unavailable`, `schema_changed`, `incomplete_inventory`, `conflict_running`, `validation` → textos en `lib/errors.ts` |

Reglas que el adaptador local cumple y que el backend deberá garantizar:

- Cada operación con cuenta verifica **permiso y pertenencia** de la cuenta (`requireAccount`); el id del cliente no prueba acceso.
- Listado, filtros, metadatos y resumen **nunca** piden detalle a SUNAT. `readContent` es el único camino al cuerpo, registra la intención antes y es idempotente por clave (`useReadContent` genera una por vista).
- `setReviewed` solo cambia estado local por usuario.
- La Clave SOL solo se escribe/reemplaza; ninguna respuesta, auditoría ni CSV la contiene. El RUC sale enmascarado.
- «Total verificado» solo tras un barrido completo; el declarado por SUNAT es secundario (fixture: 3 328 únicos frente a 2 681 declarados).
- Los cambios de rol/acceso aplican a sesiones abiertas (la sesión se revalida cada 30 s y tras cada comando administrativo).
- `touchSession()` registra uso real (teclado, clic, scroll) para renovar la ventana de inactividad de la sesión de la app (`session.idleMinutes`, ver Configuraciones). Lo llama solo `SessionActivity` (`features/session/guards.tsx`), montado únicamente con sesión y con un máximo de un aviso por minuto, alineado con el umbral del servidor. Los sondeos (`getSession` cada 30 s, actividad programada) **nunca** lo llaman. No devuelve `CommandResult` a propósito: es un aviso sin interfaz, sus errores se ignoran y el `401` lo gestiona el flujo normal de sesión vencida (`getSession` → login).

Las claves de caché cuelgan de `["account", accountId]`: una respuesta tardía de la cuenta A no puede escribir en la vista de B, y la guarda de cuenta desmonta la vista (`<Outlet key={accountId}>`) al cambiar de cuenta.

## Puertas SUNAT

`lib/sunat-gates.ts` mantiene `passiveLogin` (G-02) y `notificationReadVerified` (G-03) en `false`. Mientras G-02 no se supere, la UI dice «El barrido no abre contenido» (no «Sin efecto en SUNAT»), advierte del posible efecto del inicio de sesión en inventario, «Probar conexión…» y programador, y exige aceptación administrativa para activar la programación.

## Decisiones y diferencias frente al diseño

La referencia visual se tomó del [artefacto UX/UI compartido](https://claude.ai/artifact/9xRxtR7WAqdSRb4zA2zwyD) (el MCP `claude_design` no estaba disponible en esta sesión). Diferencias deliberadas o no comprobadas:

- **Copy de inventario**: el diseño dice «✓ Sin efecto en SUNAT»; se muestra «✓ El barrido no abre contenido» + nota del inicio de sesión (UX §5, G-02).
- **Programador (A3)**: el interruptor «Programador activo» es un selector Activo / Pausado / Desactivado (la spec A3 pide los tres estados) y el horario usa dos campos de hora. La nota «!» del inicio de sesión va dentro de la aceptación administrativa.
- **Acceso de usuario (A5)**: como en el diseño, al editar solo se cambian estado y rol; nombre y correo van en la cabecera del panel. Una invitación pendiente no se puede «activar» desde el panel.
- **Cuenta (A2)**: el panel se abre desde «Gestionar» y «Actualizar credencial»; tras reemplazar la Clave SOL sigue abierto para «Probar conexión…». La página de la cuenta conserva sus tres pestañas.
- **Destacado y urgente** se muestran solo como indicadores de SUNAT (`indDesta`, `indUrg`); no hay acciones de destacar ni de urgencia.
- **Bandeja**: filtros en barra superior (diseño D5) en lugar de `Table.SearchRow`; las tablas de gestión (Cuentas, Usuarios, Roles, Auditoría) sí usan `SearchRow`. Navegación ↑/↓ + Intro no implementada: cada fila tiene un botón «Ver» tabulable (UX §3).
- **Descargas**: estado «Guardado en el espacio de la cuenta» sin botón «Abrir» (no hay almacén real). «Cancelar descarga» no implementado.
- **Correo resumen diario** deshabilitado con nota P-02. Descarga automática de adjuntos leídos condicionada a P-03.
- **Actividad programada global** y **Auditoría** son de solo lectura; el filtro de fecha de auditoría es por rango relativo.
- **Modo oscuro**: el diseño solo define el tema claro. El oscuro se derivó de su paleta (misma jerarquía; ámbar solo para efecto en SUNAT; contraste AA comprobado) y usa la clase `.dark` de lizaui en `<html>`. Preferencia Sistema / Claro / Oscuro en Perfil y cambio rápido en la barra lateral; se guarda solo en el navegador (`lib/theme.ts`) y un script de `index.html` la aplica antes de pintar. Los colores de la app son tokens `--bz-*` (`index.css`): no usar `bg-white` ni hex sueltos, sino `bg-paper`, `bg-brand-fill` (relleno bajo texto blanco), `border-ok-line`, etc. El cuerpo remoto de SUNAT sigue el tema porque sus estilos se eliminan al sanear.
- Cifras, horarios y nombres del diseño son muestras; los fixtures los reproducen aproximadamente.

Notas de integración con lizaui 12.0.10 (verificadas contra los `.d.ts` y el código de referencia):

- `lizaui/table` no exporta `TableColumnsProps`: se usa `ColumnDef` compatible. `minWidth` solo aplica a columnas redimensionables, por eso se fija `size`.
- `Pagination` muestra «página - límite de total»; se oculta su selector (`isLimitSelect={false}`) y se usa un resumen propio («N registros · Mostrando a–b») con selector 10/20/50/100.
- `Button` reenvía props desconocidas al DOM y `isLoading` no bloquea el clic: se usa `disabled` y clases (`w-full`) en vez de `fullWidth`/`isDisabled`.
- `Input` no asocia el texto de error: `components/custom/form-field.tsx` lo enlaza con `aria-describedby` y enfoca el primer error.
- **Paneles de gestión** (`components/custom/side-sheet.tsx`): alta y edición de cuenta (A2), usuario (A5) y rol (A4) usan `Drawer` con `isFloating` y `backdrop="blur"`, a la derecha en escritorio/tablet y como hoja inferior en móvil. `SheetForm`/`SheetBody`/`SheetFooter` dejan el pie fijo dentro del `<form>` (el `Button` de lizaui no tipa el atributo `form`), y el mismo formulario de cuenta se reutiliza en la pestaña «Datos y credencial».
- `Drawer` y `Modal` no mueven el foco: `SideSheet` y `ResponsiveDialog` enfocan el panel al abrir y devuelven el foco al cerrar. `ResponsiveDialog` queda para confirmaciones cortas, con `backdrop="blur"` y hoja inferior flotante en móvil.
- `TabsList`/`TabsTrigger` de lizaui solo tienen estilo de píldora: `components/custom/underline-tabs.tsx` los muestra subrayados como en A3. `Segmented` es un grupo de radios propio (lizaui no trae control segmentado con semántica de radio).
- El CSS de componentes (`dist/lizaui.css`) no está en el mapa `exports`: se importa por ruta relativa en `index.css`, junto con `@source` al `dist` real.
- El bundle principal supera 500 kB (aviso de Vite); la administración ya se carga de forma diferida.

## Cobertura de pruebas (FE §6)

| Criterio | Pruebas |
|---|---|
| Reinicio de página, limpieza de selección, orden asc/desc/sin orden, debounce | `hooks/use-list-state.test.tsx` |
| Vacío con encabezado y filtros visibles, filtro sin acentos | `features/app.test.tsx`, `lib/lib.test.ts` |
| Selector solo con cuentas del rol, ruta ajena sin datos, cambio de cuenta descarta filtros | `features/app.test.tsx`, `adapters/local/local-adapter.test.ts` |
| Metadatos sin `readContent`; cancelar no llama; confirmar llama una vez; revisar no cambia remoto | `features/app.test.tsx`, `adapters/local/local-adapter.test.ts` |
| Parcial sin «total verificado», pausa por credencial, 3 328 frente a 2 681 | ambos |
| Clave de solo escritura, validación de programador, lotes con `Promise.allSettled` | ambos + `lib/lib.test.ts` |

## Pendiente para la integración con la API

Sin inventar endpoints, el backend deberá acordar: autenticación de la app y renovación de sesión; forma de las páginas de metadatos y cobertura por bandeja; canal de progreso de barridos (hoy sondeo cada 1–2 s); confirmación asíncrona del estado remoto tras `readContent`; entrega de archivos guardados (URL firmada o flujo) y cancelación de descargas; avisos en app (P-01, P-02); exportación de auditoría (formato y límites); retención (P-04). Esos puntos corresponden a INT-2 del [plan de integración](../../specs/buzon-sol/plan/04-integration.md).

## Modo backend (INT-1: gestión)

`pnpm dev` lee `.env` (`VITE_DATA_SOURCE=backend`) y usa `HttpAdapter` (`src/adapters/http`) en lugar de `LocalAdapter`; `main.tsx` elige según `VITE_DATA_SOURCE`. `pnpm dev:prototype` (modo `prototype`, `.env.prototype`) vuelve a los datos ficticios, y las pruebas siempre usan el adaptador local. El servidor de desarrollo reenvía `/api` a `BUZON_API_URL` (por defecto `http://127.0.0.1:38080`).

- Conectado: sesión, preferencia de aviso, usuarios, roles, cuentas SUNAT, credencial, programador (sin activarlo) y auditoría.
- «Probar conexión…» encola la prueba en la API y espera el resultado del worker (requiere `SUNAT_CONNECTION_CLIENT_READY` en API y worker).
- Buzón conectado: resumen, bandejas, etiquetas, detalle, actividad, inventario (una cuenta o todas), lectura explícita, descargas, revisión local y archivo de la cuenta. Los comandos se encolan en la API y el adaptador espera el resultado del worker; con la puerta `SUNAT_*` cerrada la API responde `remote_unavailable` («SUNAT no respondió»).
- `listFolders` devuelve vacío en modo servidor: la pertenencia de cada elemento a una carpeta no está validada con SUNAT (S-10).
- Pantallas nuevas: pestaña **Archivo** en la cuenta (administración), sección **Archivo del buzón** en Actividad, **Consultar todas las cuentas** en Actividad programada y **Guardar copia** en archivos ya guardados.
- El token de sesión vive solo en memoria: recargar la página exige ingresar de nuevo.
- El alta de usuario pide una contraseña inicial (`userOnboarding = "initial_password"`); el prototipo conserva la invitación.
