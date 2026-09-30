# Plan de desarrollo backend · Buzón SOL v2

Este plan cubre **la API, el worker y la persistencia del backend**. Las pruebas controladas del login y servicios remotos tienen un [plan independiente de integración SUNAT](sunat-integration.md). El frontend se desarrolla con [su propio plan](frontend.md). La conexión frontend–backend y sus pruebas extremo a extremo se planificarán posteriormente.

**Fuentes:** [spec backend](../backend/spec.md), [prompt técnico](../backend/prompt.md), [requisitos de producto](../product/requirements.md) y [contrato SUNAT observado](../sunat/contracts.md). El prompt técnico propone NestJS/Fastify, TypeORM, MySQL, BullMQ/Redis y MinIO; la integración SUNAT prueba primero HTTP con sesión aislada y reserva Playwright para una dependencia real del navegador. Las decisiones de dependencias se verifican durante implementación.

| Hito | Entregable backend | Criterio de cierre |
|---|---|---|
| BE-0 Base y contratos internos | Estructura API/worker, migraciones, entidades mínimas, DTOs internos y fixtures redactados de SUNAT. | Migraciones repetibles; fixtures sin RUC real ni secretos; errores tipados; separación cuenta/usuario. |
| BE-1 Identidad y permisos | Autenticación de la app, usuarios, roles, permisos por cuenta, sesiones y auditoría inicial. | Pruebas API: usuarios con roles distintos no obtienen datos de cuentas ajenas; revocación efectiva; acciones auditadas. |
| BE-2 Cuentas y secretos | Alta/desactivación de cuenta, credencial SOL cifrada y reemplazable, prueba de conexión, almacenamiento y control de acceso. | Clave nunca sale por API/log/auditoría; acceso solo a worker autorizado; cuenta desactivada no programa consultas. |
| BE-3 Inventario | Adaptador SUNAT, sesiones aisladas, listados, paginación hasta vacío confirmado, deduplicación, persistencia, checkpoint y reanudación. | Fixtures 3328/227, `total` erróneo, HTML de login, página vacía transitoria y error de página; sin abrir detalle durante barrido. La prueba remota corresponde a S-01–S-12 del [plan SUNAT](sunat-integration.md). |
| BE-4 Programador | Worker por cuenta, horarios Lima, bloqueo de ejecución duplicada, avisos, expiración/rechazo y recuperación. | Programación real desactivada hasta cumplir el [criterio de cron desatendido](sunat-integration.md#criterio-de-liberación). Pausa y reanudación sin duplicados. |
| BE-5 Lectura y archivos | Comando explícito de lectura, `read_event`, confirmación de estado, contenido seguro, documentos generados, descargas y revisión local. | Fallo tras abrir conserva evento; `0→1` en Mensaje; archivo con MIME inválido no se guarda; `codArchivo=0` serializado; RBAC en archivos. |
| BE-6 Administración y operación | Consultas persistidas, progreso, auditoría/exportación autorizada, alertas y observabilidad redactada. | Estados completos/parciales correctos, datos aislados por cuenta, auditoría sin secretos y pruebas de recuperación. |

## Dependencia de validación SUNAT

Las puertas G-01–G-04 de la [spec backend](../backend/spec.md#6-puertas-de-validación-con-sunat) se ejecutan como las pruebas S-01–S-20 del [plan de integración SUNAT](sunat-integration.md). En particular, BE-3 necesita inventario autenticado y arranque controlado; BE-4 necesita login y reingreso desatendidos; BE-5 necesita detalle y archivos validados. Un fallo de SUNAT no se presenta como éxito del backend.

El backend puede completarse con API/worker y pruebas propias usando clientes de test; este plan no presupone que el frontend esté conectado. Los DTOs y rutas definitivos se contrastarán con el frontend en una fase de integración posterior.

## Seguimiento de avance

Esta sección es la fuente de verdad sobre **hasta dónde llegó** el desarrollo. Cualquier agente que continúe el plan debe leerla primero y actualizarla en el mismo commit que cierra o abre trabajo.

**Reglas de marcado**

- `[x]` hecho **y** demostrado por una prueba automatizada o una verificación registrada (se indica cuál). Código sin prueba no se marca.
- `[ ]` pendiente y desbloqueado: puede implementarse con clientes de prueba y fixtures.
- `[ ] ⛔ S-xx` bloqueado por una prueba del [plan SUNAT](sunat-integration.md). No se marca hasta que esa prueba pase y conste en su matriz; nunca se simula fijando las variables `SUNAT_*`.
- `[ ] ⏸` diferido a otra fase (integración frontend–backend, P-04, despliegue) con el motivo.
- Un hito se cierra cuando todos sus `[ ]` desbloqueados están en `[x]`; los ⛔ quedan como deuda explícita de la puerta SUNAT.

**Estado:** todo el trabajo desbloqueado de BE-0 a BE-6 está hecho. Lo que queda son ítems ⛔ (dependen de pruebas con SUNAT real) y ⏸ (otra fase). **Siguiente paso:** ejecutar la [fase A del plan SUNAT](sunat-integration.md#fase-a--login-sesión-y-efecto-del-arranque) con una cuenta autorizada para decidir el transporte; con `HTTP_VALIDADO` o `NAVEGADOR_REQUERIDO`, implementar el cliente real detrás de `InventoryClient` (y `ReadClient`, `FileClient`, `ConnectionClient`), registrar sus consumidores en `apps/worker/src/main.ts` y abrir cada puerta `SUNAT_*` según su prueba.

**Última verificación:** 30/09/2026 (migraciones `0000`–`0009`) — `pnpm typecheck`, `pnpm lint`, `pnpm test` y pruebas de integración (`BUZON_TEST_DB=1 BUZON_TEST_REDIS=1 BUZON_TEST_S3=1`; API 1/1, worker 13/13, storage 1/1) en verde contra `compose.test.yml` (MySQL 8.4, Redis 7.4, S3Mock). Migraciones: `migration:revert` ×10 y `migration:run` sin error. `compose.dev.yml` construido y levantado: migración, API (`/health`), worker, MinIO con bucket privado (GET anónimo `403`) y prueba de humo HTTP (admin inicial, login, alta de cuenta ficticia, credencial, bandeja, etiquetas; inventario rechazado por puerta cerrada; ningún secreto en logs).

### BE-0 Base y contratos internos

- [x] Monorepo `apps/api`, `apps/worker`, `packages/domain`, `packages/sunat-adapter`, `packages/storage` con TypeScript estricto.
- [x] Migraciones versionadas (`apps/api/src/db/migrations`), `synchronize`/`migrationsRun` desactivados; ida y vuelta completa verificada.
- [x] Errores tipados `AppError`/`ErrorCode` con todos los códigos de la [spec §3](../backend/spec.md#3-comandos-internos-y-autorización).
- [x] Fixtures inventados en `packages/domain/fixtures`, con `total`/`records` intencionalmente falsos.
- [x] Separación usuario de la app / cuenta SUNAT (tablas y permisos distintos; `packages/domain/src/access.test.ts`).
- [x] Tablas de catálogo `sunat_folders` y `sunat_labels` (migración `0009`; `apps/worker/test/inventory-features.test.ts`).
- [x] Docker Compose de desarrollo `compose.dev.yml` (API, worker, `migrate`, MySQL, Redis con AOF, MinIO con bucket privado) con secretos locales generados por `scripts/dev-env.mjs` en `.env.dev` ignorado por git. Verificado levantándolo y con prueba de humo.
- [x] SDK S3 validado contra MinIO (`bitnamilegacy/minio:2025.5.24`) además de S3Mock, con bucket privado comprobado (`packages/storage/src/index.test.ts`, `BUZON_TEST_S3_PRIVATE=1`).
- [ ] ⏸ S3 de producción con soporte: la imagen usada es comunitaria y sin mantenimiento; `minio/minio` no está en Docker Hub. Se decide con el despliegue.

### BE-1 Identidad y permisos

- [x] Login propio con Argon2id, token opaco de 12 h guardado como SHA-256, logout que revoca (`apps/api/test/identity.test.ts`).
- [x] Usuarios, roles, permisos, `role_sunat_accounts` y `all_accounts`; alta del primer administrador (`bootstrap:admin`).
- [x] Roles distintos no obtienen datos de cuentas ajenas y la revocación se aplica a la sesión abierta (`identity.test.ts`, «API enforces account scope and immediate revocation»).
- [x] Cambios de usuarios, roles, cuentas y credenciales auditados sin secretos (`identity.test.ts`).
- [ ] ⏸ Mecanismo definitivo de sesión (cookie + CSRF o token) según despliegue del frontend: fase de integración.

### BE-2 Cuentas y secretos

- [x] Alta, edición y desactivación de cuenta; RUC y usuario SOL cifrados, huella HMAC para unicidad, valores enmascarados en respuestas (`identity.test.ts`).
- [x] Clave SOL en sobre RSA-OAEP + AES-GCM; solo la clave privada del worker lo abre (`packages/domain/src/secrets.test.ts`, `apps/worker/test/credentials.test.ts`).
- [x] Respuestas y auditoría nunca incluyen la clave ni el RUC completo (`identity.test.ts`).
- [x] Prueba de conexión asíncrona que revalida actor, cuenta activa y versión de credencial; credencial rechazada pausa y avisa (`apps/worker/test/connection.test.ts`).
- [x] Cuenta desactivada no crea ejecuciones manuales ni programadas (`inventory.ts`, `scheduler.ts`; `scheduler.test.ts`).
- [x] Rotación de la clave maestra: el worker abre cada sobre con la clave que nombra (`SOL_PREVIOUS_*` durante la transición) y `rotate:keys` recifra RUC, usuario SOL y todas las versiones de credencial, audita sin valores, es repetible y reporta registros ilegibles sin detenerse (`apps/worker/test/rotate-keys.test.ts`).
- [ ] ⛔ S-02 Cliente real de prueba de conexión (`SUNAT_CONNECTION_CLIENT_READY`).

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
- [ ] ⛔ S-01–S-08 Cliente HTTP real de sesión y listado (transporte `NO_VALIDADO`, ver [informe fase A](../sunat/phase-a-report-2026-09-30.md)).
- [ ] ⛔ S-10–S-12 Carpetas, etiquetas y alertas contra SUNAT (la forma exacta de `listEtiquetas` en el visor está sin confirmar).
- [ ] ⛔ S-17/S-18 Aislamiento multi cuenta y reintentos con SUNAT real.

### BE-4 Programador

- [x] Disparos en `America/Lima`, cruce de día UTC y ventanas inválidas rechazadas (`packages/domain/src/schedule.test.ts`).
- [x] Pasada del programador: una ejecución por cuenta, avance de horario, credencial no válida pausa, cola caída pausa y avisa (`apps/worker/test/scheduler.test.ts`).
- [x] Programación real bloqueada: la API rechaza `state=active` y el programador exige `SUNAT_CRON_VALIDATED`.
- [x] Mientras S-04 no pase (`SUNAT_PASSIVE_START_VALIDATED`), el programador exige `remote_effect_accepted`; si falta, pausa con `remote_effect_not_accepted` y avisa a administradores (`scheduler.test.ts`).
- [x] Bucle periódico del programador en el proceso worker (`SCHEDULER_INTERVAL_MS`, sin solaparse), encendido solo con `SUNAT_CRON_VALIDATED` (`apps/worker/src/main.ts`; arranque verificado en `compose.dev.yml`).
- [x] Reautenticación acotada ante `remote_session_expired` (2 por defecto) que continúa desde la página pendiente y deja `partial` al agotar el límite (`inventory-features.test.ts`, con cliente de prueba).
- [ ] ⛔ S-05 Validar esa reautenticación contra SUNAT: duración real de sesión, distinción de CAPTCHA y credencial rechazada.
- [ ] ⛔ S-02/S-05 Criterio de cron desatendido; recién entonces permitir `state=active` en la API.

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
- [ ] ⛔ S-13–S-16 Clientes reales de detalle, descarga y documento generado (también habilitan P-03 en producción).

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
