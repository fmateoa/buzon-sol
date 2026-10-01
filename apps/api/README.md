# API y worker backend

La API tiene autenticación propia, roles, usuarios, cuentas cifradas, consultas persistidas y comandos asíncronos. El worker ejecuta, para cada cuenta SUNAT registrada y con una sesión propia por trabajo, la prueba de conexión, el inventario de ambas bandejas con sus catálogos (carpetas, etiquetas, alertas), las lecturas explícitas, el archivo de contenido y archivos de los elementos ya leídos y las descargas. El cliente real es `SunatHttpSession` (`packages/sunat-adapter`); cada capacidad está detrás de su puerta `SUNAT_*`, todas apagadas por defecto. El frontend consume todo por `HttpAdapter` (gestión y buzón). El avance por hito está en el [seguimiento del plan backend](../../specs/buzon-sol/plan/01-backend.md#seguimiento-de-avance).

## Stack de desarrollo

```sh
node scripts/dev-env.mjs
docker compose -f compose.dev.yml -p buzon-dev up -d --build
```

`dev-env.mjs` genera `apps/api/.env` (ignorado por git; lo comparten los contenedores de API, worker, MySQL y MinIO) con contraseñas locales aleatorias, un par RSA de desarrollo y la clave de huellas. El Compose levanta MySQL 8.4, Redis 7.4 con AOF, MinIO con bucket privado `buzon`, un servicio `migrate` que aplica migraciones y termina, la API en `127.0.0.1:38080` y el worker. Ninguna puerta `SUNAT_*` está activa. MinIO usa `bitnamilegacy/minio:2025.5.24`, una compilación comunitaria sin mantenimiento: sirve para desarrollo local; producción necesita un S3 compatible con soporte. La imagen oficial `minio/minio` no está disponible en Docker Hub.

## Configuración

MySQL 8 con base `buzon_sol`. Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `API_PORT` para HTTP. La API necesita `SOL_PUBLIC_KEY_PEM`, `SOL_KEY_ID` y `ACCOUNT_FINGERPRINT_KEY_B64` (32 bytes aleatorios en base64, estable entre reinicios). Solo el worker recibe la clave privada RSA (`SOL_PRIVATE_KEY_PEM`). Las claves se entregan por el mecanismo de secretos del despliegue, nunca en el repositorio.

Redis usa `REDIS_URL`. Los archivos usan `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY` y `S3_SECRET_KEY`; el bucket debe ser privado. La API entrega archivos mediante un proxy autenticado, de modo que una URL copiada pierde acceso inmediatamente después de revocar el permiso. El SDK se verificó contra S3Mock y contra MinIO, incluido que un GET anónimo recibe `403`.

Para documentos HTML generados, el worker conserva además los bytes originales en una clave privada con sufijo `.original`. La API solo entrega la copia saneada con descarga forzada y CSP `sandbox`. Las claves de objeto empiezan por el identificador de la cuenta (`{cuenta}/{elemento}/{archivo}`): los archivos de dos empresas nunca comparten prefijo.

Desde la raíz:

```sh
pnpm --filter @buzon-sol/api migration:run
pnpm --filter @buzon-sol/api migration:show
pnpm --filter @buzon-sol/api migration:revert
pnpm --filter @buzon-sol/api dev
pnpm --filter @buzon-sol/worker dev
```

`synchronize` y `migrationsRun` están desactivados. Ejecutar migraciones de forma explícita antes de iniciar la API. Las marcas internas se escriben en UTC con el reloj de MySQL; las fechas de SUNAT se conservan como texto original y, además, `fecPublica` se interpreta explícitamente en `America/Lima` (`published_at`) para ordenar y filtrar. Un formato desconocido queda sin fecha normalizada.

Crear el primer administrador con `BOOTSTRAP_EMAIL` y `BOOTSTRAP_NAME` en el entorno y una contraseña de al menos 12 caracteres enviada por stdin a `pnpm --filter @buzon-sol/api bootstrap:admin`. El comando funciona solo si aún no hay usuarios y no imprime la contraseña. Usar una fuente protegida para stdin. Se registra el alta inicial en auditoría.

## Contrato HTTP actual

Prefijo `/api/v1`. El contrato de rutas, DTOs, permisos y errores actuales está en `openapi.yaml`. `POST /auth/login` recibe `{email,password}` y devuelve un token opaco cuya duración y cierre por inactividad se definen en **Configuraciones** (por defecto 12 horas y 60 minutos; ver más abajo). Enviar `Authorization: Bearer <token>`; `POST /auth/logout` lo revoca. `GET /auth/me` consulta permisos y cuentas actuales en cada solicitud, de modo que una revocación se aplica a la sesión abierta; incluye `roleName` y `preferences`, y `PATCH /auth/me/preferences` guarda `{ "readWarningEnabled": true|false }`. Los tokens se guardan solo como SHA-256 en la base. Servir la API bajo TLS. La web ingresa con `X-Session-Mode: cookie`: el token viaja solo en la cookie `bz_session` (HttpOnly, SameSite=Strict, `Path=/api/v1`; `Secure` en producción, o según `SESSION_COOKIE_SECURE=true|false`) y nunca queda en JavaScript ni en almacenamiento del navegador, así que recargar no cierra la sesión. Con cookie, POST/PATCH exigen `X-CSRF-Token` igual a la cookie `bz_csrf` (hook `onRequest` en `src/auth/session-cookie.ts`, instalado en `main.ts`); `Authorization: Bearer` sigue valiendo para clientes no web y no usa cookies. `POST /auth/logout` borra ambas cookies.

Administración: `GET/POST /roles`, `PATCH /roles/:id`, `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `GET/POST /admin/accounts`, `PATCH /admin/accounts/:id`, `PATCH /admin/accounts/:id/active`, `GET /admin/accounts/:id/users`, `GET /admin/account-options` (solo id y alias, para asignar cuentas a roles), `POST /admin/accounts/:id/credential`, `GET/PATCH /admin/accounts/:id/mailbox-settings` (`archiveContent`, `archiveFiles`, `archiveBatchSize` de 1 a 2000; apagados por defecto), `POST /admin/accounts/:id/connection-tests` y `GET /admin/accounts/:id/connection-tests/:testId`. Las respuestas de cuentas y pruebas nunca incluyen RUC completo, usuario SOL completo ni Clave SOL.

Configuraciones (permiso `manage_settings`): `GET/PATCH /admin/settings`. Ajustes con valor por defecto y rango en `SETTING_DEFINITIONS` (`packages/domain`); en `app_settings` solo se guardan los que difieren del defecto y cada cambio queda en auditoría con valor anterior y nuevo. `session.absoluteMinutes` (720) se sella en cada sesión al ingresar; `session.idleMinutes` (60) se evalúa en cada petición, de modo que cambia de inmediato; la inactividad se renueva solo con `POST /auth/activity` (uso real en la web), no con los sondeos en segundo plano. `security.maxFailedLogins` (5) y `security.lockoutMinutes` (15) bloquean el ingreso del usuario sin distinguir el error de una contraseña incorrecta; `security.passwordMinLength` (12) rige para usuarios nuevos y se informa en `GET /auth/me` (`policy`). Las bases existentes reciben `manage_settings` en los roles que ya tenían `manage_users_roles`.

Buzón: `GET /accounts` (con el estado de la última consulta y los nuevos de la última completa), `GET /accounts/:id/items/:itemId` (metadatos de un elemento), `GET /accounts/:id/items/:itemId/reads/:eventId` (avance de una lectura encolada), `GET /admin/runs` (consultas de todas las cuentas), `GET /accounts/:id/mail` (devuelve `{rows,total,offset,limit}` con metadatos persistidos; filtros `box`, `state`, `review`, `content` (`stored`/`missing`), `q`, `dateFrom`/`dateTo` como días de `America/Lima`, `folder`, `label`, orden `sort`/`direction`, paginación `offset` ≥ 0 y `limit` de 1 a 200), `GET /accounts/:id/folders` y `GET /accounts/:id/labels` (último catálogo observado y resultado del último intento), `GET /accounts/:id/summary`, `GET /accounts/:id/activity`, `POST /accounts/:id/inventory`, `POST /inventory` (un inventario por cada cuenta activa permitida; devuelve el resultado de cada una), `GET /accounts/:id/archive` (avance en cantidades) y `POST /accounts/:id/archive` (encola un lote; `{ "retryFailed": true }` reintenta lo agotado), `POST /accounts/:id/runs/:runId/resume`, `POST /accounts/:id/items/:itemId/read` con `Idempotency-Key`, `GET /accounts/:id/items/:itemId/detail`, `PATCH /accounts/:id/items/:itemId/review` con `{ "reviewed": true|false }`, `POST /accounts/:id/files/:fileId/fetch`, `GET /accounts/:id/files/:fileId/fetches/:fetchId`, `GET /accounts/:id/files/:fileId`, `GET/PATCH /accounts/:id/schedule`. La obtención de un archivo por usuario requiere una lectura explícita completada. El estado `reviewed` es privado del usuario y jamás llama a SUNAT. Auditoría y avisos: `GET /audit`, `GET /audit.csv`, `GET /notices` (con `counts` solo numéricos), `POST /notices/:id/read`. Cada ruta vuelve a comprobar permiso y cuenta.

## Arquitectura de API y worker (BE-8)

**Mapa de la API (`apps/api/src`).** Una carpeta y un módulo Nest por capacidad; `module.ts` solo los compone.

| Carpeta | Rutas | Servicio (dueño de la transacción) | Efectos fuera de MySQL |
|---|---|---|---|
| `core` | — (global: `DB`, `SettingsService`, `AuthService`, filtro de errores) | — | — |
| `health` | `/health` (liveness), `/health/ready` (readiness) | — | ping a MySQL / Redis con tope de 2 s |
| `auth` | `/auth/*` | `AuthService` (sesión, bloqueo de login) | — |
| `identity` | `/users`, `/roles`, `/admin/account-options`, preferencias | `IdentityService` | — |
| `accounts` | `/accounts`, `/admin/accounts/*`, credencial, pruebas de conexión | `AccountsService`, `ConnectionService` | cola `connection` |
| `mailbox` | `/accounts/:id/mail`, `items/:id`, `review`, `folders`, `labels` | `MailboxService` | — |
| `scheduling` | `/accounts/:id/schedule` | `SchedulingService` | — |
| `inventory` | `/accounts/:id/inventory`, `/inventory`, `runs/:id/resume` | `InventoryService` | cola `inventory` |
| `reading` | `items/:id/read`, `reads/:id`, `detail` | `ReadingService` | cola `read` |
| `files` | `files/:id`, `fetch`, `fetches/:id` | `FilesService` | cola `file`, S3 (proxy autenticado) |
| `archive` | `/archive`, `mailbox-settings` | `ArchiveService` | cola `archive` |
| `operations` | `/admin/runs`, `activity`, `summary`, `/audit*`, `/notices*` | `OperationsService` | — |
| `settings` | `/admin/settings` | `SettingsService` | — |
| `common` | — | `recordAudit` (único escritor de `audit_events`), `addJob` (frontera BullMQ), `dto`, `validId`, `SafeErrorFilter` | — |

**Recorrido de una petición.** Fastify → hook de cookie (`auth/session-cookie.ts`) → pipe de DTO (`common/dto.ts`, class-validator) → controller de la capacidad (solo HTTP: lee actor, parámetros y body, llama al servicio) → servicio (`AuthService.authenticate` + permiso **y** cuenta concreta, reglas, transacción MySQL que escribe estado y auditoría con `recordAudit(manager, …)`) → fuera de la transacción `addJob` a Redis → respuesta. Los errores salen por `SafeErrorFilter` (global, incluye health) como `{ code }`.

**Recorrido de un job.** MySQL guarda primero la intención (`sync_runs`, `mail_read_events`, `file_fetches`, `archive_runs`, `connection_tests`) en estado `pending`; luego la API encola. Si el encolado falla, se marca `partial`/`failed` con `remote_unavailable` (lectura se queda `pending` y se repite con la misma `Idempotency-Key`); MySQL y Redis no son atómicos entre sí y la recuperación de huérfanos del worker cierra la ventana. En el worker, `queue → procesador` toma la exclusión por cuenta (`account-lock.ts`), vuelve a validar cuenta/permiso/puerta, confirma el estado duradero **antes** de cada llamada remota, abre y cierra su sesión SUNAT y libera la exclusión. El worker no usa HTTP para hablar con la API.

**Validación de entrada.** Los DTOs de `*/*.dto.ts` son por operación, no por entidad. `common/dto.ts` envuelve el `ValidationPipe` de Nest con `whitelist: true`, sin `transform` ni conversión implícita (`"true"` no es un booleano) y sin `forbidNonWhitelisted`: la web envía hoy campos de solo lectura en `PATCH …/schedule`, así que lo no declarado se descarta en lugar de rechazarse. Cualquier fallo responde `400 { "code": "validation" }`. Los servicios conservan sus validaciones de negocio. Consecuencia conocida: con un body inválido la validación responde antes que la autenticación (400 en lugar de 401); con un body válido el orden es el de siempre. `tsx` no emite metadatos de parámetros, por eso cada ruta indica su clase: `@Body(dto(CreateUserDto))`.

**Configuración y operación.** `src/config.ts` (API) y `apps/worker/src/config.ts` validan al arrancar, nombran solo variables (nunca valores) y exigen secretos solo para lo habilitado (API: material de cifrado público y huella de RUC; worker con `ENABLE_SUNAT_JOBS`: `SOL_PRIVATE_KEY_PEM` y, con archivos, `S3_*`). Las puertas valen solo con `"true"`; `"false"` o ausente las apaga y cualquier otro valor es error. Plantilla en `.env.example`. `GET /health` es liveness; `GET /health/ready` comprueba MySQL y solo exige Redis si alguna puerta que encola está activa (sin detalle del fallo). Cierre: la API atiende `SIGINT`/`SIGTERM` (`app.close()` espera las peticiones en curso, luego destruye la conexión MySQL; límite de 15 s); el worker detiene sus bucles (esperando la pasada en curso), cierra consumidores y colas y destruye MySQL.

**Decisiones de BE-8 (mantener / cambiar / posponer).**

| Decisión | Qué | Motivo / evidencia |
|---|---|---|
| Cambiar | `IdentityController` único → un controller por capacidad con su módulo | Rutas idénticas; `apps/api/test/http-boundary.test.ts` recorre las 53 rutas de OpenAPI |
| Cambiar | 20 `INSERT INTO audit_events` repetidos → `recordAudit` | Un solo punto para la forma del evento; mismas columnas |
| Cambiar | 5 bloques `new Queue/add/close` → `addJob` | La frontera Redis queda en `common/job-queue.ts`; cada servicio conserva su compensación |
| Cambiar | 7 copias del `GET_LOCK` por cuenta → `account-lock.ts` | La invariante «un trabajo remoto por cuenta» queda en un solo lugar y libera la conexión aunque falle `RELEASE_LOCK` |
| Cambiar | Configuración inline en `main.ts` del worker → `config.ts` | Probada sin MySQL ni Redis |
| Mover | `visibleAccounts` → `AccountsService`, `setReviewed` → `MailboxService` | Cada ruta vive con su capacidad |
| Mantener | SQL local en los servicios | Las consultas largas ya son cortas y locales; extraerlas solo añadiría archivos. Cada una conserva su filtro de cuenta |
| Mantener | Worker sin NestJS, un procesador por familia | Ya separa consumidor, procesador y cliente SUNAT |
| Mantener | Sesión por token opaco, IDs, esquema y migraciones | Fuera de alcance |
| Posponer | `forbidNonWhitelisted`; DTO de salida/OpenAPI generado | La web envía campos extra; sin caso de uso |

## Puertas SUNAT

Cada puerta vale solo con `"true"` explícito y la activa el operador del despliegue cuando la prueba correspondiente del [plan de integración](../../specs/buzon-sol/plan/02-sunat-integration.md) consta como superada para ese entorno. Nunca fijarlas para simular una validación. El worker se niega a arrancar con combinaciones inválidas (cron, lectura o archivos sin transporte; archivos sin lectura).

| Variable | Habilita | Prueba que la respalda |
|---|---|---|
| `ENABLE_SUNAT_JOBS` | Que el worker arranque consumidores (sin ella queda inactivo) | — |
| `SUNAT_CONNECTION_CLIENT_READY` | Prueba de conexión | S-02 |
| `SUNAT_TRANSPORT_VALIDATED` | Inventario manual (una cuenta o todas) y reanudación | S-01–S-04, S-06–S-08, S-17/S-18 |
| `SUNAT_READ_VALIDATED` | Lectura explícita y archivo de contenido de elementos ya leídos | S-13/S-14 |
| `SUNAT_FILE_CLIENT_READY` | Descargas por usuario, P-03 y archivos del archivo de la cuenta | S-15/S-16 |
| `SUNAT_CRON_VALIDATED` | Bucle del programador y `state=active` en la API | S-02/S-05 repetidos |
| `SUNAT_PASSIVE_START_VALIDATED` | Disparar sin `remote_effect_accepted` | S-04 |

Con `SUNAT_CRON_VALIDATED` y `SUNAT_TRANSPORT_VALIDATED`, la API acepta `state=active` si la última credencial de la cuenta es válida y calcula el primer disparo en hora de Lima; sin ellas responde `remote_unavailable`. Mientras `SUNAT_PASSIVE_START_VALIDATED` no esté fijada, el programador pausa (`remote_effect_not_accepted`) y avisa a administradores si la programación no tiene `remoteEffectAccepted`.

La exploración autorizada con cuentas reales usa `scripts/sunat-test-credential.ps1` (entrada oculta, cifrado DPAPI del usuario local) y `scripts/run-sunat-probe.ps1 -Mode <modo>`; solo emiten resultados redactados. `-Mode e2e-archive -Names A,B [-Items 5] [-Files]` ejecuta contra la base local un inventario y un lote de archivo por cuenta que abre únicamente elementos ya leídos; `unexpectedReads` debe ser 0. No copiar credenciales al chat ni a archivos del repositorio.

## Worker

- **Mantenimiento:** al arrancar y cada `RECOVERY_INTERVAL_MS` (5 min por defecto) pasa a `partial` las ejecuciones `running` sin proceso vivo (bloqueo de cuenta libre) y las `pending` cuyo trabajo ya no está en la cola, para reanudarlas desde su checkpoint; los lotes de archivo huérfanos pasan a `partial` y el siguiente inventario o un inicio manual encola otro.
- **Programador:** con `SUNAT_CRON_VALIDATED=true`, una pasada cada `SCHEDULER_INTERVAL_MS` (60 s) crea una ejecución por cuenta vencida con sus bandejas configuradas.
- **Inventario:** recorre las bandejas de la ejecución; carpetas, etiquetas y alertas son auxiliares y un fallo queda como `unavailable` sin detener el barrido ni borrar el último catálogo. Ante `remote_session_expired` reautentica a lo sumo 2 veces y continúa en la página pendiente. Al completar, cuenta los elementos nuevos desde la última ejecución completa (la primera no genera aviso) y avisa con cantidades a quienes tienen `view_mailbox` sobre la cuenta, si la programación no desactiva avisos en app.
- **Archivo por cuenta:** si la cuenta tiene `archiveContent`, al completar un inventario (manual o programado) o con `POST /accounts/:id/archive` se encola un lote en la cola `buzon-archive`. El lote abre una sesión, toma hasta `archiveBatchSize` elementos **ya leídos en SUNAT** (`indEstado<>0`) sin contenido guardado, del más reciente al más antiguo, registra antes un `mail_read_events` con `origin='archive'`, guarda el cuerpo original y el saneado y, con `archiveFiles` y `SUNAT_FILE_CLIENT_READY`, descarga sus archivos justo después de su detalle. Mientras quede pendiente y haya avance, encola el siguiente lote tras `ARCHIVE_BATCH_DELAY_MS` (60 s). Un no leído **nunca** se abre aquí: solo con la lectura explícita. Si SUNAT respondiera `updateLeido=true`, el lote se detiene, desactiva el archivo de esa cuenta, lo audita y avisa a administradores. Tres fallos por elemento o archivo lo excluyen hasta `retryFailed`; tres fallos seguidos o una sesión vencida terminan el lote como `partial`; una credencial rechazada pausa la cuenta. Cuando hay lote de archivo no se planifica P-03, que competiría por el bloqueo de la cuenta.
- **P-03:** tras una ejecución programada completa con `downloadReadAttachments`, encola descargas solo de elementos leídos en SUNAT con detalle ya guardado; el worker lo vuelve a comprobar antes de llamar a SUNAT. Nunca abre un no leído.
- **Rotación de clave maestra:** generar un par nuevo; en el worker poner la clave nueva en `SOL_PRIVATE_KEY_PEM`/`SOL_PUBLIC_KEY_PEM`/`SOL_KEY_ID` y la anterior en `SOL_PREVIOUS_KEY_ID`/`SOL_PREVIOUS_PRIVATE_KEY_PEM`; en la API, la pública nueva. Ejecutar `pnpm --filter @buzon-sol/worker rotate:keys`: recifra RUC, usuario SOL y todas las versiones de credencial, audita cada cuenta sin valores y es repetible. Con salida `0`, retirar las variables `SOL_PREVIOUS_*` y destruir la clave anterior.
- **Logs:** JSON por línea con `logEvent`; se redactan claves de secretos, cookies, tokens, `hc`, `state`, `datos`, RUC, asuntos y cuerpos, y se enmascaran números aislados de 8 o más dígitos.

## Pruebas

Las pruebas HTTP con MySQL real se ejecutan con `BUZON_TEST_DB=1 pnpm --filter @buzon-sol/api test:integration` y variables `DB_*` apuntando a una base de pruebas (`docker compose -f compose.test.yml up -d`). Los archivos de prueba corren en serie porque comparten las colas de Redis. Las del worker usan `pnpm --filter @buzon-sol/worker test:integration`; opcionalmente `BUZON_TEST_REDIS=1` y `BUZON_TEST_S3=1` ejercitan Redis y S3. `BUZON_TEST_S3_PRIVATE=1` comprueba además que el bucket rechaza lecturas anónimas (S3Mock no aplica autenticación; usar MinIO). No ejecutar contra una base con datos reales: las pruebas insertan registros ficticios. Si la base `buzon_sol` del contenedor de pruebas guarda el E2E con cuentas reales, usar otra (`DB_NAME=buzon_it`, creada con `CREATE DATABASE` y permisos para `buzon`). Repetirlas no requiere limpiar la base.

Los fixtures de `packages/domain/fixtures` contienen solo datos inventados. El `total`/`records` intencionalmente no coincide con el final observado para evitar que se use como condición de corte. `listEtiquetas` se lee del HTML del visor sin ejecutar scripts, en la forma observada en S-11 (`$.parseJSON('[...]')`) o como arreglo literal (`visor-master.html`).
