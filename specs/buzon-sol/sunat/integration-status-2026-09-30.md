# Estado de integración SUNAT · 30/09/2026

**Cuenta real probada:** A, con resultados redactados. **Transporte:** HTTP directo. **Decisión actual:** `NO_VALIDADO` (S-06, S-14 y S-17 pasan; las cuatro puertas siguen apagadas hasta que el operador las active) para inventario y cron productivos. El login y la prueba de conexión HTTP funcionaron repetidamente desde sesiones nuevas. La credencial temporal local está cargada para completar las sondas y se eliminará al terminar.

| Prueba | Estado | Evidencia actual o trabajo faltante |
|---|---|---|
| S-01 Enlace/formulario | pasa | Portada, parámetros originales y POST observados. |
| S-02 Login desatendido | pasa | Node.js abrió el visor y ambas bandejas dos veces desde jars nuevos. |
| S-03 Dependencias | pasa en A | Listado y PDF funcionan con cookie jar; sin cookies devuelven `rows:null` y HTTP 500, respectivamente. Omitir `X-Ruc`, XHR o Referer por separado no impidió el acceso. El visor sigue siendo paso necesario antes del listado. |
| S-04 Arranque pasivo | pasa en B, no probado con el visor abierto en navegador | Cuenta B: 3684 Mensajes/Notificaciones sin leer; dos barridos completos con login nuevo no cambiaron ninguno (0 cambiados, 0 desaparecidos). El adaptador nunca abre detalle ni ejecuta el JavaScript del visor que abre el primer ítem en la web. |
| S-05 Vencimiento/reingreso | pasa (política definida) | Medición real en A, sesión aislada, 35 min: inactiva, venció antes del final y el reingreso con login nuevo funcionó; con un listado por minuto no hubo vencimiento. Barridos completos de B (≈4,5 min) sin vencimiento. No se midió el minuto exacto de vencimiento: la política no depende de él (un reingreso por sesión). |
| S-06 Salida | pasa con ventana de gracia | Secuencia completa de salida del menú (`prevApp` → `gettime.pl` → `POST …master?logout` con `logout` → `salir`): el mismo jar siguió accesible 14 s y perdió acceso a los 20 s (3 ejecuciones en B). Con solo `prevApp`/`salir` el visor seguía accesible 40 min: el cierre real requiere la secuencia completa. Detalle en contracts.md §4. |
| S-07 Listados | pasa en A | Ambas bandejas devolvieron filas autenticadas y el parser aceptó los tipos observados. Falta segunda cuenta. |
| S-08 Paginación | pasa en A y B | A: 10/5 filas. B (grande): 5911 Mensajes en 237 páginas (vacía en la 238, confirmada) y 394 Notificaciones en 16 páginas (vacía en la 17); sin duplicados. Fixtures 3328/227 y checkpoint MySQL pasan. |
| S-09 Búsqueda/estados | pasa en A | `des_asunto` redujo Mensajes de 10 a 4 filas (subconjunto del inventario) y un texto sin coincidencias dio 0. `tipoOrden=LEIDOS` y `NO_LEIDOS` devolvieron todas las filas, no son filtros exclusivos; el estado se filtra localmente. Sin fecha remota. |
| S-10 Carpetas | parcial | En A, catálogo HTTP autenticado respondió arreglo vacío válido; falta cuenta con carpetas. |
| S-11 Etiquetas | pasa en A y B | 10 etiquetas extraídas sin ejecutar JavaScript en ambas. La consulta por `codEtiqueta` (con `tipoMsj` y `codCarpeta` vacíos) devolvió filas reales; en B hubo etiquetas con 64, 60, 15, 9, 6 Notificaciones y una con 743 Mensajes. **Mezcla bandejas** (`"any"`) y los conteos del catálogo no son fiables: `cantEtiqueta` vale 0 en casi todas y una declaró 539 frente a 743 devueltas. |
| S-12 Alertas | pasa en A | Consulta HTTP autenticada devolvió `listaAlertas=[]`; falta caso no vacío. |
| S-13 Detalle leído | pasa en A | Un Mensaje ya leído (`indTexto=1`) y una Notificación ya leída (`indTexto=3`, JSON anidado válido) respondieron `updateLeido=false`; el estado del listado no cambió. |
| S-14 Efecto de leer | pasa en B | Autorizado por el usuario. Un Mensaje sin leer (el más antiguo de B): `updateLeido=true`, `indEstado` 0→1 visible en la segunda consulta (~10 s después), confirmado desde una sesión nueva; segunda lectura `updateLeido=false`. Un solo ítem afectado. Notificaciones no probadas (efecto no observado). |
| S-15 Adjuntos | pasa en A y B para PDF | A y B: PDF con `codArchivo=0` y con código numérico, HTTP 200, MIME PDF, cabecera `%PDF-`, nombre de archivo extraído, SHA-256 en memoria (88 627 y 87 768 bytes en B). |
| S-16 Documento generado | pasa en A y B | HTTP 200, `text/html`, verificado (5 979 y 18 430 bytes en B); no se registró la URL ni el contenido. |
| S-17 Aislamiento | pasa con dos cuentas reales | `isolation-check` con A y B abiertas a la vez: 3 rondas paralelas; la huella (ids, estados y totales, sin valores) de cada cuenta fue estable y distinta de la otra. `collision-check` en B: dos sesiones de la misma cuenta son independientes (cerrar una no afecta a la otra ni a una abierta justo después). |
| S-18 Reintentos/idempotencia | parcial | Fixtures y pruebas MySQL pasan; falta fallo remoto real de página/media sesión. |
| S-19 Ritmo/capacidad | parcial | A: login 1,9 s, listado ~90 ms, detalle 183 ms, archivo 314 ms. B (grande): login 0,7 s, listado 151–1066 ms (media 609), detalle 98–697 ms (media 388), archivo 653–1210 ms (media 867); barrido completo 247 s (Mensajes) + 26 s (Notificaciones), sin errores ni pausas. No es un límite oficial; falta carga concurrente y sesión larga en B. |
| S-20 Compatibilidad | parcial | Esquema de filas (solo nombres/tipos) con 20 campos idénticos en A y B; `codDepen` puede ser `null` (B). Parser rechaza HTML, `rows:null`, tipos inválidos y bandeja cruzada; las credenciales rechazadas terminan en `/oauth2/error` y se clasifican `invalid_credential`. Falta comparación en otra fecha. |

## Puertas de activación

- **Prueba de conexión:** cliente y worker implementados; su activación requiere configuración MySQL, Redis y claves de la instalación.
- **Inventario manual:** bloqueado por S-04/S-06 y por pruebas remotas de aislamiento.
- **Lectura/archivos:** código detrás de puertas independientes; S-13/S-15/S-16 pasan en A, pero la puerta A y S-14 siguen pendientes.
- **Cron:** conectado en el worker; bloqueado por S-05 y la puerta de inventario.

Las sondas redactadas `scripts/run-sunat-probe.ps1 -Mode passive-check|relogin-check|logout-check|inventory-check|catalog-check|read-safe-check|files-safe-check|search-check|label-check|schema-check|capacity-check|logout-lifetime|expiry-idle|expiry-active` están listas. La de lectura solo abre un elemento ya marcado como leído por bandeja. No imprimen RUC, identificadores de mensajes, asuntos, cookies ni tokens. El [informe de fase A](phase-a-report-2026-09-30.md) contiene la secuencia HTTP y el detalle del cierre fallido.

## Política de sesiones controladas (S-05, S-06 y colisiones)

- **Medido:** inactiva, la sesión venció antes de 35 min; con actividad no venció en 35 min. La salida real exige la secuencia completa (ver S-06) y se aplica en ≤20 s. Dos sesiones de la misma cuenta son independientes.
- **Una sesión por ejecución:** se abre al empezar un barrido, lectura o descarga y se cierra al terminar o fallar con `close()`, que ejecuta el cierre remoto completo y descarta el jar local. Nunca se guarda el jar ni se reutiliza entre ejecuciones.
- **Sin colisiones:** el worker serializa una ejecución a la vez por cuenta (bloqueo existente) y `codArchivo=0` va secuencial por cuenta. Como las sesiones no se pisan entre sí, no se impone espera entre cierre y nuevo login; aun así, tras cerrar, la sesión anterior puede seguir válida hasta 20 s.
- **Reingreso acotado:** una respuesta HTML o `rows:null` provoca un solo login nuevo por sesión; si falla, `remote_session_expired`.
- **Bloqueos:** credencial rechazada (`/oauth2/error`) → `invalid_credential`, pausa inmediata y sin reintento; tres fallos seguidos → pausa de la cuenta (`repeated_failures`); nunca se reintenta un login en bucle.
- **Ritmo:** peticiones secuenciales por cuenta (barrido de 5911 filas en ~4 min sin errores). No se asume un límite oficial.

## Backend (30/09/2026)

- Suites locales: dominio 4, adaptador 12, worker 5, web 51 y typecheck del monorepo sin errores.
- Integración con MySQL 8.4, Redis y S3 de `compose.test.yml` (`BUZON_TEST_DB=1`, `BUZON_TEST_REDIS=1`, `BUZON_TEST_S3=1`): API 1/1 y worker 11/11, incluidos checkpoint sin duplicados, `codArchivo=0` serializado, MIME inválido sin guardar, lectura explícita sin repetir la llamada remota, permisos revocados antes de la llamada remota y programador con hora de Lima. `pnpm test` no las ejecuta; requieren `pnpm --filter @buzon-sol/api test:integration` y `pnpm --filter @buzon-sol/worker test:integration`.
- Rutas BE-0–BE-6 presentes: identidad/roles, cuentas y credencial, pruebas de conexión, programación, correo, lectura, archivos, inventario/reanudación, actividad, resumen, auditoría (JSON y CSV) y avisos.
- **No implementado:** persistencia y exposición de carpetas, etiquetas y alertas (el adaptador las consulta, el API y el worker no las usan); la búsqueda remota por asunto tampoco está conectada al API.
- **S-14:** ejecutado en B con autorización del usuario (ver matriz).

## E2E de persistencia con dos cuentas reales (30/09/2026)

`pwsh -NoProfile -File scripts/run-sunat-probe.ps1 -Mode e2e-persist -Names A,B` (driver `scripts/e2e-persist.ts`, solo MySQL local de `compose.test.yml`): crea las cuentas con RUC, usuario y clave cifrados (misma envoltura y huella que el API), el worker descifra con la clave privada local, abre una sesión SUNAT por cuenta **en paralelo** y persiste con `InventoryRunner`.

- Cuenta A: 10 Mensajes y 5 Notificaciones; ejecución completa en 1 s.
- Cuenta B: 5913 Mensajes (3684 sin leer) y 394 Notificaciones en 255 páginas, 221 s; página vacía confirmada.
- Segunda pasada de ambas: mismos conteos, sin duplicados (`distinct` = filas); cero filas huérfanas entre cuentas.
- **Alcance:** llama directamente a los casos de uso del worker y no pasa por HTTP del API, BullMQ ni las puertas de entorno. Falta ejecutar el API y el worker como procesos con las puertas activadas.
- La clave de desarrollo local queda en `%LOCALAPPDATA%\BuzonSol\dev-worker-keys.json` (sin ella no se descifrarían las credenciales guardadas en MySQL). Los datos reales, incluidos asuntos, quedan en el volumen MySQL local.
