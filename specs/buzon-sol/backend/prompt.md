# Prompt de implementación · Backend de Buzón SOL

Actúa como arquitecto y desarrollador senior. Diseña e implementa un backend multiusuario que consulta y conserva los Mensajes y Notificaciones de **N cuentas SUNAT**. Cada cuenta tiene su propio buzón, credencial, programación, datos y archivos. Usa como fuente de comportamiento comprobado [requisitos v1](../legacy/requirements.md), [contrato SUNAT](../sunat/contracts.md), [diseño v1](../legacy/design.md) y [evidencia de APIs](../sunat/BUZON_SOL_APIS.md). Para el alcance multiusuario vigente, consulta [requisitos de producto](../product/requirements.md) y [spec backend](spec.md). El [proyecto Claude Design de Buzón SOL](https://claude.ai/design/p/28bc9ee9-1a5e-4d16-a303-542e8c875f14?file=Buzon+SOL+-+Dise%C3%B1o+UX.dc.html) define las pantallas y flujos de producto; sus afirmaciones sobre login automático o inventario «sin efecto» son objetivos por validar, no hechos comprobados.

## 1. Stack y estructura

- TypeScript `strict`, NestJS con Fastify y TypeORM. MySQL 8 para datos; `synchronize: false` y cambios de esquema mediante migraciones versionadas ejecutadas por un comando separado, nunca al arrancar la API.
- API HTTP y worker BullMQ como procesos separados. Redis aloja las colas y sus programaciones. El adaptador SUNAT comienza con una prueba de cliente HTTP y cookie jar aislado por cuenta; Playwright solo se incorpora si se demuestra una dependencia real del navegador. MinIO local mediante el SDK S3; conservar una configuración de endpoint para poder usar S3 después.
- Monorepo pnpm si API, worker y frontend se desarrollan juntos. No introducir Turborepo, repositorio base genérico ni un runner SQL propio sin una necesidad demostrada.
- Estructura inicial: `apps/api`, `apps/worker`, `packages/domain` para casos de uso y contratos compartidos, `packages/sunat-adapter` para sesión y endpoints observados. La API y el worker utilizan los mismos casos de uso; el worker no llama a la API por HTTP para ejecutar trabajo interno.
- Docker Compose local: API, worker, MySQL, Redis y MinIO con bucket privado. Datos persistentes en volúmenes.

## 2. Capas y responsabilidades

Organiza por módulo de negocio (`users`, `auth`, `roles`, `sunat-accounts`, `mailbox`, `sync`, `files`, `audit`). Dentro de cada módulo, crea solo las capas que use:

- **Controller y DTO:** entrada, validación, autorización inicial y respuesta. Nunca contienen reglas de sincronización ni devuelven entidades TypeORM.
- **Service / caso de uso:** reglas, autorización sobre la cuenta concreta, límites de transacción y emisión de trabajos.
- **Repository:** acceso a MySQL, consultas con `account_id` obligatorio, índices y upserts idempotentes.
- **Adaptador SUNAT:** login, sesión aislada, listados, detalles, carpetas, etiquetas, documentos generados, adjuntos y salida. Traduce respuestas externas a contratos internos y detecta cambios de esquema o vencimiento de sesión. La lógica de negocio no manipula cookies ni construye URLs con tokens.
- **Almacenamiento:** recibe bytes validados, calcula SHA-256, escribe objetos privados y devuelve clave interna, tamaño y MIME. El nombre original es metadato, no ruta.

Usa DTOs de respuesta y mapeos explícitos donde protejan datos internos. Emplea transacciones solo para operaciones que deben persistirse juntas. Evita imponer `AsyncLocalStorage`, diffs universales o un repositorio base auditado a todos los módulos desde el inicio.

## 3. Modelo de datos mínimo

| Entidad | Campos y reglas principales |
|---|---|
| `users` | Identificador interno, nombre, email único, hash de contraseña, estado y preferencias de aviso de lectura. |
| `roles`, `permissions`, `role_permissions` | Un rol por usuario inicialmente; permisos para ver metadatos, abrir contenido, descargar, marcar revisado local, ejecutar inventario, administrar cuentas/programaciones/usuarios y ver auditoría. |
| `role_sunat_accounts` | Cuentas visibles por rol. Una asignación explícita `all_accounts` permite acceso a cuentas futuras; toda consulta verifica alcance por cuenta. |
| `sunat_accounts` | ID interno, alias, RUC protegido, usuario SOL protegido, estado, fecha de alta y última conexión. No confundir el usuario de la app con el usuario SOL. |
| `sunat_credentials` | Cuenta, versión, ciphertext, nonce, identificador de clave, fecha de reemplazo y estado de validación. Nunca devolver la Clave SOL por API ni incluirla en auditoría. |
| `sync_schedules` | Cuenta, frecuencia o expresión cron, zona `America/Lima`, días/ventana horaria, bandejas habilitadas, descarga de elementos ya leídos y estado activo/pausado. |
| `sync_runs`, `sync_pages` | Cuenta, modo, causa (`manual`/`programado`), bandeja, página, inicio/fin, estado, contadores observados y declarados, error redactado y punto de reanudación. |
| `mail_items` | Único `(sunat_account_id, tipo_msj, cod_mensaje)`, metadatos de fila, fecha original y normalizada, estado remoto `indEstado`, fecha de observación, carpeta, etiqueta, destacado, urgente, número anunciado de adjuntos, primera/última observación y estado local de procesamiento. |
| `mail_details` | Ítem, cuerpo original, cuerpo normalizado, tipo de contenido, JSON de detalle protegido, documento generado si existe y fecha de obtención. Solo existe tras una lectura autorizada o para un elemento ya leído. |
| `mail_attachments` | Ítem, posición en `listAttach`, `codArchivo`, `numId`, nombre original, clave de objeto, MIME, tamaño, hash y estado de descarga. `codArchivo=0` no es clave global. |
| `mail_read_events` | Ítem, actor o trabajo, estado remoto antes/después, `updateLeido`, intención registrada antes de la llamada de detalle y resultado. |
| `mail_reviews` | Usuario, ítem, marca local de revisado y fecha. Esta marca nunca se envía a SUNAT. |
| `sunat_folders`, `sunat_labels` | Cuenta, código, nombre, color/cantidad observados y fecha de observación. Aceptar códigos nuevos. |
| `audit_events` | Actor, cuenta, acción, entidad, fecha, request/job ID y cambios redactados. Registrar cambios de acceso, credenciales, programación, apertura de no leídos y descargas; nunca guardar secretos ni cuerpos completos. |

Las tablas de buzón usan `sunat_account_id` e índices que faciliten búsquedas por bandeja, estado y fecha. Guardar timestamps internos en UTC y mostrar fechas de SUNAT según la zona y el formato observados; conservar la fecha original para corregir una interpretación posterior. Separar estado remoto, estado de descarga y revisión local. No aplicar soft delete genérico a mensajes, auditoría o ejecuciones; usar estados y políticas explícitas de retención.

## 4. Programaciones y sincronización

1. Un programador por cuenta coloca trabajos de inventario en BullMQ. Evitar ejecuciones simultáneas sobre la misma cuenta con un bloqueo verificable y vencimiento; la concurrencia entre cuentas puede crecer gradualmente.
2. Antes de leer, comprobar una sesión autenticada asociada **solo** a esa cuenta. Si vence o falla el login, registrar `requiere_reautenticacion` o `credencial_rechazada` según evidencia, pausar cuando corresponda y avisar al administrador. No interpretar HTML de login como bandeja vacía.
3. **Inventariar primero** Mensajes (`tipoMsj=1`) y Notificaciones (`tipoMsj=2`). Recorrer páginas hasta confirmar una página JSON válida vacía; `records` y `total` no determinan el fin. Upsert por clave natural y conservar el progreso de cada página.
4. El inventario guarda solo la fila y el estado `indEstado`. Si es no leído (`0`), no pedir detalle ni adjuntos. Para ítems ya leídos cuyo contenido falte, encolar lectura y descarga; si estaban leídos por una acción externa, respetar igualmente el estado observado.
5. Cuando una persona autorizada abre un no leído, registrar la intención de lectura **antes** de llamar a `obtenerDetalleNotiMen`. Mostrar el aviso de posible cambio de estado, pedir el detalle, persistirlo, descargar archivos y reconsultar `indEstado`. Para Notificaciones, ese cambio sigue siendo una hipótesis hasta probarlo con una no leída.
6. Reintentos acotados e idempotentes. Un error de adjunto deja el detalle guardado y solo el archivo pendiente. Un fallo tras pedir detalle conserva el evento de lectura original. La reanudación no duplica ítems ni objetos.
7. Procesar secuencialmente por cuenta las descargas con `codArchivo=0` desde la apertura del detalle hasta obtener el archivo, debido a su posible dependencia del estado del servidor.

**Condición previa para afirmar «inventario sin efecto en SUNAT»:** demostrar que el inicio del visor no abre automáticamente el primer detalle, o bloquear esa llamada antes de cargarlo y verificar el resultado. La web observada sí abrió el primer elemento al iniciar. Hasta resolverlo, interfaz y logs deben mostrar que una conexión podría cambiar ese estado.

**Condición previa para cron desatendido:** validar de extremo a extremo el login automático por HTTP con una cuenta de prueba, el uso de servicios autenticados con el mismo cookie jar, el cierre y el vencimiento. El formulario público hace `POST` a `j_security_check` y contempla CAPTCHA condicional; el login manual autorizado llegó al buzón el 30/09/2026. Eso no demuestra aún login desatendido ni acceso HTTP independiente del navegador. Si falla por una dependencia real de JavaScript/navegador, evaluar Playwright en el worker. El diseño admite credenciales cifradas como requisito nuevo, sin presentar esa capacidad como ya validada.

## 5. Seguridad y API

- Autenticación de la **app** separada de SOL. Contraseñas de usuarios con Argon2id; sesiones revocables. Elegir el mecanismo concreto de token/cookie según despliegue del frontend, con protección CSRF cuando corresponda.
- Credenciales SOL cifradas con una clave fuera de MySQL, idealmente un gestor de secretos/KMS en producción. Descifrar solo en memoria del worker autorizado; limitar quién puede reemplazarlas y auditar el cambio sin valor anterior/nuevo.
- No registrar cookies, `token`, `hc`, `state`, `datos`, `Referer`, RUC completo, contraseña, asunto ni cuerpo en logs operativos. Cifrar o proteger los datos tributarios almacenados según el entorno. Cada endpoint de detalle o archivo verifica permiso **y** cuenta concreta.
- API `/api/v1` con DTOs validados, errores estructurados y OpenAPI protegido. Endpoints de usuarios/roles, cuentas/credenciales, programaciones, inventario, bandejas, detalle, adjuntos, revisión local, sincronizaciones y auditoría. La descarga usa bucket privado y una URL prefirmada corta emitida solo después de autorizar al usuario.
- La acción de abrir un ítem no leído es un comando explícito con auditoría y semántica de cambio remoto; no ejecutar `getDetail` desde un listado, vista previa automática o precarga del frontend.

## 6. Verificaciones de aceptación

- Dos cuentas y usuarios con roles distintos no mezclan filas, sesiones, archivos ni permisos.
- El caso de paginación observado en el que SUNAT declara 108 páginas pero tiene 134 páginas con datos conserva las 3328 filas únicas y marca la discrepancia.
- Un inventario controlado no llama al detalle; si no se puede controlar la apertura automática del visor, informa el riesgo y no afirma que preserva los no leídos.
- Un no leído queda sin cuerpo ni adjuntos hasta que una persona lo abra; un ya leído puede descargarse en segundo plano.
- Si se abre un no leído, el evento persiste aunque después falle el almacenamiento. La revisión local permanece independiente del estado SUNAT.
- HTML de login o error donde se esperaba JSON/PDF produce un estado de autenticación o descarga fallida, nunca datos vacíos o archivo válido.
- Un cron vencido se reanuda o solicita intervención según el login realmente validado; la programación y la API no prometen una renovación no comprobada.
- Repetir inventario, lectura de ya leído o descarga no crea duplicados. Los tests de integración usan MySQL, Redis y MinIO reales o contenedores equivalentes; el adaptador SUNAT usa fixtures redactados para las respuestas observadas.

## 7. Relación con el plan de backend

El [plan de backend](../plan/backend.md) define sus hitos y criterios de cierre. El [plan de integración SUNAT](../plan/sunat-integration.md) valida login, sesión y servicios remotos antes de habilitarlos; este archivo aporta el stack y las pautas técnicas. El [plan de frontend](../plan/frontend.md) avanza por separado. La conexión entre frontend y backend se definirá posteriormente.

Documenta decisiones que cambien lo aquí definido y enlaza cada contrato SUNAT utilizado con su evidencia en las specs. No agregues funciones de mover, destacar, marcar urgente o «marcar como no leído» hasta que exista un caso de uso y un comportamiento remoto verificado.
