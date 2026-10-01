# Plan de desarrollo · Worker por capacidades y capas

**Estado:** implementado (W-0 a W-5); evidencia y límites en «Seguimiento de avance». **Alcance:** `apps/worker` y las pruebas y documentos necesarios para demostrar sus contratos; no reabre BE-8 ni sustituye su [seguimiento](01-backend.md#seguimiento-de-avance). La [guía de BE-8](05-backend-architecture-refactor-prompt.md), especialmente §5.1, §7, §8D y §9, fija las invariantes de esta evolución. BE-8 permanece como hito histórico implementado; este plan registra el trabajo posterior.

## Objetivo

Hacer explícito, para cada familia de trabajo, dónde se recibe el job, se valida su intención duradera y la autorización vigente, se toma el bloqueo por cuenta, se abre la sesión, se ejecuta el efecto externo y se confirma o recupera el resultado. Separar SQL complejo y repetido de la coordinación sin crear una capa o un módulo por tabla. Conexión, inventario, lectura, archivo, archivos, programación y recuperación son las capacidades; `mail_items`, `sync_runs` y otras tablas son datos de esos flujos, no fronteras arquitectónicas por sí mismas.

### Contrato que debe conservarse

- API y worker siguen como procesos separados; el worker no llama a la API por HTTP ni adopta NestJS por simetría. No cambian rutas, cuerpos, códigos de error, nombres de cola/job, esquema, IDs, política de intentos, límites de lote o semántica de `codArchivo=0` salvo defecto demostrado y documentado.
- Puertas `SUNAT_*` apagadas por defecto y activadas solo por el operador tras sus pruebas S-xx. Este plan se verifica con clientes de prueba; **no** usa credenciales reales, no contacta SUNAT y no fija puertas para simular validación remota.
- Inventariar no abre detalle. La lectura explícita deja intención durable antes de `readDetail`; una llamada incierta no se repite automáticamente. El archivo solo abre ítems listados como leídos, registra intención antes de cada apertura y se detiene y desactiva si cualquier detalle informa `updateLeido=true`.
- Cuenta y permiso se vuelven a comprobar al ejecutar. La exclusión por cuenta protege la apertura de sesión y todos los efectos posteriores; una sesión/cookie jar nunca sirve a otra cuenta. La revisión local nunca se envía a SUNAT.
- Estado y auditoría que describen una sola acción se confirman en la misma transacción MySQL. Ninguna transacción MySQL permanece abierta durante Redis, SUNAT o S3. Se documentan las ventanas entre dependencias sin afirmar atomicidad distribuida.
- Secretos, cookies, RUC completo, asuntos, cuerpos y URLs sensibles no entran a logs, auditoría ni fixtures. `packages/domain` sigue libre de infraestructura; no introducir interfaces de una sola implementación ni repositorios base.

## Arquitectura objetivo

Cada capacidad conserva únicamente las piezas que necesita. Los nombres finales pueden variar si el mapa de dependencias muestra una división más simple.

| Pieza | Responsabilidad | Ejemplo de ubicación |
|---|---|---|
| Cola/entrada | Decodificar job, invocar caso de uso, aplicar opciones BullMQ y cerrar conexiones propias; sin decisiones de dominio. | `src/inventory/queue.ts` |
| Caso de uso | Validar puerta, cuenta, actor/permiso y estado; adquirir bloqueo; confirmar intención; abrir/cerrar cliente; coordinar pasos y política de error. | `src/inventory/run.ts` |
| Persistencia del flujo | Consultas de elegibilidad y aislamiento, transacciones, checkpoint, estados y auditoría de ese flujo. Funciones pequeñas que aceptan `DataSource` o `EntityManager` según el límite transaccional. | `src/inventory/store.ts` |
| Adaptador externo | Protocolo SUNAT en `packages/sunat-adapter`; objetos en `packages/storage`; nombres y opciones de cola en una frontera BullMQ. | paquetes existentes y `src/*/queue.ts` |
| Infraestructura compartida | Bloqueo por cuenta, credenciales, configuración, bucle y logging ya usados por varias capacidades. | `src/shared/` o ubicación actual si mover solo añade ruido |

La dependencia va de entrada → caso de uso → funciones de persistencia/adaptadores. Un adaptador SUNAT no consulta MySQL ni decide permisos. Un `store` no llama SUNAT, Redis o S3. No es obligatorio crear cuatro archivos por familia: conexión y lectura pueden permanecer compactas si el recorrido queda visible. Antes de mover carpetas, decidir qué funciones de `inventory.ts` y `archive.ts` se extraen por una regla concreta, no por número de líneas.

### Mapa inicial de migración

| Capacidad | Archivos actuales | Extracción o ajuste propuesto |
|---|---|---|
| Conexión | `connection-queue.ts`, `connection.ts`, `credentials.ts` | Conservar procesador; localizar en funciones de persistencia las consultas de prueba/versión/actor y la transacción de resultado solo si aclara el flujo. |
| Inventario | `queue.ts`, `inventory.ts`, `read-attachments.ts` | Dejar barrido, reautenticación y coordinación en el caso de uso; extraer persistencia de página/checkpoint, catálogos y reglas de fallos/avisos. Mantener `scanBox` en el adaptador SUNAT. |
| Lectura | `read-queue.ts`, `reading.ts`, `detail-store.ts` | Crear el cliente dentro del bloqueo y tras revalidar; conservar `pending → calling → complete/uncertain/denied` y la transacción de detalle/estado. |
| Archivo | `archive-queue.ts`, `archive.ts` | Separar planificación/recuperación, selección de candidatos y persistencia de resultados de la coordinación del lote. Mantener una sesión por lote y la lógica de archivos inmediatamente después del detalle. |
| Archivos | `file-queue.ts`, `file-fetch.ts`, `files.ts`, `sunat-file-client.ts` | Abrir sesión dentro del bloqueo tras autorización; mantener validación de firma y `storeFile`; hacer explícito S3 → MySQL y el tratamiento de objetos huérfanos. |
| Programación | `scheduler.ts`, bucle en `main.ts` | Mantener pasada sin sesión SUNAT; separar selección/transacción de cuenta si mejora la lectura. Conservar cálculo Lima y compensación de fallo Redis. |
| Recuperación | `recovery.ts`, recuperación de archivo en `archive.ts`, bucle en `main.ts` | Agrupar políticas por tipo de intención y hacer visible qué estados se reencolan, se marcan `partial` o quedan `uncertain`. |

## Etapas de implementación

Las etapas son secuenciales. Cada una termina con cambios revisables, pruebas pertinentes y una nota de cualquier comportamiento que no pudo verificarse. Marcar `[x]` solo después de registrar evidencia; no ejecutar integración sobre `buzon_sol` de `compose.test.yml`, que puede contener datos reales. Usar `buzon_it` vacía u otra base aislada.

### W-0 Línea base y decisiones de estado

- [x] Registrar `git status`, mapa job → cola → caso de uso → SQL/SUNAT/S3 y dependencias por familia. Identificar cambios ajenos antes de editar.
- [x] Registrar comandos, entorno y resultados de `pnpm typecheck`, `pnpm lint`, unitarias e integración local sobre base aislada; distinguir el fallo preexistente de `inventory-features.test.ts` de fallos nuevos.
- [x] Crear una tabla de transición por `sync_runs`, `archive_runs`, `mail_read_events`, `file_fetches` y `connection_tests`: estado previo, punto de efecto remoto, caída posible, repetibilidad, estado final y forma de recuperación. Preservar `uncertain` cuando la llamada de lectura pudo ocurrir.
- [x] Decidir y documentar el alcance de la recuperación de `pending` de lectura, conexión y archivos. El código actual recupera automáticamente solo inventario y archivo; si se amplía, exigir una prueba de caída en cada borde y conservar los límites de intentos. No presentar un job perdido como recuperado sin esa implementación.

**Cierre:** línea base reproducible y matriz de estados aprobada como referencia técnica antes de mover el primer flujo.

### W-1 Frontera de ejecución y ciclo de vida

- [x] Mover la apertura de sesión de `queue.ts` y `read-queue.ts` al interior del bloqueo y después de revalidar job, cuenta, estado, actor/permiso y puerta. Aplicar el mismo orden a `file-fetch.ts`; conservar conexión y archivo donde ya toman primero el bloqueo. Verificar que un job terminal, revocado, de otra cuenta o con bloqueo ocupado no invoca la factoría de sesión.
- [x] Establecer un contrato pequeño para recibir la factoría de cliente cuando el caso de uso la necesite; no crear una jerarquía general de procesadores. El caso de uso debe cerrar la sesión en `finally`, incluso si falla MySQL, SUNAT o S3 después de abrirla.
- [x] Cubrir con cierre ordenado desde la primera adquisición de recurso en `main.ts`: MySQL, colas, consumidores y timers. Detener entrada periódica, esperar pasada en curso, cerrar consumidores, colas y MySQL; registrar fallos de cierre sin filtrar detalles. Evitar que un fallo de arranque anterior al `try` deje recursos abiertos.
- [x] Probar arranque fallido y `SIGTERM` con MySQL/Redis de prueba, clientes SUNAT inyectados que no usan red y un job en curso; verificar que no se aceptan más jobs y que se liberan conexiones y bloqueo. Si BullMQ no permite aislar el proceso de prueba de esta forma, registrar una verificación local reproducible equivalente.

**Cierre:** ninguna apertura de sesión antecede al bloqueo y a la revalidación; cierre completo demostrado sin SUNAT real.

### W-2 Inventario y programación

- [x] Extraer de `inventory.ts` las transacciones de página, deduplicación, checkpoint y aviso de nuevos ítems como funciones del flujo. Conservar el barrido y la reautenticación acotada en un caso de uso legible; no abrir detalle desde él.
- [x] Localizar la sustitución de catálogos y el registro de fallos por cuenta. Diferenciar fallo remoto opcional de fallo MySQL: una consulta de catálogo fallida puede marcar `unavailable`; un fallo al persistir no debe disfrazarse de fallo SUNAT ni vaciar un catálogo válido.
- [x] Mantener `scheduler.ts` como pasada sin sesión remota. Hacer explícitos la transacción de cuenta/horario, creación del `sync_run`, emisión posterior a Redis y pausa/aviso si falla la cola. Mover SQL solo si la nueva frontera ayuda a probar aislamiento o transacción.
- [x] Verificar checkpoint, reanudación sin duplicados, paginación hasta vacío confirmado, 0 detalles en inventario, catálogos ante respuesta inválida, horario Lima y cola caída.

**Cierre:** el estado de una página y su checkpoint son atómicos; la planificación sigue produciendo una sola ejecución por cuenta.

### W-3 Lectura, archivos y almacenamiento

- [x] Mantener `mail_read_events` y auditoría confirmados antes del efecto remoto; `calling` se confirma antes de `readDetail`. Revalidar cuenta activa y permiso tras tomar el bloqueo. Ante fallo posterior al detalle, preservar `uncertain` y no reabrir automáticamente.
- [x] En descargas manuales y P-03, comprobar actor o configuración del sistema y estado remoto leído/detalle guardado bajo el bloqueo antes de abrir sesión. Conservar el detalle necesario para resolver el archivo en la misma sesión y la serialización de `codArchivo=0`.
- [x] Mantener validación MIME/firma/tamaño antes de S3 y marcar `stored` solo después de `put`. Documentar y probar los bordes S3 correcto/MySQL caído y `.original` guardado/copia saneada fallida: estado local, posible objeto sin referencia y método de limpieza o reconciliación, sin prometer transacción S3–MySQL.
- [x] Probar permiso revocado, cuenta desactivada, opción P-03 desactivada, archivo ambiguo, HTML/PDF falso, S3 caído y cierre de sesión en cada fallo.

**Cierre:** ningún job no autorizado inicia sesión o abre detalle; lectura incierta no se repite; un archivo inválido nunca queda `stored`.

### W-4 Archivo por cuenta

- [x] Separar de `archive.ts` la selección de pendientes, el control de lote/reintentos y las transacciones de evento, resultado y parada, conservando `ArchiveProcessor` como coordinador de una sesión y un lote. Consultas de candidatos y archivos mantienen `account_id` y `ind_estado<>0`.
- [x] Aplicar la salvaguarda `updateLeido=true` a **toda** llamada `readDetail`, incluida la reapertura antes de `codArchivo=0`: detener lote, apagar archivo de la cuenta, auditar y avisar. Registrar intención duradera antes de cada apertura que pudiera cambiar estado; definir si la reapertura usa un evento propio o un intento trazable dentro del evento del ítem, y probarlo.
- [x] Releer `archive_files` antes de iniciar archivos de cada ítem para que apagar esa opción durante un lote detenga nuevas descargas. Seguir comprobando `active`, `archive_content` e `ind_estado` antes de cada detalle.
- [x] Conservar límite de lote y tres fallos, tratamiento especial de sesión vencida, credencial rechazada, archivo `codArchivo=0` ambiguo, archivo en la sesión del detalle y encadenado solo cuando hay avance y pendientes. Probar caída MySQL tras intención, SUNAT tras detalle, S3 durante `put`, Redis al encadenar y recuperación de lote huérfano.

**Cierre:** ningún no leído se abre; cualquier `updateLeido=true` desactiva el archivo; un cambio de configuración corta los efectos siguientes y los lotes se recuperan sin cruces de cuenta.

### W-5 Recuperación, observabilidad y documentación

- [x] Implementar únicamente las transiciones adicionales aprobadas en W-0. Para cada familia, consultar MySQL y Redis sin suponer atomicidad: un `pending` sin job repetible puede reencolarse; un estado que pudo llegar al detalle permanece `uncertain`; una descarga o prueba de conexión sigue su política específica. Probar caída antes/después de encolar y antes/después de llamar SUNAT con clientes de prueba.
- [x] Mantener `account-lock.ts` como única implementación de `GET_LOCK`; probar liberación normal, excepción y exclusión entre dos familias. Registrar fallos de MySQL, Redis, S3 y SUNAT con `logEvent` redactado y correlación por IDs opacos, sin cuerpos ni identificadores sensibles.
- [x] Actualizar el mapa de jobs y el alcance real de recuperación y cierre en `apps/api/README.md`; retirar afirmaciones sobre orden de sesión o cobertura de huérfanos que no respalden pruebas. Actualizar este seguimiento y, si cambia un contrato observable, OpenAPI, `HttpAdapter`, `LocalAdapter` y pruebas en el mismo cambio. No modificar el seguimiento histórico de BE-8 para hacer parecer que este trabajo ya estaba verificado.
- [x] Ejecutar `pnpm typecheck`, `pnpm lint`, unitarias e integración pertinente con MySQL/Redis/S3 de prueba; registrar números y fallos. Confirmar `git diff` sin secretos, migraciones imprevistas ni cambios a puertas. No ejecutar sondas SUNAT.

**Cierre:** la matriz final muestra cada invariante, su prueba y cualquier limitación; README, código y plan describen el mismo comportamiento.

## Matriz mínima de fallos a comprobar

| Borde | Resultado esperado que la prueba debe demostrar |
|---|---|
| MySQL antes de intención | No se abre sesión ni se llama SUNAT. |
| MySQL después de llamada potencialmente irreversible | La intención previa permite dejar `uncertain`; no se repite el detalle automáticamente. |
| Redis después de confirmar `pending` | Compensación o recuperación según familia, sin afirmar transacción MySQL–Redis. |
| S3 antes/después de escribir objeto | `file_assets` no afirma `stored` sin objeto válido; un objeto sin referencia queda detectable y limpiable. |
| SUNAT: sesión inválida, HTML inesperado, `updateLeido=true` | Código/estado adecuado, cierre de sesión; archivo se detiene ante cualquier lectura inesperada. |
| Revocación, cuenta desactivada, puerta cerrada, bloqueo ocupado | Ninguna apertura de sesión ni detalle; resultado durable coherente con la política de la familia. |
| Apagado con pasada y job activos | No se inicia trabajo nuevo; lo activo termina o queda en estado recuperable; se cierran conexiones y se libera bloqueo. |

## Entrega y límites

Entregar por etapa: archivos tocados, decisión de límite de capas, prueba ejecutada y resultado, estado antes/después de cada efecto remoto y riesgos restantes. La arquitectura se acepta cuando un job de las siete familias puede seguirse de entrada a efecto y recuperación sin leer SQL mezclado con toda la coordinación, y cuando las pruebas demuestran las garantías anteriores. **Más archivos o más clases no constituyen un criterio de éxito.**

## Seguimiento de avance

Entorno: Windows, Node con `corepack pnpm`; integración sobre `buzon_it` vacía (MySQL/Redis/S3Mock de `compose.test.yml`, **no** `buzon_sol`), migraciones aplicadas con `migration:run` de la API. Ninguna prueba contactó SUNAT ni fijó puertas `SUNAT_*`; no hay migraciones ni cambios de OpenAPI/`HttpAdapter`/`LocalAdapter`. Sin commits (decisión del encargo).

### W-0 · Línea base y decisiones

- **Línea base** (antes de editar, árbol limpio): `tsc` del worker sin errores; 13 unitarias; 19 pruebas de integración del worker en verde sobre `buzon_it` recién migrada (el fallo preexistente de `inventory-features.test.ts` solo aparece si las pruebas de la API corrieron antes sobre la misma base; no apareció).
- **Mapa job → cola → caso de uso → efectos:** tabla «Worker por capacidades» en [apps/api/README.md](../../../apps/api/README.md#worker-por-capacidades). Dependencias: cola → caso de uso → `*-store`/`files.ts`/paquetes; `account-lock.ts`, `notices.ts`, `detail-store.ts` y `credentials.ts` son compartidos.
- **Matriz de transiciones** (aprobada como referencia; el punto remoto es la llamada que puede cambiar estado en SUNAT):

| Tabla | Estado previo → efecto | Punto remoto | Caída posible | ¿Repetible? | Estado final | Recuperación |
|---|---|---|---|---|---|---|
| `sync_runs` | `pending` → `running` (con bloqueo) | listados `listNotiMenPag` (sin efecto remoto) | proceso/Redis/MySQL | Sí, desde el checkpoint | `complete` / `partial` | bucle: `running` sin bloqueo y `pending` sin job → `partial`; el siguiente inicio reanuda |
| `archive_runs` | `pending` → `running` | `readDetail` de leídos | ídem | Sí (solo ítems `indEstado<>0`) | `complete` / `partial` | bucle → `partial`; un nuevo lote lo planifica el inventario o un inicio manual |
| `mail_read_events` (usuario) | `pending` → `calling` → `complete` | `readDetail` (puede marcar leído) | tras `calling` | **No** | `complete` / `uncertain` / `denied` | no se reencola; `calling` → `uncertain` al volver a ejecutarse; `pending` se reintenta por BullMQ (6 × 5 s) |
| `mail_read_events` (`origin='archive'`) | `calling` → `complete` / `failed` / `aborted` | `readDetail` (incluye la reapertura de `codArchivo=0`) | tras `calling` | Sí (el ítem ya estaba leído); acotado a 3 fallos | ídem | el siguiente lote cierra `pending`/`calling` huérfanos como `uncertain` |
| `file_fetches` | `pending` → `fetching` → `complete` / `failed` / `denied` | descarga de archivo | tras `fetching` | Sí (la descarga no cambia la lectura) | ídem | **sin recuperación automática**; los de origen archivo quedan `failed` en el siguiente lote |
| `connection_tests` | `pending` → `testing` → `valid` / `invalid` / `failed` / `denied` / `superseded` | login | tras `testing` | Sí, pero lo decide el usuario | ídem | **sin recuperación automática**; nueva prueba |

- **Alcance de la recuperación (decisión):** solo documentar. No se amplió la recuperación de `pending`/`fetching`/`testing` de lectura, descargas y conexión; queda descrita como límite en `recovery.ts` y en el README. Ampliarla exige una prueba de caída por borde y una decisión de política aparte.

### W-1 · Frontera de ejecución y ciclo de vida

- `InventoryRunner`, `ReadProcessor` y `FileProcessor` reciben una **factoría** de cliente y la invocan solo tras el bloqueo y la revalidación; cierran la sesión en `finally`. Archivo y conexión ya lo hacían. `FileFetchProcessor` deja de abrir sesión antes de `FileProcessor`.
- `ReadProcessor` abre la sesión **antes** de marcar `calling`: un fallo de login deja el evento `pending` (reintentable), no `uncertain`.
- `main.ts`: todo recurso (MySQL, colas, consumidores, bucles) se registra al adquirirse y se cierra en `finally` (bucles → consumidores → colas → MySQL), registrando solo el nombre del paso si falla. `main(options)` admite inyectar `openSession`.
- Pruebas: `session-lifecycle.test.ts` (bloqueo ocupado, cuenta pausada, ejecución terminal, actor revocado, evento terminal o `calling`, activo ya `stored`: la factoría no se invoca; cierre tras fallo de SUNAT o HTML inesperado) y `shutdown.test.ts` (señal con job activo: espera, no toma otro, libera bloqueo y cierra sesión; fallo de MySQL al arrancar).
- *Límite:* la señal se emite en el mismo proceso (`process.emit("SIGTERM")`); una señal real de SO no llega a Node desde Git Bash en Windows (verificar en contenedor Linux). No se probó un fallo de arranque posterior a `initialize()`; la garantía es estructural (el `try` empieza antes de la primera adquisición).

### W-2 · Inventario y programación

- `inventory-store.ts`: `persistPage` (página + deduplicación + checkpoint + aviso de nuevos en una transacción), `replaceCatalog`, `recordFailure`. `inventory.ts` conserva barrido, reautenticación acotada y coordinación.
- Catálogos: una respuesta remota inválida o un fallo de parseo marca `unavailable`; un fallo de MySQL al persistir **ya no** se disfraza de `unavailable` (propaga, la ejecución queda `partial` y el catálogo guardado intacto). `inventory-catalogs.test.ts`.
- Un fallo al abrir la sesión deja la ejecución `partial` con su código pero **no** suma a `sync_failure_streak` (política previa conservada; un login con `invalid_credential` no pausa hoy la programación: decisión de política pendiente).
- `scheduler.ts`: `claimDueRun` (transacción MySQL) → encolado → `pauseAfterQueueFailure`. Cubierto por `scheduler.test.ts` (una ejecución por cuenta, hora Lima, cola caída), `inventory.test.ts` (checkpoint sin duplicados) e `inventory-features.test.ts`. «0 detalles en inventario» es estructural: `InventoryClient` no expone `readDetail`.

### W-3 · Lectura, archivos y almacenamiento

- `ReadProcessor` revalida también que la cuenta esté activa (antes solo lo hacía el login): cuenta desactivada → evento `denied`, sin sesión (cambio menor de política, probado).
- Descargas manuales y P-03: autorización repetida bajo el bloqueo antes de abrir sesión (`files-borders.test.ts`: cuenta desactivada, permiso revocado, P-03 desactivado o sin programación, ítem otra vez no leído → 0 sesiones).
- Bordes S3/MySQL probados: S3 correcto + MySQL caído → activo `failed`, sin `object_key`, objeto en clave determinista que el reintento sobrescribe; `.original` guardado + copia saneada fallida → `failed`, solo queda el `.original`. HTML o PDF falso, estado ≠ 200 y bucket caído: nunca `stored`, sesión cerrada. Limpieza por barrido del prefijo de la cuenta: **no implementada** (documentada).

### W-4 · Archivo por cuenta

- `archive-store.ts` (SQL de elegibilidad, eventos, resultados, parada), `archive-plan.ts` (planificación con compensación de Redis), `archive.ts` (`ArchiveProcessor`: un lote, una sesión). Todas las consultas conservan `account_id` e `ind_estado<>0`.
- La reapertura antes de un `codArchivo=0` recomprueba cuenta, `archive_files` e `indEstado`, registra **su propio** `mail_read_events` (`origin='archive'`) antes de la llamada y, si SUNAT responde `updateLeido=true`, detiene el lote, apaga el archivo, audita y avisa (antes solo fallaba el archivo y el lote seguía).
- `archive_files` se relee por ítem: apagarlo durante un lote corta las descargas siguientes pero no el contenido.
- `archive-guards.test.ts`: reapertura con `updateLeido`, `archive_files` apagado a mitad de lote, encolado fallido (`partial`/`remote_unavailable`), lote muerto con evento `calling` (→ `uncertain` y se reabre). Límite de lote, tres fallos, sesión vencida, credencial rechazada, lote huérfano y encadenado siguen cubiertos por `archive.test.ts`.
- *Límite:* la caída de MySQL tras la intención se simula con el evento `calling` que deja un lote muerto, no inyectando el fallo en el instante exacto.

### W-5 · Recuperación, observabilidad y documentación

- No había transiciones adicionales aprobadas en W-0: no se implementó recuperación nueva. `recovery.ts` agrupa ambas recuperaciones con la tabla de políticas por intención.
- `account-lock.ts` sigue siendo la única implementación de `GET_LOCK`; `account-lock.test.ts` prueba exclusión, independencia entre cuentas, liberación normal y tras excepción, y exclusión entre inventario y lectura.
- Logs redactados con IDs opacos añadidos: `read_event_uncertain`, `file_fetch_failed`, `connection_test_failed`, `shutdown_step_failed`.
- README de la API: orden de sesión corregido y nueva sección «Worker por capacidades» con mapa, alcance real de recuperación y bordes.
- Resultados finales (raíz): `pnpm typecheck` y `pnpm lint` sin errores; `pnpm test` en verde (domain 7, sunat-adapter 16, worker 13 unitarias, web 77); integración del worker sobre `buzon_it`: 38 casos, 0 fallos (Redis y S3Mock activos). `git diff` sin secretos, migraciones ni cambios de puertas.

### Matriz de fallos → prueba

| Borde | Prueba |
|---|---|
| MySQL antes de intención → sin sesión ni SUNAT | `session-lifecycle`, `files-borders` |
| MySQL tras llamada irreversible → `uncertain`, sin repetir | `reading.test` (`failing`, `calling`), `archive-guards` (lote muerto) |
| Redis tras confirmar `pending` | `scheduler.test` (pausa `queue_unavailable`), `archive-guards` (encolado fallido) |
| S3 antes/después de escribir | `files-borders` (3 casos), `files.test` |
| SUNAT: sesión inválida, HTML, `updateLeido=true` | `files-borders`, `archive.test`, `archive-guards` |
| Revocación, cuenta desactivada, puerta cerrada, bloqueo ocupado | `session-lifecycle`, `files-borders`, `account-lock` |
| Apagado con pasada y job activos | `shutdown.test` |

### Riesgos restantes

Recuperación de lectura, descarga y conexión sin implementar (por decisión); objetos S3 huérfanos sin barrido; el login con credencial rechazada al abrir sesión no suma a la racha de fallos (política previa); señal de SO no verificada en Windows; el reintento de lecturas depende de `attempts: 6` fijado en la API.

Quedan fuera: nuevas funciones del buzón, cambio de contratos HTTP por estética, migración de ORM/cola/storage, validación SUNAT S-xx y archivo de no leídos. Cualquier cambio de política remota descubierto durante la implementación se registra y se decide por separado antes de aplicarlo.
