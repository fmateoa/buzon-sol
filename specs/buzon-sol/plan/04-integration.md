# Plan de integración frontend–backend · Buzón SOL

Conecta `apps/web` con `apps/api` por fases. La interfaz no cambia de contrato: las pantallas siguen consumiendo `BuzonAdapter` y la fuente de datos se elige al arrancar (`LocalAdapter` con datos ficticios o `HttpAdapter` contra `/api/v1`). El navegador nunca habla con SUNAT.

- **INT-1 Gestión** (este documento): sesión, usuarios, roles, cuentas SUNAT, credencial, programador y auditoría.
- **INT-2 Buzón** (hecho salvo avisos): resumen, bandejas, etiquetas, actividad, inventario, lectura, archivos y archivo de la cuenta. Sus consultas de solo lectura no contactan SUNAT; los comandos se encolan y dependen de las puertas del [plan SUNAT](02-sunat-integration.md): el inventario con la puerta de transporte cerrada responde `remote_disabled`.

## Cómo ejecutarlo

```sh
node scripts/dev-env.mjs
docker compose -f compose.dev.yml -p buzon-dev up -d --build   # API en 127.0.0.1:38080
pnpm dev                                                       # web contra la API, http://localhost:5173
```

`pnpm dev` lee `apps/web/.env` (`VITE_DATA_SOURCE=backend`); los secretos locales del backend los genera `dev-env.mjs` en `apps/api/.env`. El servidor de desarrollo reenvía `/api` a `BUZON_API_URL` (por defecto `http://127.0.0.1:38080`), así que la app y la API comparten origen y no hace falta CORS. `pnpm dev:prototype` usa el prototipo con datos ficticios. El primer administrador se crea con `bootstrap:admin` ([README de la API](../../../apps/api/README.md)). La API también puede ejecutarse fuera de Docker con `pnpm --filter @buzon-sol/api start` y las variables `DB_*`, `API_PORT=38080`, `SOL_PUBLIC_KEY_PEM`, `SOL_KEY_ID` y `ACCOUNT_FINGERPRINT_KEY_B64`; así se hizo la verificación del 30/09/2026.

## Decisiones de INT-1

| Tema | Decisión | Pendiente |
|---|---|---|
| Sesión | Cookie `bz_session` (HttpOnly, SameSite=Strict) fijada por la API al ingresar con `X-Session-Mode: cookie`; los POST/PATCH devuelven la cookie `bz_csrf` en `X-CSRF-Token`. Recargar la página conserva la sesión; `GET /auth/me` decide. Un `401` lleva al login. `Bearer` sigue valiendo para clientes no web. | Hecho: `apps/api/src/auth/session-cookie.ts`. |
| Alta de usuarios | La API no tiene invitaciones ni proveedor de correo (P-02). El administrador fija una **contraseña inicial** (≥ 12) en el formulario y la entrega por un canal seguro. `BuzonAdapter.userOnboarding` indica el modo; el prototipo conserva «invitación». | Flujo de invitación o cambio obligatorio de contraseña; no hay endpoint para cambiar o restablecer contraseñas. |
| Listados de gestión | La API entrega usuarios, roles y cuentas completos; filtro, orden y página se resuelven en `HttpAdapter` (son listas cortas). | Paginación en servidor si crecen. |
| Errores | La API responde `{ code }` sin detalle por campo. Los códigos conocidos se convierten en `AppError`; el resto se muestra como error inesperado. | Errores por campo (p. ej. correo o RUC duplicado hoy solo dan `validation`). |
| Funciones sin conectar | Avisos en app (`/notices`), el filtro por carpeta (S-10 sin validar) y «no vistos por usuario» (la API no lo registra). Ya no se usa `pending_integration` en modo servidor. | Pantalla de avisos; validar la consulta por carpeta. |

## Correspondencia `BuzonAdapter` → API (INT-1)

| Operación | API | Notas |
|---|---|---|
| `login`, `logout`, `getSession` | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` + `GET /accounts` | `/accounts` solo si el rol tiene `view_mailbox`. La sesión se recalcula cada 30 s: un cambio de rol o una revocación aplica sin nuevo login. |
| `touchSession` | `POST /auth/activity` | Renueva la inactividad de la sesión; solo uso real de la persona, nunca sondeos. Sin respuesta de error visible. |
| `listSettings`, `saveSettings` | `GET/PATCH /admin/settings` | Permiso `manage_settings`. |
| `setReadWarning` | `PATCH /auth/me/preferences` | Queda en auditoría. No hay fecha del último cambio. |
| `listUsers`, `createUser`, `updateUser`, `setUserStatus` | `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status` | «Última actividad» es el último ingreso (`lastLoginAt`). |
| `listRoles`, `createRole`, `updateRole` | `GET/POST /roles`, `PATCH /roles/:id` | `userCount` cuenta usuarios no desactivados. |
| `listAdminAccountOptions` | `GET /admin/account-options` | Solo id y alias; basta `manage_users_roles` o `manage_accounts`. |
| `listAdminAccounts`, `getAdminAccount` | `GET /admin/accounts` | Sin última consulta ni «nuevos» (llegan con INT-2). |
| `createAccount`, `updateAccount`, `setAccountActive`, `replaceCredential` | `POST /admin/accounts`, `PATCH /admin/accounts/:id`, `…/active`, `POST …/credential` | Usuario SOL vacío conserva el guardado. La Clave SOL solo se escribe. |
| `listAccountUsers` | `GET /admin/accounts/:id/users` | Usuarios cuyo rol alcanza la cuenta. |
| `getSchedule`, `saveSchedule` | `GET/PATCH /accounts/:id/schedule` | Sin programación guardada (`404`) se muestran valores iniciales desactivados. La API rechaza `state=active`. |
| `listAudit`, `exportAuditCsv` | `GET /audit` | Últimos 100 eventos; filtros y CSV se resuelven en cliente sobre esos eventos. |

## Seguimiento de avance

Mismas reglas de marcado que el [plan backend](01-backend.md#seguimiento-de-avance): `[x]` solo con prueba automatizada o verificación registrada.

**Última verificación:** 30/09/2026 — `pnpm --filter @buzon-sol/web typecheck|lint|test|build` (64 pruebas) y pruebas de integración de la API (2/2) en verde. Recorrido manual en modo servidor contra la API y el worker ejecutados con Node y las puertas activas, con una cuenta real ya validada por «Probar conexión» y sin inventario: Resumen, Mensajes, Actividad (con Archivo del buzón), Actividad programada y la pestaña Archivo cargan desde la API sin «Aún no disponible». No se lanzó inventario, lectura ni archivo contra SUNAT en esa verificación.

### INT-1 Gestión

- [x] Selección de fuente de datos por modo de Vite y proxy `/api` (`apps/web/src/main.tsx`, `vite.config.ts`).
- [x] Inactividad de sesión: `SessionActivity` avisa `POST /auth/activity` ante teclado, clic y scroll (máx. 1/min; `app.test.tsx`, `http-adapter.test.ts`, `apps/api/test/settings.test.ts`); los sondeos no la renuevan.
- [x] `HttpClient`: sesión por cookie HttpOnly + CSRF, `{ code }` → `AppError` (`http-adapter.test.ts`).
- [x] Sesión, preferencia de aviso, usuarios, roles, cuentas, credencial, programador y auditoría sobre la API (`http-adapter.test.ts`, recorrido manual).
- [x] API: `roleName` y `preferences` en `/auth/me`; `PATCH /auth/me/preferences`; campos de gestión en `/accounts`, `/admin/accounts`, `/users`, `/roles` y `/audit`; `GET /admin/account-options`; `GET /admin/accounts/:id/users`; usuario SOL opcional al editar (`apps/api/test/identity.test.ts`, `openapi.yaml`).
- [x] Lo no conectado responde `pending_integration` sin llamar a la API ni mostrar datos ficticios (`http-adapter.test.ts`).
- [ ] Impedir en la API que un usuario cambie su propio rol y validar permisos dependientes de `view_mailbox` (hoy solo lo hace el prototipo).
- [ ] Errores por campo en la API para duplicados de correo, RUC y nombre de rol.
- [ ] Auditoría con filtros, paginación y exportación en servidor (`/audit.csv` exporta identificadores sin nombres y no acepta filtros).
- [ ] Cambio y restablecimiento de contraseña de la app.
- [ ] ⏸ Mecanismo definitivo de sesión (BE-1) y despliegue bajo TLS con el mismo origen.

### INT-2 Buzón

- [x] Resumen, bandejas, etiquetas y metadatos sobre `GET /accounts/:id/summary|mail|labels|items/:itemId`; filtros, orden y página se resuelven en el servidor (`http-adapter.test.ts`, `apps/api/test/archive.test.ts`).
- [x] Actividad por cuenta y actividad programada global (`GET /admin/runs`).
- [x] Estado de conexión de cada cuenta (última consulta, nuevos, progreso) en `/accounts` y `/admin/accounts`.
- [x] Inventario de una cuenta o de todas, reanudación, lectura explícita con espera del worker (`GET …/reads/:eventId`), descargas por el proxy autenticado y revisión local (`http-adapter.test.ts`).
- [x] Archivo de la cuenta: configuración (pestaña Archivo), avance e inicio manual (Actividad) (`http-adapter.test.ts`; recorrido manual).
- [x] Programación activa: se envía a la API, que la acepta solo con sus puertas.
- [ ] Avisos en app (`/notices`): la API los entrega; falta pantalla y operación en `BuzonAdapter`.
- [ ] Filtro por carpeta: `listFolders` devuelve vacío hasta validar S-10.
- [x] «Probar conexión…» sobre `POST /admin/accounts/:id/connection-tests` y sondeo de `GET …/:testId` hasta el resultado del worker; sin `SUNAT_CONNECTION_CLIENT_READY` la API responde `remote_unavailable` (`http-adapter.test.ts`).
- [ ] ⛔ Inventario manual, lectura, archivos y programación activa: dependen de las puertas `SUNAT_*`.
- [ ] ⛔ Recorrido con SUNAT real desde la web: prueba de conexión hecha por el usuario (credencial `valid`); inventario, lectura, descarga y archivo aún sin ejecutar contra SUNAT desde la interfaz.
