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
