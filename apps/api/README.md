# API backend · desarrollo en curso

La API tiene autenticación propia, roles, usuarios, cuentas cifradas, consultas persistidas y comandos asíncronos. El worker tiene integrado un cliente HTTP para probar la conexión SOL y ejecutar inventarios, lecturas explícitas y archivos cuando sus respectivas puertas de validación estén habilitadas. El transporte para inventario productivo sigue `NO_VALIDADO` según el plan de integración. El frontend aún usa su adaptador local.

## Base local

MySQL 8 con base `buzon_sol`. Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `API_PORT` para HTTP. La API necesita `SOL_PUBLIC_KEY_PEM`, `SOL_KEY_ID` y `ACCOUNT_FINGERPRINT_KEY_B64` (32 bytes aleatorios en base64, estable entre reinicios). Solo el worker recibe la clave privada RSA correspondiente. Las claves se entregan por el mecanismo de secretos del despliegue, nunca en el repositorio.

Redis usa `REDIS_URL`. Los archivos usan `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY` y `S3_SECRET_KEY`; el bucket debe ser privado. La API entrega archivos mediante un proxy autenticado, de modo que una URL copiada pierde acceso inmediatamente después de revocar el permiso. Se verificó el SDK contra S3Mock. La imagen comunitaria de MinIO no estuvo disponible en los registros probados y AIStor sin licencia rechazó operaciones S3; falta validar un despliegue MinIO autorizado. El endpoint configurable permite conectar ese despliegue sin cambiar código.
Para documentos HTML generados, el worker conserva además los bytes originales en una clave privada con sufijo `.original`. La API solo entrega la copia saneada con descarga forzada y CSP `sandbox`.

Desde la raíz:

```sh
pnpm --filter @buzon-sol/api migration:run
pnpm --filter @buzon-sol/api migration:show
pnpm --filter @buzon-sol/api migration:revert
pnpm --filter @buzon-sol/api dev
```

`synchronize` y `migrationsRun` están desactivados. Ejecutar migraciones de forma explícita antes de iniciar la API. Las marcas internas se escriben en UTC; las fechas de SUNAT se conservan como texto original.

Crear el primer administrador con `BOOTSTRAP_EMAIL` y `BOOTSTRAP_NAME` en el entorno y una contraseña de al menos 12 caracteres enviada por stdin a `pnpm --filter @buzon-sol/api bootstrap:admin`. El comando funciona solo si aún no hay usuarios y no imprime la contraseña. Usar una fuente protegida para stdin. Se registra el alta inicial en auditoría.

## Contrato HTTP actual

Prefijo `/api/v1`. El contrato de rutas, DTOs, permisos y errores actuales está en `openapi.yaml`. `POST /auth/login` recibe `{email,password}` y devuelve un token opaco de 12 horas. Enviar `Authorization: Bearer <token>`; `POST /auth/logout` lo revoca. `GET /auth/me` consulta permisos y cuentas actuales en cada solicitud, de modo que una revocación se aplica a la sesión abierta. Los tokens se guardan solo como SHA-256 en la base. Servir la API bajo TLS; el cliente debe mantener el token fuera de almacenamiento persistente del navegador.

Administración: `GET/POST /roles`, `PATCH /roles/:id`, `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `GET/POST /admin/accounts`, `PATCH /admin/accounts/:id`, `PATCH /admin/accounts/:id/active`, `POST /admin/accounts/:id/credential`, `POST /admin/accounts/:id/connection-tests` y `GET /admin/accounts/:id/connection-tests/:testId`. Las respuestas de cuentas y pruebas nunca incluyen RUC completo, usuario SOL completo ni Clave SOL.

Buzón: `GET /accounts`, `GET /accounts/:id/mail` (consulta `offset` ≥ 0, `limit` de 1 a 200; por defecto 0 y 100), `GET /accounts/:id/summary`, `GET /accounts/:id/activity`, `POST /accounts/:id/inventory`, `POST /accounts/:id/runs/:runId/resume`, `POST /accounts/:id/items/:itemId/read` con `Idempotency-Key`, `GET /accounts/:id/items/:itemId/detail`, `PATCH /accounts/:id/items/:itemId/review` con `{ "reviewed": true|false }`, `POST /accounts/:id/files/:fileId/fetch`, `GET /accounts/:id/files/:fileId/fetches/:fetchId`, `GET /accounts/:id/files/:fileId`, `GET/PATCH /accounts/:id/schedule`. La obtención de un archivo requiere una lectura explícita completada y `SUNAT_FILE_CLIENT_READY=true` mientras exista un cliente de archivos validado. El estado `reviewed` es privado del usuario y jamás llama a SUNAT. Auditoría y avisos: `GET /audit`, `GET /audit.csv`, `GET /notices`, `POST /notices/:id/read`. Cada ruta vuelve a comprobar permiso y cuenta.

Las programaciones activas y los comandos remotos están bloqueados hasta validar el transporte SUNAT. El inventario manual requiere `SUNAT_TRANSPORT_VALIDATED=true`, la lectura `SUNAT_READ_VALIDATED=true`, la prueba de conexión `SUNAT_CONNECTION_CLIENT_READY=true` y la obtención de archivos `SUNAT_FILE_CLIENT_READY=true`. Configurar cada puerta únicamente cuando se superen las pruebas remotas correspondientes. El inventario continúa bloqueado por S-04/S-05/S-06 del [informe de fase A](../../specs/buzon-sol/sunat/phase-a-report-2026-09-30.md); lectura y archivos exigen además las pruebas de fase C. Para arrancar el worker se requiere `ENABLE_SUNAT_JOBS=true`, la configuración MySQL/Redis y `SOL_PRIVATE_KEY_PEM` para descifrar credenciales. `SUNAT_CRON_VALIDATED` debe permanecer desactivado. Nunca fijar esas variables para simular una validación en un entorno real.

La exploración autorizada usa `scripts/sunat-test-credential.ps1` para recibir la credencial con entrada oculta y guardarla cifrada con DPAPI para el usuario local. `scripts/run-sunat-probe.ps1 -Mode <modo>` acepta `connection`, `passive-check`, `relogin-check`, `logout-check`, `dependency-check`, `inventory-check`, `catalog-check`, `read-safe-check`, `files-safe-check`, `expiry-idle` o `expiry-active`; los dos últimos aceptan `-Minutes 1..180` y prueban vencimiento con inactividad o actividad. Las sondas `read-safe-check` y `files-safe-check` solo abren elementos que el listado ya presenta como leídos. Solo emiten resultados redactados. El archivo local se elimina con `scripts/sunat-test-credential.ps1 -Delete` al terminar las pruebas. No copiar credenciales al chat ni a archivos del repositorio.

El módulo `apps/worker/src/scheduler.ts` implementa una pasada del programador con vencimientos persistidos, bloqueo de cuenta y avance de horario Lima. El proceso principal ejecuta pasadas cada 30 segundos solo con `SUNAT_CRON_VALIDATED=true` y `SUNAT_TRANSPORT_VALIDATED=true`; ambas puertas siguen desactivadas hasta cumplir las pruebas remotas.

Las pruebas HTTP con MySQL real se ejecutan con `BUZON_TEST_DB=1 pnpm --filter @buzon-sol/api test:integration` y variables `DB_*` apuntando a una base de pruebas. Las del worker usan `pnpm --filter @buzon-sol/worker test:integration`; opcionalmente `BUZON_TEST_REDIS=1` y `BUZON_TEST_S3=1` ejercitan Redis y S3Mock. No ejecutar contra una base con datos reales: las pruebas insertan registros ficticios. Repetirlas no requiere limpiar la base.

Los fixtures de `packages/domain/fixtures` contienen solo datos inventados. El `total`/`records` intencionalmente no coincide con el final observado para evitar que se use como condición de corte.
