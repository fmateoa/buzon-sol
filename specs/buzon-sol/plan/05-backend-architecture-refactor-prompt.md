# Prompt de refactorización arquitectónica · Backend de Buzón SOL

**Documento de apoyo.** El plan que se ejecuta y cuyo avance se marca es [01 Backend, BE-8](01-backend.md#be-8-refactorización-arquitectónica-de-api-y-worker). Este prompt detalla cómo realizar ese hito; no se ejecuta como un plan independiente.

Actúa como arquitecto y desarrollador senior de TypeScript, NestJS y sistemas con trabajos asíncronos. **Refactoriza la arquitectura del backend existente** de Buzón SOL v2. No estás construyendo un backend nuevo: debes conservar sus funciones, contratos y garantías actuales mientras mejoras la separación de responsabilidades, la facilidad de cambio y la operación de la API y del worker.

Este documento es una instrucción de implementación para un agente que trabajará dentro de este repositorio. Primero inspecciona el estado real del código. Cuando el documento describa una intención y el código actual difiera, documenta la diferencia y decide la migración más pequeña que preserve el comportamiento. No supongas que un hito marcado como hecho demuestra capacidades remotas que aún dependen de una puerta SUNAT.

## 1. Fuentes y orden de lectura

Antes de editar, lee en este orden:

1. `CLAUDE.md` y `specs/buzon-sol/README.md` para las reglas del repositorio.
2. `specs/buzon-sol/product/requirements.md`, `specs/buzon-sol/backend/spec.md` y `specs/buzon-sol/backend/prompt.md` para el producto y la intención arquitectónica original.
3. `specs/buzon-sol/plan/01-backend.md`, especialmente «Seguimiento de avance», para el estado implementado y sus evidencias.
4. `specs/buzon-sol/plan/04-integration.md` y `apps/api/openapi.yaml` para el contrato consumido por la web.
5. `specs/buzon-sol/plan/02-sunat-integration.md` y `specs/buzon-sol/sunat/contracts.md` solo para entender los límites de las operaciones remotas y sus puertas.
6. El código y las pruebas de `apps/api`, `apps/worker`, `packages/domain`, `packages/sunat-adapter` y `packages/storage`.

El plan y los documentos son contexto; el código y las pruebas muestran el comportamiento actual. Si detectas una discrepancia, no la resuelvas silenciosamente cambiando el contrato. Registra la decisión y sus consecuencias.

## 2. Objetivo y alcance

El objetivo es que cada flujo del backend tenga límites claros: HTTP, caso de uso, persistencia, cola, procesamiento y adaptadores externos. Debe ser fácil ubicar dónde se valida una petición, se autoriza una cuenta, empieza una transacción, se escribe auditoría, se encola un trabajo y se ejecuta una llamada a SUNAT.

Trabaja sobre la arquitectura **general** de la API y del worker. No traslades al proyecto modelos de oficinas, países, ventas, pagos u otras reglas del prompt de otro sistema. La unidad de aislamiento aquí es la cuenta SUNAT y el usuario/rol de la aplicación.

Resultados esperados:

- Controllers organizados por capacidad, pequeños y centrados en HTTP.
- Casos de uso o servicios con reglas y límites transaccionales explícitos.
- Acceso a datos localizado por flujo o módulo, sin abstracciones genéricas obligatorias.
- Fronteras API/worker, MySQL/Redis y SUNAT/storage fáciles de identificar.
- Validación, errores, configuración, health checks y cierre de procesos consistentes.
- Pruebas que demuestren que los contratos y las invariantes críticas sobreviven a la refactorización.

## 3. Estado de partida que debes comprobar

Al redactar este prompt, el repositorio usa pnpm workspaces, TypeScript estricto, NestJS con Fastify en `apps/api`, un proceso BullMQ en `apps/worker`, TypeORM con MySQL 8, Redis para colas y almacenamiento S3 compatible. `packages/domain` contiene contratos y utilidades compartidas; `packages/sunat-adapter` contiene el cliente remoto; `packages/storage` encapsula objetos.

La API tiene un `IdentityController` que reúne las rutas de identidad, administración, buzón, inventario, archivo, archivos y auditoría. Los servicios están separados por funciones, pero muchos ejecutan SQL directamente. El worker tiene procesadores por capacidad y un punto de entrada que registra consumidores, mantenimiento y programador según puertas de entorno. Las migraciones TypeORM se ejecutan mediante comando separado; `synchronize` y `migrationsRun` están desactivados. Las rutas publicadas usan `/api/v1` y la web consume parte de ellas mediante `HttpAdapter`.

Verifica estas afirmaciones contra el árbol de trabajo actual. Hay cambios locales en curso: **no descartes, sobreescribas ni restablezcas trabajo ajeno**. Revisa `git status` antes de actuar y adapta las ediciones a ese estado.

## 4. Invariantes que no puede alterar la refactorización

### Contratos y compatibilidad

- Conserva rutas, métodos, parámetros, códigos de estado, cabeceras, cuerpos de respuesta y códigos de error existentes salvo que un cambio de contrato sea imprescindible y se acuerde como trabajo separado.
- Conserva `apps/api/openapi.yaml` sincronizado con cualquier cambio observable. Si un contrato cambia, actualiza conjuntamente `apps/web/src/adapters/http`, los tipos del adaptador web y sus pruebas. No cambies el contrato solo para acomodar una estructura de carpetas.
- Mantén los identificadores opacos actuales en la API. No migres a `BIGINT`, UUIDv7 u otro esquema de IDs por razones arquitectónicas.
- Conserva el mecanismo de sesión actual: token opaco revocable, almacenado como hash y permisos consultados de nuevo. La decisión futura entre cookie y token pertenece al despliegue del frontend, no a esta refactorización.

### Cuenta, permisos y datos sensibles

- Cada operación con datos de una cuenta comprueba el permiso y la pertenencia a esa cuenta. Un ID recibido por HTTP o por un job no acredita acceso.
- La API no recibe la clave privada del worker. La Clave SOL no sale por respuestas, logs ni auditoría; el worker la descifra solo donde la necesita.
- Mantén la redacción de logs y auditoría. No registres cookies, tokens, RUC completo, asuntos, cuerpos, URLs remotas sensibles ni errores crudos que puedan contenerlos.
- Conserva los archivos en bucket privado y su entrega por proxy autenticado, incluida la revocación inmediata de acceso. No sustituyas ese diseño por URLs prefirmadas como parte de esta tarea.

### Efectos de SUNAT y ejecución asíncrona

- **Inventariar no es leer.** El inventario no abre detalles de mensajes no leídos. La apertura explícita registra una intención duradera antes de contactar SUNAT.
- El archivo automático solo procesa elementos que SUNAT ya muestra como leídos. Mantén la salvaguarda que detiene y desactiva el archivo si una respuesta indica `updateLeido=true`.
- Conserva la idempotencia persistente de lecturas, checkpoint de páginas, reanudación, recuperación de huérfanos y bloqueo por cuenta. Un resultado remoto incierto no provoca una nueva llamada automática.
- No habilites `SUNAT_*`, `ENABLE_SUNAT_JOBS` ni cron para demostrar una refactorización. Las puertas siguen apagadas por defecto y su activación corresponde a la evidencia y al operador.
- API y worker siguen como procesos separados; el worker no llama a la API por HTTP para ejecutar trabajo interno. Una sesión/cookie jar SUNAT pertenece a un trabajo y una cuenta y se cierra o descarta al terminar.

### Base de datos y colas

- Conserva el esquema y las migraciones aplicadas. `synchronize: false`, `migrationsRun: false`; la API y el worker no migran al arrancar.
- No edites una migración ya aplicada. No cambies el mecanismo de migraciones TypeORM por un runner SQL propio. Si el cambio arquitectónico requiere esquema, crea una migración nueva y explica por qué.
- Mantén MySQL como fuente de verdad de intenciones, estados, checkpoints y auditoría. Redis/BullMQ transporta trabajos; una clave con TTL no reemplaza el registro duradero de una operación remota.
- Conserva la semántica de transacción y de exclusión existente. No añadas bloqueo pesimista universal; úsalo solo donde la concurrencia de ese flujo lo exige.

## 5. Arquitectura objetivo: reglas de diseño

### 5.1 Organización por capacidad

Organiza `apps/api/src` en módulos o carpetas funcionales. Un mapa inicial posible es `auth`, `identity`/`users-roles`, `accounts`, `mailbox`, `inventory`, `scheduling`, `reading`, `files`, `archive`, `operations`/`audit`, más `db` y `common`. Ajusta nombres y límites después de trazar las dependencias reales. No crees un módulo Nest separado para cada entidad si solo añade declaraciones y exportaciones sin aclarar el flujo.

Cada capacidad debe tener solo las piezas que usa:

- **Controller:** traduce HTTP a una llamada de caso de uso; obtiene parámetros, body y actor; aplica validación y produce la respuesta. No conoce SQL, EntityManager, BullMQ ni el cliente SUNAT.
- **Servicio o caso de uso:** decide permisos sobre el recurso, estados, transacción, auditoría y emisión de trabajos. Puede coordinar varios componentes; no construye respuestas Fastify.
- **Persistencia:** encapsula consultas complejas o repetidas y las consultas cuya forma impone aislamiento por cuenta. Puede ser una función o clase pequeña por flujo. Evita una interfaz para una sola implementación y un repositorio base genérico.
- **Adaptador externo:** encapsula Redis/BullMQ, S3 o SUNAT; los detalles de cookie jar, URL remota, cliente S3 y nombres de cola no atraviesan la capa HTTP.

Puedes conservar SQL en un servicio cuando es una operación corta y claramente local. Extrae persistencia cuando el SQL oculta la regla, se repite o hace difícil probar la autorización/transacción. No conviertas cada `SELECT` en una clase.

### 5.2 Inyección y dependencias

- `AppModule` debe componer capacidades e infraestructura de modo legible. Evita un módulo raíz con una lista creciente de todos los controllers y servicios.
- Los módulos de negocio no deben depender circularmente unos de otros. Extrae una función compartida solo cuando exista uso real por al menos dos flujos.
- `packages/domain` debe seguir siendo independiente de NestJS, Fastify, TypeORM, Redis y S3. Mueve allí únicamente contratos o lógica de negocio genuinamente compartidos por API y worker. No lo conviertas en una bolsa de helpers.
- Mantén el adaptador SUNAT como frontera de protocolo. No introduzcas llamadas remotas en controllers ni en repositorios de MySQL.
- No agregues `AsyncLocalStorage`, CQRS, bus de eventos, factories, interfaces de una implementación o decoradores propios sin una necesidad observada y una prueba que justifique su costo.

### 5.3 Transacciones, cola y auditoría

- Indica en cada flujo cuál es la unidad atómica de MySQL. Haz que el servicio controle el límite de transacción y pase el `EntityManager` o un contexto explícito a las funciones de persistencia que participan en ella.
- Nunca mantengas una transacción de MySQL abierta durante una llamada de red a SUNAT, S3 o Redis.
- Cuando una acción necesita estado y auditoría atómicos, escribe ambos en la misma transacción. Centraliza la construcción/redacción del evento de auditoría si reduce duplicación real; no fuerces un diff universal o una auditoría automática de cada fila técnica del worker.
- Si hay una ventana entre confirmar MySQL y encolar en BullMQ, conserva o mejora la recuperación existente de `pending` y huérfanos. No afirmes atomicidad entre MySQL y Redis.
- Mantén el `requestId` o correlación de trabajo donde ya exista. Si incorporas correlación nueva, propágala explícitamente y verifica que no revele datos sensibles; no introduzcas almacenamiento de contexto global por conveniencia.

## 6. Mejoras transversales acotadas

### Validación de entrada

La API usa cuerpos genéricos y validación distribuida. Define DTOs o esquemas para las rutas que los necesitan y aplica una política de validación consistente en la frontera HTTP: tipos, límites, valores permitidos y rechazo de campos desconocidos cuando corresponda. Asegura que los servicios sigan validando invariantes de negocio y que los jobs no confíen en un DTO HTTP. No aceptes una validación que cambie silenciosamente los cuerpos válidos actuales.

### Errores

Conserva los códigos de negocio y respuestas actuales. Haz que el filtro cubra todos los controllers nuevos y el health check, y que errores inesperados no expongan SQL, headers, bodies ni URLs remotas. Decide la forma final de la respuesta de error solo si puedes actualizar y verificar API, OpenAPI y web juntos. No introduzcas RFC 7807 por obligación estética.

### Configuración

Valida al iniciar las variables necesarias para cada proceso y capacidad habilitada. Las puertas SUNAT deben aceptar únicamente `"true"` explícito, mantenerse apagadas por defecto y rechazar combinaciones inválidas como ahora. No exijas secretos de una capacidad deshabilitada. Conserva la separación de clave pública en API y privada en worker. Documenta un `.env.example` sin credenciales reales si falta o está desactualizado.

### Operación

Define liveness como «el proceso responde» y readiness como «puede servir su función esencial». Comprueba MySQL y las dependencias que sean obligatorias para las rutas o trabajos habilitados, con tiempos de espera acotados y sin filtrar detalles internos. Mantén un cierre ordenado: dejar de aceptar trabajo, detener bucles, cerrar consumidores/colas, conexiones y servidor HTTP. No vuelvas obligatoria una dependencia opcional solo para hacer pasar readiness.

### Logs

Reutiliza la redacción y el formato estructurado existentes en `packages/domain/src/log.ts`. Añade campos de correlación útiles si los flujos lo necesitan. No introduzcas una segunda biblioteca de logging sin demostrar que la actual impide un requisito concreto.

## 7. Worker: cambio proporcional

El worker ya separa procesadores por capacidad. No lo conviertas a NestJS solo para igualar la API. Revisa su arranque, dependencias, colas, cierre y límites entre procesador, caso de uso, persistencia y cliente SUNAT. Refactoriza únicamente los puntos donde hoy una función combina demasiadas decisiones o duplica acceso a datos difícil de mantener.

Para cada familia de trabajo —conexión, inventario, lectura, archivo, archivos, programación y recuperación— comprueba:

1. Qué entrada recibe, qué puerta la habilita y qué datos vuelve a validar al ejecutar.
2. Cuándo adquiere y libera la exclusión por cuenta.
3. Dónde abre y cierra la sesión SUNAT.
4. Qué estado duradero se confirma antes de una llamada con efecto remoto.
5. Qué ocurre si falla MySQL, Redis, S3 o SUNAT en cada borde.
6. Qué operaciones son repetibles y cuáles quedan en estado incierto para intervención.

La refactorización no debe cambiar la política de reintentos, los límites de lote, la semántica de `codArchivo=0`, ni habilitar trabajo remoto real.

## 8. Método de ejecución por etapas

Haz cambios pequeños que compilen y se puedan revisar. No reescribas la API y el worker en una sola pasada.

### Etapa A: mapa y decisiones

Antes de modificar código, produce un mapa breve de rutas → controller → servicio → SQL/cola y de jobs → procesador → MySQL/SUNAT/S3. Identifica acoplamientos, duplicación y pruebas que protegen cada flujo. Escribe una tabla «mantener / cambiar / posponer» con la razón concreta de cada decisión. Toma como línea base `git status`, typecheck y las pruebas disponibles; registra los fallos preexistentes. No ejecutes pruebas contra una base que pueda contener datos reales.

### Etapa B: frontera HTTP

Divide el controller central por capacidades sin alterar rutas ni respuestas. Ajusta la composición NestJS y el alcance del filtro de errores. Introduce validación de forma incremental, comenzando por autenticación, administración y comandos con efectos. Verifica cada grupo con las pruebas HTTP existentes antes de mover el siguiente.

### Etapa C: casos de uso y persistencia

Traza los flujos de identidad/cuentas y los de buzón/trabajos. Extrae consultas solo donde separarlas aclare autorización, transacción o reutilización. Reduce la duplicación de auditoría sin imponer un repositorio base. Conserva las consultas acotadas por cuenta y los bloqueos específicos. Mantén la respuesta HTTP fuera de la capa de negocio.

### Etapa D: worker y fronteras externas

Ordena el cableado del worker y los procesadores que lo necesiten. Verifica que el estado duradero y la llamada remota permanezcan en el mismo orden; comprueba recuperación tras caída y cierre de recursos. Conserva las puertas, el aislamiento por cuenta y los clientes de prueba.

### Etapa E: configuración y operación

Valida configuración por proceso, añade readiness y cierre ordenado de la API, y comprueba el worker bajo configuraciones sin puertas y con combinaciones inválidas. Ajusta documentación de operación y comandos reales.

En cada etapa enumera archivos modificados, comportamiento que debe permanecer igual, pruebas ejecutadas y riesgos pendientes. No marques trabajo como terminado en `plan/01-backend.md` sin una prueba o verificación registrada, conforme a sus reglas de seguimiento.

## 9. Pruebas y criterios de aceptación

Usa las pruebas existentes como red de seguridad y agrega solo las pruebas necesarias para los límites que cambien. La refactorización se acepta cuando:

- `pnpm typecheck`, `pnpm lint` y las suites pertinentes pasan, o los fallos preexistentes quedan identificados con evidencia.
- Las pruebas API con MySQL de prueba confirman sesión, revocación, permisos y aislamiento por cuenta; las rutas y respuestas consumidas por `HttpAdapter` siguen compatibles.
- Las pruebas del worker confirman inventario sin detalle, checkpoint, reanudación sin duplicados, intención antes de lectura, `uncertain` sin repetición remota, archivo solo de ya leídos y exclusión por cuenta.
- La integración de cola y almacenamiento usa servicios de prueba (`compose.test.yml`) y nunca una base con datos reales. No es obligatorio cambiar a Testcontainers.
- Una prueba de arranque verifica que API y worker fallan con configuración esencial inválida y que las puertas SUNAT apagadas no realizan llamadas remotas.
- Una prueba de apagado o verificación registrada demuestra cierre de servidor, workers, colas y conexiones.
- OpenAPI, README y plan reflejan el estado final; no contienen promesas sobre validaciones SUNAT pendientes.

No ejecutes sondas con cuentas SUNAT reales ni habilites puertas como parte de estos criterios. La prueba remota tiene su propio plan y autorización.

## 10. Qué no implementar por esta tarea

- Nuevas funciones de producto, pantallas o integración INT-2.
- JWT, refresh tokens, cambio de estrategia de sesión o Redis como caché de permisos por defecto.
- Reemplazo de TypeORM o del mecanismo de migraciones, cambio masivo de identificadores o particionado de auditoría sin evidencia de volumen.
- Soft delete global, `created_by`/`updated_by` obligatorios en todas las tablas, bloqueo optimista universal o transacciones implícitas globales.
- Turborepo, CQRS, arquitectura hexagonal ceremonial, repositorio base auditado, un módulo/DTO/mapper por cada entidad o un paquete compartido que reexporte todo.
- SMTP/Graph, Azure Blob, nuevos proveedores o sistemas de caché mientras no sean necesarios para el comportamiento actual.
- Cambios en la semántica de SUNAT, sus puertas, los efectos de lectura o la política de archivo.

Si descubres un defecto real fuera de alcance que impide la refactorización, corrige la causa mínima y deja prueba. Si no la impide, regístralo como pendiente con evidencia en lugar de ampliar silenciosamente el encargo.

## 11. Entregables finales

Al terminar, entrega:

1. Un resumen de la arquitectura resultante con el recorrido de una petición HTTP y de un job, y las dependencias entre módulos.
2. La lista de cambios por etapa, con enlaces a archivos y explicación de las decisiones no obvias.
3. Una matriz breve de invariantes preservadas y la prueba que las respalda.
4. Los comandos ejecutados y resultados, distinguiendo pruebas unitarias, integración local y cualquier verificación no realizada.
5. Los riesgos pendientes y las decisiones que realmente requieran información del despliegue o del producto.

El criterio de éxito es una arquitectura más clara para cambiar y operar este backend, con el mismo comportamiento observable y las mismas garantías sobre datos y efectos remotos. Menos archivos o más capas por sí solos no demuestran éxito.
