# Fase A · Exploración de login y sesión

**Fecha:** 30/09/2026 (Lima). **Transporte probado:** HTTP directo, PowerShell y Node.js, con una cuenta autorizada A. **Decisión:** `NO_VALIDADO` para inventario productivo y cron; el login HTTP y la prueba de conexión sí funcionan. No se conservaron valores de credenciales, RUC, cookies, tokens ni asuntos.

## Resultados reproducibles

- Desde un jar nuevo, la portada entrega `loginMenuSol` con `originalUrl` y `state`. El formulario `j_security_check` se envía con esos valores y la credencial de prueba. En dos ejecuciones de Node desde jars nuevos, el menú autenticado mostró la marca de cuenta y el visor devolvió `rows[]` en Mensajes y Notificaciones.
- El menú no incluye `/visor/master` en el HTML inicial. Su función `cargaBuzon()` llama a `logoutAndLoad`; se reprodujo `POST MenuInternet.htm` con `action=prevApp` y después `GET MenuInternet.htm?action=buzon&s=ww1`. La redirección entrega la URL del visor con `hc` y `token`, que se mantienen solo en memoria.
- Sin sesión, y tras login antes de pasar por el visor, `listNotiMenPag` responde `200 application/json` con `rows:null`. Después de pedir el HTML de `/visor/master`, ambos listados responden `rows[]`. Por eso `200` y `application/json` solos no verifican inventario.
- En la misma sesión se repitió un listado y un PDF con variantes de encabezados. Sin cookies, el listado no devolvió `rows[]` y el PDF respondió 500; sin `X-Ruc`, `X-Requested-With` o Referer por separado, ambas peticiones siguieron funcionando. La cookie y el paso por el visor resultaron necesarios en A; esos tres encabezados no autenticaron por sí solos.
- El cliente HTTP de Node necesitó el `User-Agent` observado en la sonda PowerShell. Con otro valor, SUNAT devolvió una página corta al completar el callback del menú y la cuenta no quedó autenticada. Este comportamiento se comprobó en la cuenta A; puede variar por entorno.
- El adaptador pide el HTML del visor como datos y no ejecuta JavaScript ni llama a detalle durante inventario. Dos barridos completos de la cuenta A encontraron cero no leídos (10 Mensajes y 5 Notificaciones), de modo que no hay un caso para observar antes/después; S-04 sigue pendiente.
- `POST action=prevApp` seguido de `POST action=salir` devuelve la salida del menú, pero el mismo jar aún obtiene `rows[]` del visor. Se reprodujo además la carga de `iframeAnterior` en `ww1.sunat.gob.pe` y su AJAX `POST /visor/master` con cuerpo `logout`, observado en el JavaScript de esa página; tras ambos pasos el listado siguió accesible. S-06 no pasa. El adaptador descarta todas las cookies locales al cerrar, sin afirmar invalidación remota.
- El adaptador hace un reingreso acotado cuando un listado devuelve HTML o `rows:null`; falta probarlo contra vencimiento real con actividad y sin ella.

## Matriz S-01–S-06

| ID | Estado | Límite |
|---|---|---|
| S-01 | pasa | Enlace y formulario obtenidos dinámicamente; parámetros conservados. |
| S-02 | pasa | Dos logins HTTP de Node desde jars limpios, identidad y ambas bandejas verificados. |
| S-03 | pasa en A | Control anónimo, antes/después del visor y matriz con/sin cookies, `X-Ruc`, XHR y Referer en listado y PDF. |
| S-04 | pendiente | No se solicitó detalle durante inventario; la cuenta A no tiene no leídos para comparar su estado remoto. |
| S-05 | parcial | Hay detección y un reingreso implementados; no hay medición de vencimiento real. |
| S-06 | falla | Tras `prevApp`, iframe, AJAX `logout` y `salir`, el mismo jar mantiene acceso al listado del visor. |

## Backend

`SunatHttpSession` implementa login, cookie jar aislado, redirecciones limitadas a los orígenes SUNAT, acceso al visor, listados de ambas bandejas, reingreso acotado y cierre local. El worker conecta este cliente a pruebas de conexión e inventario. La API y el worker conservan la puerta `SUNAT_TRANSPORT_VALIDATED` para inventario. `SUNAT_CRON_VALIDATED` sigue sin habilitarse. La conexión puede validarse por separado con `SUNAT_CONNECTION_CLIENT_READY`, después de configurar base de datos, Redis y la clave privada de cifrado.

**Verificación local posterior:** la API y el worker pasaron sus pruebas de integración con MySQL/Redis de prueba; el proceso principal del worker arrancó con la capacidad de conexión habilitada. El programador quedó conectado a pasadas cada 30 segundos bajo las puertas `SUNAT_TRANSPORT_VALIDATED` y `SUNAT_CRON_VALIDATED`. Una prueba de dos cuentas simultáneas comprobó que cada sesión usa su propio jar y encabezado de cuenta. Estas pruebas locales no sustituyen las pruebas remotas de S-04–S-06 ni la prueba con una segunda cuenta real.

El adaptador también implementa la lectura explícita, la observación de estado y la obtención de adjuntos/documentos desde una nueva sesión. Para `codArchivo=0`, reabre el detalle y descarga en esa misma sesión. La cuenta A confirmó detalle ya leído en ambas bandejas, PDF con código cero y numérico, y documento HTML generado. El worker conecta lectura y archivos detrás de `SUNAT_READ_VALIDATED` y `SUNAT_FILE_CLIENT_READY`; ambas puertas siguen desactivadas porque S-04/S-06 y el efecto de abrir un no leído siguen sin validarse.

**Pendiente para liberar inventario:** demostrar S-04 con un no leído, resolver S-06, completar S-05 y probar aislamiento con una segunda cuenta real. El barrido HTTP de Node en A llegó a la página vacía confirmada. La sonda [probe-sunat-login.ps1](../../../scripts/probe-sunat-login.ps1) y la prueba [probe-sunat-adapter.ts](../../../scripts/probe-sunat-adapter.ts) emiten evidencia redactada.
