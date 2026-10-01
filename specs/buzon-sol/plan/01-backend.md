# Plan de desarrollo backend · Buzón SOL v2

**Plan ejecutable para API y worker.** Para el cambio arquitectónico, continuar en [BE-8](#be-8-refactorización-arquitectónica-de-api-y-worker); el [prompt de refactorización](05-backend-architecture-refactor-prompt.md) amplía sus instrucciones, pero el estado y los criterios de cierre se registran aquí.

Este plan cubre **la API, el worker y la persistencia del backend**. Las pruebas controladas del login y servicios remotos tienen un [plan independiente de integración SUNAT](02-sunat-integration.md). El frontend tiene [su propio plan](03-frontend.md), y la conexión frontend–backend se sigue en el [plan de integración web–API](04-integration.md).

**Fuentes:** [spec backend](../backend/spec.md), [prompt técnico](../backend/prompt.md), [prompt de refactorización arquitectónica](05-backend-architecture-refactor-prompt.md), [requisitos de producto](../product/requirements.md) y [contrato SUNAT observado](../sunat/contracts.md). El prompt técnico propone NestJS/Fastify, TypeORM, MySQL, BullMQ/Redis y MinIO; la integración SUNAT prueba primero HTTP con sesión aislada y reserva Playwright para una dependencia real del navegador. Las decisiones de dependencias se verifican durante implementación.

| Hito | Entregable backend | Criterio de cierre |
|---|---|---|
| BE-0 Base y contratos internos | Estructura API/worker, migraciones, entidades mínimas, DTOs internos y fixtures redactados de SUNAT. | Migraciones repetibles; fixtures sin RUC real ni secretos; errores tipados; separación cuenta/usuario. |
| BE-1 Identidad y permisos | Autenticación de la app, usuarios, roles, permisos por cuenta, sesiones y auditoría inicial. | Pruebas API: usuarios con roles distintos no obtienen datos de cuentas ajenas; revocación efectiva; acciones auditadas. |
| BE-2 Cuentas y secretos | Alta/desactivación de cuenta, credencial SOL cifrada y reemplazable, prueba de conexión, almacenamiento y control de acceso. | Clave nunca sale por API/log/auditoría; acceso solo a worker autorizado; cuenta desactivada no programa consultas. |
| BE-3 Inventario | Adaptador SUNAT, sesiones aisladas, listados, paginación hasta vacío confirmado, deduplicación, persistencia, checkpoint y reanudación. | Fixtures 3328/227, `total` erróneo, HTML de login, página vacía transitoria y error de página; sin abrir detalle durante barrido. La prueba remota corresponde a S-01–S-12 del [plan SUNAT](02-sunat-integration.md). |
| BE-4 Programador | Worker por cuenta, horarios Lima, bloqueo de ejecución duplicada, avisos, expiración/rechazo y recuperación. | Programación real desactivada hasta cumplir el [criterio de cron desatendido](02-sunat-integration.md#criterio-de-liberación). Pausa y reanudación sin duplicados. |
| BE-5 Lectura y archivos | Comando explícito de lectura, `read_event`, confirmación de estado, contenido seguro, documentos generados, descargas y revisión local. | Fallo tras abrir conserva evento; `0→1` en Mensaje; archivo con MIME inválido no se guarda; `codArchivo=0` serializado; RBAC en archivos. |
| BE-6 Administración y operación | Consultas persistidas, progreso, auditoría/exportación autorizada, alertas y observabilidad redactada. | Estados completos/parciales correctos, datos aislados por cuenta, auditoría sin secretos y pruebas de recuperación. |
| BE-7 Espejo del buzón por cuenta | Worker real por cuenta (sesión, inventario, catálogos), configuración de archivo por cuenta, contenido y archivos de elementos ya leídos, inventario de todas las cuentas y programación activable tras su puerta. | Solo se abren elementos ya leídos en SUNAT; aislamiento por cuenta en sesión, base y almacenamiento; lotes acotados y reanudables; ninguna función sin su puerta. |
| BE-8 Refactorización arquitectónica | Separar la API por capacidades, aclarar casos de uso y persistencia, revisar las fronteras del worker y consolidar validación y operación. | Mismo contrato HTTP, permisos, efectos remotos y recuperación; pruebas locales y documentación verifican los límites nuevos. No depende de activar SUNAT. |

## Dependencia de validación SUNAT

Las puertas G-01–G-04 de la [spec backend](../backend/spec.md#6-puertas-de-validación-con-sunat) se ejecutan como las pruebas S-01–S-20 del [plan de integración SUNAT](02-sunat-integration.md). En particular, BE-3 necesita inventario autenticado y arranque controlado; BE-4 necesita login y reingreso desatendidos; BE-5 necesita detalle y archivos validados. Un fallo de SUNAT no se presenta como éxito del backend.

El backend puede completarse con API/worker y pruebas propias usando clientes de test; este plan no presupone que el frontend esté conectado. Los DTOs y rutas definitivos se contrastarán con el frontend en una fase de integración posterior.

## Seguimiento de avance

Esta sección es la fuente de verdad sobre **hasta dónde llegó** el desarrollo. Cualquier agente que continúe el plan debe leerla primero y actualizarla en el mismo commit que cierra o abre trabajo.

**Reglas de marcado**

- `[x]` hecho **y** demostrado por una prueba automatizada o una verificación registrada (se indica cuál). Código sin prueba no se marca.
- `[ ]` pendiente y desbloqueado: puede implementarse con clientes de prueba y fixtures.
- `[ ] ⛔ S-xx` bloqueado por una prueba del [plan SUNAT](02-sunat-integration.md). No se marca hasta que esa prueba pase y conste en su matriz; nunca se simula fijando las variables `SUNAT_*`.
- `[ ] ⏸` diferido a otra fase (integración frontend–backend, P-04, despliegue) con el motivo.
- Un hito se cierra cuando todos sus `[ ]` desbloqueados están en `[x]`; los ⛔ quedan como deuda explícita de la puerta SUNAT.

**Estado:** BE-0 a BE-7 tienen implementado su trabajo técnico desbloqueado; BE-7 conserva decisiones de producto sobre no leídos y formatos, además de pruebas remotas bloqueadas. El cliente HTTP real (`SunatHttpSession`) está registrado en `apps/worker/src/main.ts` para conexión, inventario, lectura, archivo y descargas, cada uno tras su puerta `SUNAT_*`; ninguna puerta se fija en el repositorio ni en `compose.dev.yml`. **BE-8 (refactorización arquitectónica) está implementado y verificado localmente; ver su sección.** En paralelo, la validación remota pendiente sigue su propio plan: con cuentas autorizadas, ejecutar `scripts/run-sunat-probe.ps1 -Mode e2e-archive` (abre solo elementos ya leídos), después levantar API y worker como procesos con las puertas que el operador decida y lanzar `POST /inventory`.

**Última verificación BE-8:** 01/10/2026 — `pnpm typecheck` y `pnpm lint` en verde en los 6 proyectos; unitarias: dominio 7, adaptador 16, worker 13; integración sobre base vacía `buzon_it` (`compose.test.yml`, `BUZON_TEST_DB=1 BUZON_TEST_REDIS=1 BUZON_TEST_S3=1`): API 11/11 (incluye `http-boundary` y `config`), worker 18/19 (el fallo es previo, ver BE-8A). Cierre de la API en contenedor Linux: `SIGTERM` → `api_stopped`, exit 0.

**Última verificación (BE-0 a BE-7):** 30/09/2026 (migraciones `0000`–`0010`) — `pnpm typecheck` y `pnpm lint` en verde; pruebas unitarias de dominio (6), adaptador (16) y worker (5) en verde; la suite web tiene 1 fallo en `app.test.tsx` (texto del login, cambiado fuera de este trabajo); pruebas de integración (`BUZON_TEST_DB=1 BUZON_TEST_REDIS=1 BUZON_TEST_S3=1`; API 2/2, worker 19/19, storage 1/1) contra `compose.test.yml` en una base separada (`buzon_it`), porque `buzon_sol` de ese contenedor guarda el E2E con cuentas reales. Migración `0010`: `migration:revert` y `migration:run` sin error. El worker arranca como proceso: inactivo sin `ENABLE_SUNAT_JOBS`, rechaza combinaciones de puertas inválidas y levanta consumidores y mantenimiento con ellas (sin clave privada ni trabajos, sin contacto con SUNAT). **No ejecutado en esta sesión:** ninguna llamada a SUNAT; el archivo y las rutas nuevas están probados con clientes de prueba.

### BE-0 Base y contratos internos

- [x] Monorepo `apps/api`, `apps/worker`, `packages/domain`, `packages/sunat-adapter`, `packages/storage` con TypeScript estricto.
- [x] Migraciones versionadas (`apps/api/src/db/migrations`), `synchronize`/`migrationsRun` desactivados; ida y vuelta completa verificada.
- [x] Errores tipados `AppError`/`ErrorCode` con todos los códigos de la [spec §3](../backend/spec.md#3-comandos-internos-y-autorización).
- [x] Fixtures inventados en `packages/domain/fixtures`, con `total`/`records` intencionalmente falsos.
- [x] Separación usuario de la app / cuenta SUNAT (tablas y permisos distintos; `packages/domain/src/access.test.ts`).
- [x] Tablas de catálogo `sunat_folders` y `sunat_labels` (migración `0009`; `apps/worker/test/inventory-features.test.ts`).
- [x] Docker Compose de desarrollo `compose.dev.yml` (API, worker, `migrate`, MySQL, Redis con AOF, MinIO con bucket privado) con secretos locales generados por `scripts/dev-env.mjs` en `apps/api/.env` ignorado por git. Verificado levantándolo y con prueba de humo.
- [x] SDK S3 validado contra MinIO (`bitnamilegacy/minio:2025.5.24`) además de S3Mock, con bucket privado comprobado (`packages/storage/src/index.test.ts`, `BUZON_TEST_S3_PRIVATE=1`).
- [ ] ⏸ S3 de producción con soporte: la imagen usada es comunitaria y sin mantenimiento; `minio/minio` no está en Docker Hub. Se decide con el despliegue.

### BE-1 Identidad y permisos

- [x] Login propio con Argon2id, token opaco de 12 h guardado como SHA-256, logout que revoca (`apps/api/test/identity.test.ts`).
- [x] Usuarios, roles, permisos, `role_sunat_accounts` y `all_accounts`; alta del primer administrador (`bootstrap:admin`).
- [x] Roles distintos no obtienen datos de cuentas ajenas y la revocación se aplica a la sesión abierta (`identity.test.ts`, «API enforces account scope and immediate revocation»).
- [x] Cambios de usuarios, roles, cuentas y credenciales auditados sin secretos (`identity.test.ts`).
- [x] Vistas de gestión para el frontend: `roleName` y `preferences` en `/auth/me`, `PATCH /auth/me/preferences`, `roleName`/`lastLoginAt` en usuarios, `userCount` en roles, `GET /admin/account-options` y `GET /admin/accounts/:id/users` (`identity.test.ts`; ver [plan de integración](04-integration.md)).
- [x] Mecanismo de sesión: cookie HttpOnly + CSRF por doble envío (`session-cookie.ts`); `Bearer` se mantiene para clientes no web. En producción servir bajo TLS (`Secure`).

### BE-2 Cuentas y secretos

- [x] Alta, edición y desactivación de cuenta; RUC y usuario SOL cifrados, huella HMAC para unicidad, valores enmascarados en respuestas (`identity.test.ts`).
- [x] Clave SOL en sobre RSA-OAEP + AES-GCM; solo la clave privada del worker lo abre (`packages/domain/src/secrets.test.ts`, `apps/worker/test/credentials.test.ts`).
- [x] Respuestas y auditoría nunca incluyen la clave ni el RUC completo (`identity.test.ts`).
- [x] Prueba de conexión asíncrona que revalida actor, cuenta activa y versión de credencial; credencial rechazada pausa y avisa (`apps/worker/test/connection.test.ts`).
- [x] Cuenta desactivada no crea ejecuciones manuales ni programadas (`inventory.ts`, `scheduler.ts`; `scheduler.test.ts`).
- [x] Rotación de la clave maestra: el worker abre cada sobre con la clave que nombra (`SOL_PREVIOUS_*` durante la transición) y `rotate:keys` recifra RUC, usuario SOL y todas las versiones de credencial, audita sin valores, es repetible y reporta registros ilegibles sin detenerse (`apps/worker/test/rotate-keys.test.ts`).
- [x] Cliente real de prueba de conexión: `SunatHttpSession.testConnection` tras `SUNAT_CONNECTION_CLIENT_READY` (`packages/sunat-adapter/src/http.test.ts`; S-02 pasa en la [matriz](../sunat/integration-status-2026-09-30.md)).

### BE-3 Inventario

- [x] `scanBox`: página ascendente, vacía confirmada repitiéndola, `total`/`records` solo diagnósticos, guardarraíl → `incomplete_inventory` (`packages/sunat-adapter/src/index.test.ts`).
- [x] Fixtures 3328/227 con totales falsos, HTML de login, `rows:null`, vacía transitoria y página fallida sin persistir (`sunat-adapter` tests).
- [x] Upsert idempotente por `(account_id, tipo_msj, cod_mensaje)`, checkpoint por página y reanudación sin duplicados (`apps/worker/test/inventory.test.ts`).
- [x] Bloqueo por cuenta con `GET_LOCK` y `conflict_running`; la interfaz `InventoryClient` no tiene método de detalle.
- [x] Encolado BullMQ con cliente aislado de prueba y cierre de sesión en `finally` (`apps/worker/test/queue.test.ts`).
- [x] Credencial rechazada o tres fallos seguidos pausan la programación y avisan a administradores (`inventory.ts`, `recordFailure`).
- [x] Recuperación de ejecuciones huérfanas: `running` con bloqueo de cuenta libre o `pending` sin trabajo en cola pasan a `partial` (`incomplete_inventory`), se auditan y se reanudan desde su checkpoint; el worker la ejecuta al arrancar y cada `RECOVERY_INTERVAL_MS` (`apps/worker/test/recovery.test.ts`).
- [x] Metadatos normalizados de fila: `published_at` interpretado en `America/Lima` junto al texto original, remitente, carpeta, etiqueta y adjuntos anunciados (migración `0008`; `packages/domain/src/mail.test.ts`, `inventory.test.ts`).
- [x] Avisos en app `new_mail` con solo cantidades por bandeja, para quienes tienen `view_mailbox` sobre la cuenta, contra la última ejecución **completa**; la primera completa es línea base y no avisa; respeta `notify_in_app` (`inventory-features.test.ts`).
- [x] La ejecución recorre solo sus bandejas (`sync_runs.boxes_json`): manual ambas, programada las configuradas (`inventory-features.test.ts`, `scheduler.test.ts`).
- [x] Parsers con fixtures de carpetas (`listarCarpetas`), etiquetas (`listEtiquetas` en el HTML del visor, sin ejecutar scripts) y alertas (`consultarAlertas`); persistencia del catálogo solo con respuesta válida y estado `ok`/`unavailable` por ejecución sin detener el barrido; `GET /accounts/:id/folders|labels` (`packages/sunat-adapter/src/catalogs.test.ts`, `inventory-features.test.ts`, `identity.test.ts`).
- [x] Cliente HTTP real de sesión y listado con cierre remoto completo, registrado en el worker tras `SUNAT_TRANSPORT_VALIDATED` (`http.test.ts`; S-01–S-08 pasan en la [matriz](../sunat/integration-status-2026-09-30.md)). Activar la puerta es decisión del operador.
- [x] Etiquetas en la forma observada en S-11 (`listEtiquetas = $.parseJSON('[...]')`), leídas sin ejecutar scripts; antes solo se aceptaba un arreglo literal y el catálogo real habría quedado `unavailable` (`catalogs.test.ts`, `http.test.ts`).
- [ ] ⛔ S-10/S-12 Contenido de carpetas y alertas no vacías: las filas traen `codCarpeta` nulo, así que la pertenencia a carpeta no se persiste hasta validar la consulta por carpeta.
- [ ] ⛔ S-17/S-18 Aislamiento multi cuenta y reintentos con SUNAT real.

### BE-4 Programador

- [x] Disparos en `America/Lima`, cruce de día UTC y ventanas inválidas rechazadas (`packages/domain/src/schedule.test.ts`).
- [x] Pasada del programador: una ejecución por cuenta, avance de horario, credencial no válida pausa, cola caída pausa y avisa (`apps/worker/test/scheduler.test.ts`).
- [x] Programación real bloqueada: la API rechaza `state=active` y el programador exige `SUNAT_CRON_VALIDATED`.
- [x] Mientras S-04 no pase (`SUNAT_PASSIVE_START_VALIDATED`), el programador exige `remote_effect_accepted`; si falta, pausa con `remote_effect_not_accepted` y avisa a administradores (`scheduler.test.ts`).
- [x] Bucle periódico del programador en el proceso worker (`SCHEDULER_INTERVAL_MS`, sin solaparse), encendido solo con `SUNAT_CRON_VALIDATED` (`apps/worker/src/main.ts`; arranque verificado en `compose.dev.yml`).
- [x] Reautenticación acotada ante `remote_session_expired` (2 por defecto) que continúa desde la página pendiente y deja `partial` al agotar el límite (`inventory-features.test.ts`, con cliente de prueba).
- [ ] ⛔ S-05 Validar esa reautenticación contra SUNAT: duración real de sesión, distinción de CAPTCHA y credencial rechazada.
- [x] La API permite `state=active` solo con `SUNAT_CRON_VALIDATED` y `SUNAT_TRANSPORT_VALIDATED`, credencial válida y primer disparo calculado en Lima; sin ellas, `remote_unavailable` (`apps/api/test/archive.test.ts`).
- [ ] ⛔ S-02/S-05 Fijar `SUNAT_CRON_VALIDATED` en un despliegue: decisión del operador según el criterio de cron desatendido.

### BE-5 Lectura y archivos

- [x] `readContent` con `Idempotency-Key`: evento `pending` y auditoría antes de llamar a SUNAT; repetir no reabre (`apps/worker/test/reading.test.ts`).
- [x] Fallo o proceso caído tras abrir deja el evento `uncertain` y no repite la llamada (`reading.test.ts`).
- [x] Estado remoto antes/después y `updateLeido` registrados; `0→1` confirmado por reconsulta (`reading.test.ts`).
- [x] Contenido HTML sanitizado; documento generado separado del adjunto.
- [x] MIME por firma, tamaño máximo, HTML/PDF falso nunca se guarda (`apps/worker/src/files.test.ts`, `test/files.test.ts`).
- [x] `codArchivo=0` acotado por ítem y cuenta y serializado por cuenta (`test/files.test.ts`).
- [x] RBAC en archivos: permiso revocado niega la obtención encolada antes de la llamada remota; entrega por proxy autenticado (`test/file-fetch.test.ts`).
- [x] Revisión local por usuario que nunca llama a SUNAT (`identity.test.ts`).
- [x] P-03: tras una ejecución programada completa con `download_read_attachments`, se encolan descargas de sistema solo para elementos leídos en SUNAT con detalle guardado; el worker lo vuelve a comprobar antes de la llamada remota y nunca abre un no leído (`inventory-features.test.ts`).
- [x] Clientes reales de detalle, descarga y documento generado registrados tras `SUNAT_READ_VALIDATED` y `SUNAT_FILE_CLIENT_READY` (`http.test.ts`, `sunat-file-client.test.ts`; S-13–S-16 pasan en la matriz para PDF y HTML generado).
- [ ] ⛔ S-14 Efecto de leer una Notificación sin leer: no probado (ver matriz).

### BE-6 Administración y operación

- [x] Actividad por cuenta con progreso por bandeja, bandejas de la ejecución, estado de catálogos y alertas, reautenticaciones y elementos nuevos; resumen con línea base de la última ejecución completa (`operations.ts`).
- [x] Auditoría con alcance por cuenta y exportación CSV autorizada (`/audit`, `/audit.csv`).
- [x] Avisos en app por usuario, filtrados por cuentas visibles, con `counts` solo numéricos (`identity.test.ts`).
- [x] Contrato HTTP actual en `apps/api/openapi.yaml`.
- [x] Consulta de bandeja persistida `GET /accounts/:id/mail` con filtros (bandeja, estado remoto, revisión, texto literal, días Lima, carpeta, etiqueta), orden estable, `total` y metadatos de fila; nunca contacta SUNAT (`identity.test.ts`).
- [x] Observabilidad redactada: `logEvent` JSON por línea con redacción de claves de secretos/contenido y enmascarado de números aislados; métricas `inventory_run_finished` (duración, páginas, filas, nuevas, reautenticaciones, error) y eventos de programador, recuperación, P-03 y rotación; sin escrituras crudas a stdout/stderr en worker ni errores de API (`packages/domain/src/log.test.ts`, `inventory-features.test.ts`).
- [x] Recuperación tras caída del worker a mitad de barrido: la ejecución huérfana pasa a `partial` y continúa en la página pendiente (`recovery.test.ts`).
- [ ] ⏸ P-02 Aviso por correo diario: pendiente de proveedor, destinatarios y consentimiento; la API solo acepta `notifyDailyEmail=false`.
- [ ] ⏸ P-04 Copias de seguridad, retención y borrado: se definen para el entorno real.

### BE-7 Espejo del buzón por cuenta

Cada cuenta SUNAT es una empresa con su credencial, programación y configuración de archivo. Regla que no cambia: **inventariar ≠ leer**. El archivo automático abre únicamente elementos que SUNAT ya lista como leídos (S-13: `updateLeido=false`, sin cambio de estado); un no leído solo se abre con `readContent`.

- [x] Punto de entrada del worker reparado: `main.ts` y `queue.ts` tenían marcadores de conflicto del merge `ffab712` y el paquete no compilaba. Ahora combina mantenimiento, programador y consumidores reales por puerta (`src/main.test.ts`; arranque verificado como proceso).
- [x] Configuración por cuenta `archive_content`, `archive_files`, `archive_batch_size` (migración `0010`), apagada por defecto, solo `manage_accounts`, auditada; `GET/PATCH /admin/accounts/:id/mailbox-settings` (`apps/api/test/archive.test.ts`).
- [x] `ArchiveProcessor`: lote acotado por cuenta bajo el bloqueo de la cuenta y una sesión por lote; intención registrada antes de cada detalle (`mail_read_events.origin='archive'`); cuerpo original y saneado; nunca abre un no leído; no cruza cuentas (`apps/worker/test/archive.test.ts`).
- [x] Archivos en la misma sesión justo después de su detalle, validados por firma y guardados en `{cuenta}/{elemento}/{archivo}`; `codArchivo` ambiguo no se descarga; exige además `SUNAT_FILE_CLIENT_READY` (`archive.test.ts`, `http.test.ts` «downloadAttachment»).
- [x] Salvaguarda: si un detalle responde `updateLeido=true`, el lote se detiene, desactiva el archivo de la cuenta, audita y avisa a administradores (`archive.test.ts`).
- [x] Fallos acotados (tres por elemento o archivo, tres seguidos por lote, sesión vencida sin penalizar al elemento), credencial rechazada pausa la cuenta, lotes huérfanos recuperados (`archive.test.ts`).
- [x] Encadenado: un inventario completo encola el archivo de la cuenta y los lotes continúan mientras haya avance y pendientes (`archive.test.ts`, con BullMQ).
- [x] `POST /inventory`: un inventario por cada cuenta activa permitida, con resultado por cuenta; `POST/GET /accounts/:id/archive`; `contentStored`, `storedFiles` y filtro `content` en la bandeja (`apps/api/test/archive.test.ts`, `openapi.yaml`).
- [ ] ⛔ Ejecutar `scripts/run-sunat-probe.ps1 -Mode e2e-archive -Names A,B` con cuentas autorizadas y registrar el resultado (`unexpectedReads` debe ser 0). No se ejecutó: requiere las credenciales guardadas y la decisión del usuario.
- [ ] ⛔ Ejecutar API y worker como procesos con las puertas activadas y lanzar `POST /inventory` contra SUNAT real.
- [ ] Decisión de producto: archivar también los no leídos implica marcarlos como leídos en SUNAT de forma irreversible. No está implementado ni se implementa sin caso de uso y autorización expresa.
- [ ] Tipos de archivo: hoy solo se guardan PDF, PNG, JPEG, ZIP y el HTML generado; otros formatos quedan `failed`. Ampliar la lista cuando se observe un adjunto real distinto.
- [x] Vistas para el frontend: `GET /accounts/:id/items/:itemId`, `GET …/reads/:eventId`, `GET /admin/runs`, estado de la última consulta en `/accounts` y `/admin/accounts`, y `pendingReview`, `failedFiles`, `newSince` en el resumen (`apps/api/test/archive.test.ts`). La lectura encolada reintenta solo ante el bloqueo ocupado de la cuenta.
- [x] INT-2: pantallas del buzón sobre estas rutas (ver [plan de integración](04-integration.md)).

### BE-8 Refactorización arquitectónica de API y worker

**Alcance:** ejecutar el [prompt de refactorización arquitectónica](05-backend-architecture-refactor-prompt.md) sobre el backend existente. Es una mejora estructural; no sustituye BE-0–BE-7, no cambia funciones de producto y no requiere pruebas con SUNAT real. Las etapas se ejecutan en orden, con cambios revisables y verificación después de cada una. El plan de integración frontend–backend conserva la autoridad sobre cambios de contrato web.

**Contrato de preservación:** rutas y respuestas `/api/v1`, `apps/api/openapi.yaml`, sesión revocable, permisos por cuenta, cifrado y redacción, API/worker separados, migraciones explícitas, idempotencia y estados duraderos, bloqueos por cuenta, puertas `SUNAT_*` apagadas y la distinción «inventariar ≠ leer». Las pruebas usan una base de test separada; `buzon_sol` en `compose.test.yml` puede contener datos reales de E2E y no debe limpiarse ni reutilizarse para pruebas destructivas. No activar puertas ni contactar SUNAT para cerrar BE-8.

#### BE-8A Inventario y línea base

- [x] Registrar `git status` y distinguir cambios preexistentes de los realizados en BE-8. Trazar rutas → controller → servicio → SQL/cola y jobs → procesador → MySQL/SUNAT/S3; señalar acoplamientos, consultas repetidas y límites transaccionales actuales. **Evidencia:** árbol limpio al empezar (solo hay cambios de BE-8); mapa rutas → controller → servicio → SQL/cola y jobs → procesador en [apps/api/README.md](../../../apps/api/README.md#arquitectura-de-api-y-worker-be-8). Acoplamientos hallados: un controller de 359 líneas con 12 servicios, 20 inserciones de auditoría repetidas, 5 aperturas de cola repetidas, 7 copias del bloqueo por cuenta y validación de forma dispersa en cada servicio.
- [x] Documentar decisiones «mantener / cambiar / posponer» con archivos afectados, motivo y prueba de preservación. Definir el orden exacto de módulos después de leer sus dependencias, sin crear una capa por entidad de forma mecánica. **Evidencia:** tabla de decisiones en el README de la API; orden aplicado: HTTP/módulos → auditoría y cola → worker → configuración y operación.
- [x] Ejecutar y registrar línea base de `pnpm typecheck`, `pnpm lint`, suites unitarias y suites de integración pertinentes con `DB_NAME=buzon_it` u otra base vacía de prueba. Identificar fallos preexistentes; no atribuirlos a BE-8. **Línea base (antes de cambiar código):** typecheck y lint verdes; unitarias dominio 7, adaptador 16, worker 5; integración sobre `buzon_it` recién creada: API 7/7; worker 15/19 con 3 omitidas (sin Redis/S3) y **1 fallo previo**: `inventory-features.test.ts` «configured boxes… new-item notices» falla cuando las pruebas de la API se ejecutaron antes en la misma base (cuenta avisos de usuarios creados por esas pruebas). Sigue igual tras BE-8 y queda como pendiente de aislamiento de pruebas, no de la refactorización.

**Cierre de A:** existe un mapa y un registro de decisiones que permiten revisar cada movimiento de código; la línea base incluye comandos, entorno de prueba y resultados. Un fallo previo no impide planificar las siguientes etapas si queda localizado.

#### BE-8B Frontera HTTP y módulos API

- [x] Dividir `IdentityController` por capacidades (identidad y usuarios/roles, cuentas, buzón, programación/inventario, lectura/archivo, operaciones/auditoría), manteniendo rutas, métodos, parámetros, estados y cuerpos. Componer los módulos NestJS sin dependencias circulares ni registros duplicados. **Evidencia:** 12 controllers y 13 módulos (`apps/api/src/*/*.module.ts`); `test/http-boundary.test.ts` comprueba que cada una de las 52 rutas previas de OpenAPI sigue existiendo.
- [x] Aplicar el filtro de errores a todos los controllers y establecer validación coherente de parámetros, query y body. Priorizar autenticación, administración y comandos con efectos; conservar valores válidos actuales y rechazar entradas inválidas de forma estable. **Evidencia:** `SafeErrorFilter` global (`APP_FILTER` en `core`), cubre health; DTOs por operación en `*/*.dto.ts` (`whitelist`, sin coerción); `http-boundary.test.ts`: 11 cuerpos inválidos → `400 {code:"validation"}`, `?q=a&q=b` → 400, cuerpo válido llega a autenticación (401). Decisiones: sin `forbidNonWhitelisted` porque la web envía campos extra en `PATCH …/schedule`; con cuerpo inválido la validación responde antes que la autenticación.
- [x] Mantener HTTP y Fastify fuera de los casos de uso. El controller obtiene actor y entrada, llama al servicio y adapta la salida; no accede directamente a MySQL, BullMQ ni SUNAT. **Evidencia:** ningún servicio importa Fastify (solo `files.controller.ts` usa la respuesta cruda para el streaming); los controllers no importan TypeORM, BullMQ ni el cliente SUNAT.
- [x] Verificar compatibilidad de `apps/api/openapi.yaml` y del `HttpAdapter`; si una corrección inevitable altera el contrato, actualizar API, OpenAPI, adaptador web y sus pruebas en el mismo cambio. **Evidencia:** ruta, método, estado y cuerpos sin cambio (suites `identity`, `archive` y `settings` verdes sin modificar sus aserciones); solo se añade `GET /health/ready` a OpenAPI. `HttpAdapter` no cambia.

**Cierre de B:** las pruebas HTTP cubren sesión, revocación, permisos por cuenta y rutas representativas de cada controller; el contrato consumido por la web sigue funcionando. El health check también recibe el tratamiento de errores previsto.

#### BE-8C Casos de uso, persistencia y auditoría

- [x] Separar consultas complejas o repetidas de los servicios cuando ello aclare autorización, transacciones o reutilización. Conservar SQL local sencillo donde extraerlo solo añadiría archivos. Ningún acceso a datos pierde el filtro de cuenta o la comprobación de permiso. **Evidencia:** `visibleAccounts` pasó a `AccountsService` y `setReviewed` a `MailboxService`; se decidió mantener el SQL local de cada servicio (cada consulta conserva `account_id` y permiso; ver tabla de decisiones).
- [x] Hacer explícito el límite transaccional de cada escritura con estado y auditoría. Mantener estado y evento auditado en la misma transacción cuando forman una sola acción; no sostener transacciones durante llamadas a Redis, S3 o SUNAT. **Evidencia:** toda escritura con estado + auditoría usa `recordAudit(manager, …)` dentro de su `db.transaction`; `addJob` se llama siempre después de confirmar (`common/job-queue.ts`).
- [x] Reducir la duplicación real al construir eventos de auditoría y redacción, sin repositorio base, diffs universales ni auditoría de cada fila técnica. Revisar que el encolado y la recuperación de `pending`/huérfanos no se describan como una transacción entre MySQL y Redis. **Evidencia:** `common/audit.ts` (20 sitios) y `common/job-queue.ts` (5 sitios); documentado que MySQL y Redis no son atómicos y que la recuperación de huérfanos cierra la ventana.

**Cierre de C:** pruebas de integración confirman operaciones administrativas auditadas sin secretos, aislamiento por cuenta e idempotencia de comandos; el mapa de A señala el nuevo dueño de cada transacción y consulta extraída.

#### BE-8D Worker y fronteras externas

- [x] Revisar por familia de job conexión, inventario, lectura, archivo, archivos, programación y recuperación: validación al ejecutar, puerta requerida, bloqueo de cuenta, apertura/cierre de sesión, estado previo a llamada remota y fallo en cada dependencia. **Evidencia:** familias revisadas contra el código y las suites del worker; sin cambios de política: reintentos, lotes, `codArchivo=0`, checkpoints y `uncertain` intactos.
- [x] Refactorizar solo los procesadores cuyo tamaño o mezcla de responsabilidades dificulte seguir esos pasos. Mantener el worker como proceso separado y conservar política de reintentos, lote, `codArchivo=0`, checkpoints y estado `uncertain`. **Evidencia:** solo se extrajo el bloqueo por cuenta (`apps/worker/src/account-lock.ts`, 6 archivos y 7 usos) y el bucle periódico (`loop.ts`); los procesadores no se reescribieron.
- [x] Verificar cierre de consumidores, colas, timers, conexiones MySQL y sesión SUNAT; conservar la recuperación cuando falla el encolado o cae el proceso. **Evidencia:** `loop.test.ts` (el bucle nunca se solapa y `stop()` espera la pasada en curso); `main.ts` detiene los bucles antes de cerrar consumidores, colas y MySQL; recuperación de huérfanos cubierta por `recovery.test.ts` y `archive.test.ts` sin cambios. No hay prueba automatizada del apagado completo con Redis/MySQL reales: exigiría fijar puertas SUNAT.

**Cierre de D:** pruebas con clientes de prueba confirman inventario sin detalle, reanudación sin duplicados, intención antes de lectura, no repetición de un efecto incierto, archivo solo de ya leídos, aislamiento entre cuentas y cierre de recursos. Ninguna puerta remota se activa para probarlo.

#### BE-8E Configuración, operación y cierre

- [x] Validar al inicio la configuración esencial de API y worker, incluidas combinaciones de puertas; exigir secretos solo para capacidades habilitadas. Revisar ejemplo de entorno sin secretos reales. **Evidencia:** `apps/api/src/config.ts` + `apps/api/test/config.test.ts` y `apps/worker/src/config.ts` + `config.test.ts`; `apps/api/.env.example` nuevo.
- [x] Diferenciar liveness de readiness con comprobaciones acotadas de dependencias esenciales. Implementar cierre ordenado de la API y verificar el cierre existente del worker sin convertir una dependencia opcional en obligatoria. **Evidencia:** `GET /health/ready` (MySQL siempre, Redis solo con puertas que encolan) con prueba unitaria del 503 sin filtrar el motivo y comprobación en `http-boundary.test.ts`; cierre ordenado verificado ejecutando la API en un contenedor Linux (`SIGTERM` → `api_stopped`, exit 0; en Windows Node no recibe esas señales).
- [x] Ejecutar verificación final: `pnpm typecheck`, `pnpm lint`, pruebas unitarias y de integración pertinentes en base de test separada, arranque sin puertas SUNAT y rechazo de configuración inválida. Registrar resultados y cualquier limitación. **Evidencia:** ver «Última verificación BE-8». Limitación: el fallo previo del worker descrito en BE-8A; el arranque con puertas apagadas lo cubre `main.test.ts` (queda inactivo, cierra con `SIGTERM` y rechaza combinaciones inválidas).
- [x] Actualizar README, OpenAPI si procede, mapa de arquitectura y este seguimiento con archivos modificados, decisiones, pruebas e invariantes preservadas. Marcar cada ítem `[x]` solo con evidencia conforme a las reglas de este plan. **Evidencia:** sección «Arquitectura de API y worker (BE-8)» en el README de la API (mapa, recorridos, decisiones); invariantes preservadas abajo.

**Cierre de BE-8:** las etapas A–E están verificadas; una petición HTTP y un job pueden seguirse desde la entrada hasta sus efectos, el comportamiento observable permanece compatible y los pendientes de producto/despliegue quedan registrados por separado. No exige cerrar las pruebas S-xx ni las decisiones diferidas de BE-1/BE-7.

**Invariantes preservadas en BE-8 y su prueba**

| Invariante | Prueba |
|---|---|
| Rutas y respuestas `/api/v1` | `http-boundary.test.ts` (52 rutas); `identity.test.ts`, `archive.test.ts`, `settings.test.ts` sin cambios de aserción |
| Sesión revocable, permisos y aislamiento por cuenta | `identity.test.ts` («account scope and immediate revocation») |
| Auditoría sin secretos, en la misma transacción que el estado | `identity.test.ts`, `archive.test.ts` |
| Inventariar ≠ leer; intención antes de la lectura; `uncertain` sin repetir | `worker/test/inventory.test.ts`, `reading.test.ts` |
| Checkpoint y reanudación sin duplicados; huérfanos | `worker/test/inventory.test.ts`, `recovery.test.ts` |
| Archivo solo de ya leídos y aborto con `updateLeido=true` | `worker/test/archive.test.ts` |
| Exclusión por cuenta (`codArchivo=0` serializado) | `worker/test/files.test.ts`, `file-fetch.test.ts` |
| Puertas apagadas por defecto y combinaciones inválidas | `worker/src/main.test.ts`, `config.test.ts` |
| API y worker no migran; esquema sin cambios | sin migración nueva; `synchronize:false` y `migrationsRun:false` intactos |

**Pendientes registrados (no de BE-8):** aislamiento de `inventory-features.test.ts` (ver BE-8A); `forbidNonWhitelisted` cuando la web deje de enviar campos de solo lectura; comprobación de S3 en readiness solo si el despliegue lo pide; el apagado completo del worker con Redis/MySQL reales requiere una puerta SUNAT y queda para una prueba del operador.
