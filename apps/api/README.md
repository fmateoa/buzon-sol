# API y worker backend

La API tiene autenticación propia, roles, usuarios, cuentas cifradas, consultas persistidas y comandos asíncronos. El worker ejecuta inventarios, lecturas, pruebas de conexión y descargas con clientes SUNAT inyectados; hoy solo existen clientes de prueba. Su proceso principal no inicia sesiones SUNAT reales: el transporte sigue `NO_VALIDADO` según el [plan de integración](../../specs/buzon-sol/plan/sunat-integration.md). El frontend aún usa su adaptador local. El avance por hito está en el [seguimiento del plan backend](../../specs/buzon-sol/plan/backend.md#seguimiento-de-avance).

## Stack de desarrollo

```sh
node scripts/dev-env.mjs
docker compose -f compose.dev.yml -p buzon-dev up -d --build
```

`dev-env.mjs` genera `.env.dev` (ignorado por git) con contraseñas locales aleatorias, un par RSA de desarrollo y la clave de huellas. El Compose levanta MySQL 8.4, Redis 7.4 con AOF, MinIO con bucket privado `buzon`, un servicio `migrate` que aplica migraciones y termina, la API en `127.0.0.1:38080` y el worker. Ninguna puerta `SUNAT_*` está activa. MinIO usa `bitnamilegacy/minio:2025.5.24`, una compilación comunitaria sin mantenimiento: sirve para desarrollo local; producción necesita un S3 compatible con soporte. La imagen oficial `minio/minio` no está disponible en Docker Hub.

## Configuración

MySQL 8 con base `buzon_sol`. Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `API_PORT` para HTTP. La API necesita `SOL_PUBLIC_KEY_PEM`, `SOL_KEY_ID` y `ACCOUNT_FINGERPRINT_KEY_B64` (32 bytes aleatorios en base64, estable entre reinicios). Solo el worker recibe la clave privada RSA (`SOL_PRIVATE_KEY_PEM`). Las claves se entregan por el mecanismo de secretos del despliegue, nunca en el repositorio.

Redis usa `REDIS_URL`. Los archivos usan `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY` y `S3_SECRET_KEY`; el bucket debe ser privado. La API entrega archivos mediante un proxy autenticado, de modo que una URL copiada pierde acceso inmediatamente después de revocar el permiso. El SDK se verificó contra S3Mock y contra MinIO, incluido que un GET anónimo recibe `403`.

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

Prefijo `/api/v1`. El contrato de rutas, DTOs, permisos y errores actuales está en `openapi.yaml`. `POST /auth/login` recibe `{email,password}` y devuelve un token opaco de 12 horas. Enviar `Authorization: Bearer <token>`; `POST /auth/logout` lo revoca. `GET /auth/me` consulta permisos y cuentas actuales en cada solicitud, de modo que una revocación se aplica a la sesión abierta. Los tokens se guardan solo como SHA-256 en la base. Servir la API bajo TLS; el cliente debe mantener el token fuera de almacenamiento persistente del navegador.

Administración: `GET/POST /roles`, `PATCH /roles/:id`, `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `GET/POST /admin/accounts`, `PATCH /admin/accounts/:id`, `PATCH /admin/accounts/:id/active`, `POST /admin/accounts/:id/credential`, `POST /admin/accounts/:id/connection-tests` y `GET /admin/accounts/:id/connection-tests/:testId`. Las respuestas de cuentas y pruebas nunca incluyen RUC completo, usuario SOL completo ni Clave SOL.

Buzón: `GET /accounts`, `GET /accounts/:id/mail` (devuelve `{rows,total,offset,limit}` con metadatos persistidos; filtros `box`, `state`, `review`, `q`, `dateFrom`/`dateTo` como días de `America/Lima`, `folder`, `label`, orden `sort`/`direction`, paginación `offset` ≥ 0 y `limit` de 1 a 200), `GET /accounts/:id/folders` y `GET /accounts/:id/labels` (último catálogo observado y resultado del último intento), `GET /accounts/:id/summary`, `GET /accounts/:id/activity`, `POST /accounts/:id/inventory`, `POST /accounts/:id/runs/:runId/resume`, `POST /accounts/:id/items/:itemId/read` con `Idempotency-Key`, `GET /accounts/:id/items/:itemId/detail`, `PATCH /accounts/:id/items/:itemId/review` con `{ "reviewed": true|false }`, `POST /accounts/:id/files/:fileId/fetch`, `GET /accounts/:id/files/:fileId/fetches/:fetchId`, `GET /accounts/:id/files/:fileId`, `GET/PATCH /accounts/:id/schedule`. La obtención de un archivo por usuario requiere una lectura explícita completada. El estado `reviewed` es privado del usuario y jamás llama a SUNAT. Auditoría y avisos: `GET /audit`, `GET /audit.csv`, `GET /notices` (con `counts` solo numéricos), `POST /notices/:id/read`. Cada ruta vuelve a comprobar permiso y cuenta.

## Puertas SUNAT

Cada puerta se activa únicamente cuando exista el cliente apropiado y se supere la prueba correspondiente del plan de integración. Nunca fijarlas para simular una validación en un entorno real.

| Variable | Habilita | Prueba que la respalda |
|---|---|---|
| `SUNAT_TRANSPORT_VALIDATED` | Inventario manual y reanudación | S-01–S-04, S-06–S-08, S-17/S-18 |
| `SUNAT_READ_VALIDATED` | Lectura explícita | S-13/S-14 |
| `SUNAT_CONNECTION_CLIENT_READY` | Prueba de conexión | S-02 |
| `SUNAT_FILE_CLIENT_READY` | Descargas por usuario y P-03 | S-15/S-16 |
| `SUNAT_CRON_VALIDATED` | Bucle del programador en el worker | S-02/S-05 repetidos |
| `SUNAT_PASSIVE_START_VALIDATED` | Disparar sin `remote_effect_accepted` | S-04 |
| `ENABLE_SUNAT_JOBS` | Consumidores de colas SUNAT | Hoy aborta: no hay clientes validados |

La API aún rechaza `state=active` en programaciones. Mientras S-04 no pase, el programador pausa (`remote_effect_not_accepted`) y avisa a administradores si la programación no tiene `remoteEffectAccepted`.

## Worker

- **Mantenimiento:** al arrancar y cada `RECOVERY_INTERVAL_MS` (5 min por defecto) pasa a `partial` las ejecuciones `running` sin proceso vivo (bloqueo de cuenta libre) y las `pending` cuyo trabajo ya no está en la cola, para reanudarlas desde su checkpoint.
- **Programador:** con `SUNAT_CRON_VALIDATED=true`, una pasada cada `SCHEDULER_INTERVAL_MS` (60 s) crea una ejecución por cuenta vencida con sus bandejas configuradas.
- **Inventario:** recorre las bandejas de la ejecución; carpetas, etiquetas y alertas son auxiliares y un fallo queda como `unavailable` sin detener el barrido ni borrar el último catálogo. Ante `remote_session_expired` reautentica a lo sumo 2 veces y continúa en la página pendiente. Al completar, cuenta los elementos nuevos desde la última ejecución completa (la primera no genera aviso) y avisa con cantidades a quienes tienen `view_mailbox` sobre la cuenta, si la programación no desactiva avisos en app.
- **P-03:** tras una ejecución programada completa con `downloadReadAttachments`, encola descargas solo de elementos leídos en SUNAT con detalle ya guardado; el worker lo vuelve a comprobar antes de llamar a SUNAT. Nunca abre un no leído.
- **Rotación de clave maestra:** generar un par nuevo; en el worker poner la clave nueva en `SOL_PRIVATE_KEY_PEM`/`SOL_PUBLIC_KEY_PEM`/`SOL_KEY_ID` y la anterior en `SOL_PREVIOUS_KEY_ID`/`SOL_PREVIOUS_PRIVATE_KEY_PEM`; en la API, la pública nueva. Ejecutar `pnpm --filter @buzon-sol/worker rotate:keys`: recifra RUC, usuario SOL y todas las versiones de credencial, audita cada cuenta sin valores y es repetible. Con salida `0`, retirar las variables `SOL_PREVIOUS_*` y destruir la clave anterior.
- **Logs:** JSON por línea con `logEvent`; se redactan claves de secretos, cookies, tokens, `hc`, `state`, `datos`, RUC, asuntos y cuerpos, y se enmascaran números aislados de 8 o más dígitos.

## Pruebas

Las pruebas HTTP con MySQL real se ejecutan con `BUZON_TEST_DB=1 pnpm --filter @buzon-sol/api test:integration` y variables `DB_*` apuntando a una base de pruebas (`docker compose -f compose.test.yml up -d`). Las del worker usan `pnpm --filter @buzon-sol/worker test:integration`; opcionalmente `BUZON_TEST_REDIS=1` y `BUZON_TEST_S3=1` ejercitan Redis y S3. `BUZON_TEST_S3_PRIVATE=1` comprueba además que el bucket rechaza lecturas anónimas (S3Mock no aplica autenticación; usar MinIO). No ejecutar contra una base con datos reales: las pruebas insertan registros ficticios. Repetirlas no requiere limpiar la base.

Los fixtures de `packages/domain/fixtures` contienen solo datos inventados. El `total`/`records` intencionalmente no coincide con el final observado para evitar que se use como condición de corte. `visor-master.html` imita la forma descrita de `listEtiquetas`; su incrustación exacta queda pendiente de S-11.
