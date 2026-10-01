# Prompt de traspaso · integración SUNAT y backend de Buzón SOL · 30/09/2026

> Úsalo como encargo inicial para planificar el trabajo que sigue. Todo lo de abajo fue medido o leído en la sesión del 30/09/2026 (hora de Lima), con dos cuentas reales anonimizadas como **A** (pequeña) y **B** (grande). Lo que no se verificó está marcado como tal. No se registraron RUC, usuarios, claves, cookies, tokens, identificadores, asuntos ni cuerpos en informes o salidas; mantén esa regla.

## 1. Encargo

Lee primero, en este orden: `CLAUDE.md`, `specs/buzon-sol/README.md`, `specs/buzon-sol/plan/02-sunat-integration.md`, `specs/buzon-sol/sunat/integration-status-2026-09-30.md`, `specs/buzon-sol/sunat/phase-a-report-2026-09-30.md`, `specs/buzon-sol/sunat/contracts.md`, `specs/buzon-sol/plan/01-backend.md` y `specs/buzon-sol/plan/04-integration.md`.

Con eso, **produce un plan de desarrollo** (no implementes todavía) para completar: (a) lo pendiente de la integración SUNAT, (b) lo pendiente del backend, (c) la activación controlada de las puertas y (d) la conexión con el frontend. Ordénalo por dependencias y riesgos, con criterios de cierre verificables.

## 2. Reglas que no se rompen

- **Inventariar ≠ leer.** Listar no cambia estado en SUNAT. Abrir el detalle (`obtenerDetalleNotiMen`) marca como leído un no leído (0→1) y es irreversible. Solo por comando explícito, registrando antes la intención y con autorización del usuario. En esta sesión el asistente fue bloqueado al escribir la sonda que lo hace hasta que el usuario lo autorizó en el chat.
- Aislamiento por cuenta: cookie jar, sesión y archivos nunca se cruzan; toda consulta lleva `account_id`.
- Secretos solo por los scripts autorizados (`scripts/run-sunat-probe.ps1`, `scripts/probe-sunat-login.ps1 -SavedCredential`). No descifrar la credencial fuera de ellos; el sistema bloqueó un intento de hacerlo.
- No afirmar en código, UI ni logs capacidades no comprobadas. HTML de login/error donde se espera JSON/PDF es error de sesión, nunca «buzón vacío».
- Gestor de paquetes: pnpm. Comandos desde la raíz: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.

## 3. Estado de las pruebas S-01–S-20 (matriz al cierre de la sesión)

| ID | Estado | Evidencia medida |
|---|---|---|
| S-01 Enlace/formulario | pasa | Portada, parámetros y POST observados. |
| S-02 Login desatendido | pasa | Node.js inicia sesión sin navegador y abre ambas bandejas, en A y B. |
| S-03 Dependencias | pasa en A | Sin cookies el listado devuelve `rows:null` y el PDF HTTP 500. La única cookie necesaria del visor es `ITVISORNOTISESSION`. Quitar `X-Ruc`, XHR o Referer por separado no impidió el acceso. |
| S-04 Arranque pasivo | pasa en B | 3684 sin leer; dos barridos completos con login nuevo: 0 cambiados, 0 desaparecidos. El adaptador no ejecuta el JavaScript del visor (la web abre el primer ítem). No se probó con el visor abierto en un navegador. |
| S-05 Vencimiento | pasa (política definida) | En A, 35 min inactiva: venció (1 respuesta de sesión vencida) y el reingreso funcionó. Con un listado por minuto: sin vencimiento en 35 min. No se midió el minuto exacto. |
| S-06 Salida | pasa con ventana de gracia | Ver §4. Tras la secuencia completa el mismo jar sigue accesible 14 s y pierde acceso a los 20 s (3 ejecuciones en B). |
| S-07 Listados | pasa en A y B | |
| S-08 Paginación | pasa en A y B | A: 10/5 filas. B: 5911 Mensajes en 237 páginas (vacía en la 238, confirmada) y 394 Notificaciones en 16 (vacía en la 17); luego 5913 Mensajes por correo nuevo. Sin duplicados. |
| S-09 Búsqueda/estados | pasa en A | `des_asunto` redujo Mensajes de 10 a 4; texto sin coincidencias → 0. `tipoOrden=LEIDOS`/`NO_LEIDOS` devuelven todas las filas (no son filtros exclusivos). No probado en B. |
| S-10 Carpetas | parcial | A: arreglo vacío. B: `listarCarpetas` devolvió 2 carpetas (solo conteo; no se probó su contenido). |
| S-11 Etiquetas | pasa en A y B | 10 etiquetas extraídas del HTML sin ejecutar JavaScript. La consulta por `codEtiqueta` (con `tipoMsj` y `codCarpeta` vacíos) mezcla ambas bandejas. `cantEtiqueta` no es fiable (casi todas 0; una declaró 539 y devolvió 743). |
| S-12 Alertas | pasa en A y B | Listas vacías; falta caso no vacío. |
| S-13 Detalle leído | pasa en A y B | `updateLeido=false`, estado sin cambio; `indTexto` 1 y 3 válidos. |
| S-14 Efecto de leer | pasa en B | Un Mensaje sin leer (el más antiguo): `updateLeido=true`; `indEstado` 0→1 visible en la segunda consulta (~10 s después); confirmado desde sesión nueva; segunda lectura `updateLeido=false`. Notificaciones sin leer: no probado (B tiene 0 sin leer). |
| S-15 Adjuntos | pasa en A y B (PDF) | PDF con `codArchivo=0` y con código numérico: HTTP 200, MIME PDF, cabecera `%PDF-`, nombre de archivo, SHA-256 en memoria. |
| S-16 Documento generado | pasa en A y B | HTTP 200, `text/html`, verificado. |
| S-17 Aislamiento | pasa | A y B abiertas a la vez, 3 rondas: huella estable por cuenta y distinta entre ellas. Dos sesiones de la misma cuenta son independientes (cerrar una no afecta a otra ni a una abierta justo después). |
| S-18 Reintentos | parcial | Fixtures y pruebas MySQL; falta un fallo remoto real. |
| S-19 Ritmo/capacidad | parcial | A: login 1,9 s, listado ~90 ms, detalle 183 ms medio, archivo 314 ms medio. B: login 0,7 s, listado 151–1066 ms (medio 609), detalle 98–697 ms (medio 388), archivo 653–1210 ms (medio 867). Barrido de B: 247 s Mensajes + 26 s Notificaciones; en el E2E 221 s. Sin errores. No se probó concurrencia alta ni límite de SUNAT. |
| S-20 Compatibilidad | parcial | Esquema de filas (nombres y tipos): 20 campos idénticos en A y B; `codDepen` puede ser `null`; `codCarpeta` y `numRuc` nulos. Falta comparar en otra fecha. |

## 4. Hechos nuevos del contrato SUNAT (ya en `contracts.md` §4)

- **Login HTTP:** portada → `loginMenuSol` (conservar `originalUrl` y `state`) → `POST j_security_check` con `tipo=2`, `custom_ruc`, `j_username`, `j_password`, `captcha`, `lang`, `originalUrl`, `state` → menú `MenuInternet.htm?exe=buzon` → `POST action=prevApp` → `GET MenuInternet.htm?action=buzon&s=ww1` → redirección a `/ol-ti-itvisornoti/visor/master?hc&token`. Hace falta el `User-Agent` observado (con otro, la cuenta no quedó autenticada). Antes de pasar por el visor, el listado responde `rows:null`.
- **Credencial rechazada:** el POST de login redirige a `.../oauth2/error`. El adaptador lo clasifica `invalid_credential`.
- **Cierre remoto real (S-06):** `POST action=prevApp` responde texto plano con la ruta `/ol-ti-itvisornoti/visor/master?logout`. El menú la pasa a `GET https://ww1.sunat.gob.pe/time/gettime.pl?a=o&l={randomCookie}&u={ruta}`; esa página HTML ejecuta `POST {ruta}` con cuerpo `logout` (XHR, `application/x-www-form-urlencoded`); después `POST action=salir`. `prevApp`+`salir` solos, o `GET …master?logout` solo, no invalidan el visor (accesible 40 min con actividad). `randomCookie` es un número generado por el navegador (prefijo de la cookie `…BOT20260`).
- **Etiquetas:** consulta por `codEtiqueta` con `tipoMsj` y `codCarpeta` vacíos mezcla Mensajes y Notificaciones.
- **Lectura con retraso:** tras `obtenerDetalleNotiMen` el cambio de estado puede tardar en verse en el listado (~10 s observado).

## 5. Código implementado en la sesión

- `packages/sunat-adapter`: `SunatHttpSession.close()` ejecuta el cierre remoto completo; `listPage(box, page, filter?)` con `ListFilter {desAsunto, tipoOrden, codEtiqueta}`; `parseInventoryPage(response, box | "any")`; error `invalid_credential` si el login termina en `/error`; extracción de etiquetas (`listLabels`), carpetas (`listFolders`), alertas (`consultAlerts`), detalle (`readDetail`), `observeState`, descarga (`fetchAttachment`, `fetchGeneratedDocument`) con nombre de `Content-Disposition`.
- Pruebas del adaptador: 13 al cierre (incluye filtros remotos, bandeja `any`, credencial rechazada y el orden `prevApp` → `gettime.pl` → POST `logout` → `salir`).
- Scripts: `scripts/probe-sunat-adapter.ts` (modos `connection`, `passive-check`, `relogin-check`, `logout-check`, `dependency-check`, `inventory-check`, `catalog-check`, `read-safe-check`, `files-safe-check`, `login-diagnose`, `search-check`, `label-check`, `schema-check`, `capacity-check`, `logout-lifetime`, `logout-delay`, `logout-cookies`, `logout-diagnose`, `master-logout-js`, `collision-check`, `isolation-check`, `read-unread-check`, `expiry-idle`, `expiry-active`), `scripts/run-sunat-probe.ps1` (`-Mode`, `-Minutes`, `-Names A,B`), `scripts/sunat-test-credential.ps1` (`-Name`, `-Delete`, `-All`) y `scripts/e2e-persist.ts`.
- Nota: `read-unread-check` abre un Mensaje real sin leer; no ejecutarlo sin autorización expresa.

## 6. Estado del backend

- Existen `apps/api`, `apps/worker`, `packages/domain`, `packages/storage`, `packages/sunat-adapter`. Rutas API presentes: identidad/roles/usuarios, cuentas y credencial, pruebas de conexión, programación, correo, lectura, archivos, inventario/reanudación, actividad, resumen, auditoría (JSON y CSV) y avisos.
- Pruebas medidas durante la sesión: dominio 4, adaptador 13, worker unitarias 5, web 51; integración (con MySQL 8.4, Redis y S3 de `compose.test.yml`, `BUZON_TEST_DB=1 BUZON_TEST_REDIS=1 BUZON_TEST_S3=1`): API 1 y worker 11. `pnpm test` no ejecuta las de integración; usar `pnpm --filter @buzon-sol/api test:integration` y `pnpm --filter @buzon-sol/worker test:integration`. Typecheck del monorepo sin errores en esos momentos.
- **E2E de persistencia (real, A y B en paralelo):** `scripts/run-sunat-probe.ps1 -Mode e2e-persist -Names A,B`. Cifra cuenta y credencial, el worker descifra, abre sesión por cuenta y persiste con `InventoryRunner`. A: 10 Mensajes y 5 Notificaciones (1 s). B: 5913 Mensajes (3684 sin leer) y 394 Notificaciones, 255 páginas, 221 s. Segunda pasada con los mismos conteos y sin duplicados; 0 filas huérfanas. **Alcance:** llama a los casos de uso directamente; no pasó por el API HTTP, BullMQ ni las puertas de entorno.
- Multi-cuenta: cada cuenta es una fila de `sunat_accounts` con credencial versionada, programación única (`sync_schedules.account_id` UNIQUE), correos y archivos filtrados por `account_id`. Control por cuenta existente: `sunat_accounts.active`, `sync_schedules.state` y `remote_effect_accepted`, `sunat_credentials.status`, `role_sunat_accounts` + `role_permissions`. Probado con 2 cuentas; no con muchas.

## 7. Puertas de activación (variables de entorno globales del despliegue)

| Variable | Habilita | Dependencias |
|---|---|---|
| `ENABLE_SUNAT_JOBS` | Que el worker arranque | — |
| `SUNAT_CONNECTION_CLIENT_READY` | Prueba de conexión de una cuenta | — |
| `SUNAT_TRANSPORT_VALIDATED` | Inventario | — |
| `SUNAT_READ_VALIDATED` | Abrir detalle (puede marcar leído) | requiere transporte |
| `SUNAT_FILE_CLIENT_READY` | Descargas | requiere lectura y transporte |
| `SUNAT_CRON_VALIDATED` | Programador automático | requiere transporte |

Siguen apagadas por defecto (solo valen con `"true"` explícito). No se activaron en esta sesión. También se requieren `SOL_PUBLIC_KEY_PEM` y `SOL_KEY_ID` (API), `SOL_PRIVATE_KEY_PEM` (worker), `ACCOUNT_FINGERPRINT_KEY_B64`, MySQL, Redis y S3. **No existe** hoy un interruptor por cuenta para «lectura permitida» o «descarga permitida»; solo el permiso de rol y la variable global.

## 8. Política de sesiones definida

Una sesión por ejecución, cerrada con el cierre remoto completo y sin guardar el jar; un reingreso por sesión (si falla, `remote_session_expired`); credencial rechazada → pausa inmediata sin reintento; tres fallos seguidos → pausa de la cuenta; una ejecución a la vez por cuenta (bloqueo MySQL) y `codArchivo=0` en serie por cuenta; sin espera obligatoria entre cierre y nuevo login (sesiones independientes); la sesión anterior puede seguir válida hasta ~20 s tras cerrar.

## 9. Pendiente y huecos conocidos

- Ejecutar API y worker como **procesos reales** con las puertas activadas y lanzar un inventario por HTTP (hoy solo probado vía casos de uso).
- Decidir y, si se quiere, implementar interruptores por cuenta (lectura/descarga).
- Carpetas, etiquetas y alertas: el adaptador las consulta, pero el API y el worker no las persisten ni exponen. La búsqueda por asunto tampoco está conectada.
- S-18 (fallo remoto real), S-19 (concurrencia y sesión larga), S-20 (muestras en otra fecha), S-09 en B, contenido de carpetas (S-10), alertas no vacías, lectura de una Notificación sin leer, minuto exacto de vencimiento por inactividad.
- Decidir cuándo activar `SUNAT_CRON_VALIDATED`.
- Límites de SUNAT: no se midió ni se asume ninguno.
- Datos y secretos locales: MySQL del contenedor `sunat-mysql-1` contiene asuntos y filas reales de A y B; `%LOCALAPPDATA%\BuzonSol\dev-worker-keys.json` guarda la clave de desarrollo; siguen guardadas las credenciales de prueba (sin nombre, `A`, `B`). Borrar con `pwsh -NoProfile -File scripts/sunat-test-credential.ps1 -Delete -All` al terminar.
- Un nombre de cookie con una cifra de 11 dígitos apareció en una salida de diagnóstico; corresponde al número aleatorio del navegador, pero no se pudo confirmar que no coincida con un RUC. Las sondas ahora enmascaran dígitos largos en nombres de cookie.

## 10. Trabajo ajeno a esta sesión, observado y **no revisado**

Al final de la sesión el repositorio mostraba cambios que no hizo este asistente: commits `3cfafdf` y `ffab712`; `specs/buzon-sol/plan/04-integration.md` (INT-1 Gestión: sesión, usuarios, roles, cuentas, credencial, programador y auditoría conectados; INT-2 Buzón pendiente); `apps/web/src/adapters/http/`; cambios en `apps/api` (`accounts.ts`, `auth.ts`, `controllers.ts`, `identity.ts`, `operations.ts`, `openapi.yaml`); migraciones `0008-MailListing` y `0009-CatalogsAndNotices`; `envelopeKeyId` en `packages/domain/src/secrets.ts`; `compose.dev.yml` y `scripts/dev-env.mjs`. Antes de planificar, revisa `git log`, `git status` y el plan de integración para no duplicar ni contradecir ese trabajo, y vuelve a correr `pnpm typecheck` y `pnpm test` porque las cifras de §6 son de antes de esos cambios.

## 11. Formato esperado del plan

Hitos con dependencias, criterio de cierre medible, riesgos y qué requiere decisión del usuario. Separa lo que puede hacerse sin SUNAT (fixtures, API, worker, frontend) de lo que exige cuentas reales, y marca cualquier paso que modifique el estado de una cuenta real (leer un no leído) como requiere autorización expresa.
