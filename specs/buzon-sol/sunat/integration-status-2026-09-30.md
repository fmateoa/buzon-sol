# Estado de integración SUNAT · 30/09/2026

**Cuenta real probada:** A, con resultados redactados. **Transporte:** HTTP directo. **Decisión actual:** `NO_VALIDADO` para inventario y cron productivos. El login y la prueba de conexión HTTP funcionaron repetidamente desde sesiones nuevas. La credencial temporal local está cargada para completar las sondas y se eliminará al terminar.

| Prueba | Estado | Evidencia actual o trabajo faltante |
|---|---|---|
| S-01 Enlace/formulario | pasa | Portada, parámetros originales y POST observados. |
| S-02 Login desatendido | pasa | Node.js abrió el visor y ambas bandejas dos veces desde jars nuevos. |
| S-03 Dependencias | pasa en A | Listado y PDF funcionan con cookie jar; sin cookies devuelven `rows:null` y HTTP 500, respectivamente. Omitir `X-Ruc`, XHR o Referer por separado no impidió el acceso. El visor sigue siendo paso necesario antes del listado. |
| S-04 Arranque pasivo | pendiente | Dos barridos completos de A no encontraron no leídos (10 Mensajes, 5 Notificaciones); falta un caso no leído real antes/después. |
| S-05 Vencimiento/reingreso | parcial | Reingreso acotado probado con expiración inyectada; sondas de actividad/inactividad preparadas, falta medir expiración real. |
| S-06 Salida | falla | `prevApp`/`salir`, iframe y su AJAX `POST /visor/master` con `logout` dejaron `rows[]` accesible con el mismo jar. |
| S-07 Listados | pasa en A | Ambas bandejas devolvieron filas autenticadas y el parser aceptó los tipos observados. Falta segunda cuenta. |
| S-08 Paginación | pasa en A | Barrido HTTP hasta vacío confirmado: 10 Mensajes y 5 Notificaciones, página 2 vacía en ambas. Fixtures 3328/227 y checkpoint MySQL pasan. Falta barrido HTTP de la cuenta grande. |
| S-09 Búsqueda/estados | pendiente | No probados en HTTP de Node. |
| S-10 Carpetas | parcial | En A, catálogo HTTP autenticado respondió arreglo vacío válido; falta cuenta con carpetas. |
| S-11 Etiquetas | parcial | Extracción sin ejecutar JavaScript implementada; A devolvió 10 etiquetas. Falta validar consulta filtrada por `codEtiqueta`. |
| S-12 Alertas | pasa en A | Consulta HTTP autenticada devolvió `listaAlertas=[]`; falta caso no vacío. |
| S-13 Detalle leído | pasa en A | Un Mensaje ya leído (`indTexto=1`) y una Notificación ya leída (`indTexto=3`, JSON anidado válido) respondieron `updateLeido=false`; el estado del listado no cambió. |
| S-14 Efecto de leer | pendiente | Reconsulta acotada de estado implementada y probada en MySQL; falta caso real autorizado y efecto remoto. |
| S-15 Adjuntos | pasa en A para PDF | PDF real de Mensajes con `codArchivo=0` (48 753 bytes) y de Notificaciones con código numérico (87 143 bytes): HTTP 200, MIME PDF, cabecera `%PDF-`, SHA-256 calculado en memoria. |
| S-16 Documento generado | pasa en A | URL exacta del detalle de Notificación: HTTP 200, `text/html`, 16 715 bytes, SHA-256 calculado en memoria; no se registró la URL ni el contenido. |
| S-17 Aislamiento | parcial | Dos sesiones ficticias simultáneas y pruebas de permisos MySQL pasan; falta segunda cuenta real. |
| S-18 Reintentos/idempotencia | parcial | Fixtures y pruebas MySQL pasan; falta fallo remoto real de página/media sesión. |
| S-19 Ritmo/capacidad | parcial | Barrido de 10/5 filas finalizó en menos de un segundo por bandeja; falta cuenta grande y duración de sesión, detalle y descargas por separado. |
| S-20 Compatibilidad | parcial | Parser rechaza HTML/`rows:null` y tipos inválidos; faltan muestras nuevas redactadas. |

## Puertas de activación

- **Prueba de conexión:** cliente y worker implementados; su activación requiere configuración MySQL, Redis y claves de la instalación.
- **Inventario manual:** bloqueado por S-04/S-06 y por pruebas remotas de aislamiento.
- **Lectura/archivos:** código detrás de puertas independientes; S-13/S-15/S-16 pasan en A, pero la puerta A y S-14 siguen pendientes.
- **Cron:** conectado en el worker; bloqueado por S-05 y la puerta de inventario.

Las sondas redactadas `scripts/run-sunat-probe.ps1 -Mode passive-check|relogin-check|logout-check|inventory-check|catalog-check|read-safe-check|expiry-idle|expiry-active` están listas. La de lectura solo abre un elemento ya marcado como leído por bandeja. No imprimen RUC, identificadores de mensajes, asuntos, cookies ni tokens. El [informe de fase A](phase-a-report-2026-09-30.md) contiene la secuencia HTTP y el detalle del cierre fallido.
