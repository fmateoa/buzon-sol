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
| S-06 | pasa con ventana de gracia | La secuencia completa (`prevApp` → `gettime.pl` → `POST …master?logout` → `salir`) invalida el visor en ≤20 s; las pruebas anteriores omitían `gettime.pl` y quedó sin invalidar. |

## Backend

`SunatHttpSession` implementa login, cookie jar aislado, redirecciones limitadas a los orígenes SUNAT, acceso al visor, listados de ambas bandejas, reingreso acotado y cierre local. El worker conecta este cliente a pruebas de conexión e inventario. La API y el worker conservan la puerta `SUNAT_TRANSPORT_VALIDATED` para inventario. `SUNAT_CRON_VALIDATED` sigue sin habilitarse. La conexión puede validarse por separado con `SUNAT_CONNECTION_CLIENT_READY`, después de configurar base de datos, Redis y la clave privada de cifrado.

**Verificación local posterior:** la API y el worker pasaron sus pruebas de integración con MySQL/Redis de prueba; el proceso principal del worker arrancó con la capacidad de conexión habilitada. El programador quedó conectado a pasadas cada 30 segundos bajo las puertas `SUNAT_TRANSPORT_VALIDATED` y `SUNAT_CRON_VALIDATED`. Una prueba de dos cuentas simultáneas comprobó que cada sesión usa su propio jar y encabezado de cuenta. Estas pruebas locales no sustituyen las pruebas remotas de S-04–S-06 ni la prueba con una segunda cuenta real.

El adaptador también implementa la lectura explícita, la observación de estado y la obtención de adjuntos/documentos desde una nueva sesión. Para `codArchivo=0`, reabre el detalle y descarga en esa misma sesión. La cuenta A confirmó detalle ya leído en ambas bandejas, PDF con código cero y numérico, y documento HTML generado. El worker conecta lectura y archivos detrás de `SUNAT_READ_VALIDATED` y `SUNAT_FILE_CLIENT_READY`; ambas puertas siguen desactivadas porque S-04/S-06 y el efecto de abrir un no leído siguen sin validarse.

**Pendiente para liberar inventario:** demostrar S-04 con un no leído, resolver S-06, completar S-05 y probar aislamiento con una segunda cuenta real. El barrido HTTP de Node en A llegó a la página vacía confirmada. La sonda [probe-sunat-login.ps1](../../../scripts/probe-sunat-login.ps1) y la prueba [probe-sunat-adapter.ts](../../../scripts/probe-sunat-adapter.ts) emiten evidencia redactada.

## Mediciones posteriores (30/09/2026, cuenta A, redactadas)

- **S-05:** con una sola sesión de A abierta, 35 min inactiva: 1 respuesta de sesión vencida y 1 reingreso correcto (2 logins). 35 min con un listado por minuto: 1 login, 0 vencimientos.
- **S-06:** tras la salida observada, la petición protegida capturada (repetida cada minuto) siguió devolviendo `rows[]` 40 min. Sigue en falla; producción permanece cerrada hasta demostrar invalidación remota o aceptar explícitamente el riesgo.
- **S-09/S-11:** ver matriz de estado. Las consultas por etiqueta mezclan bandejas.
- **S-19/S-20:** tiempos y esquema en la matriz de estado; sin valores reales.
- El nombre de archivo de `Content-Disposition` se extrajo en vivo para ambos adjuntos (`filenamePresent: true`).

## Cuenta B (grande), 30/09/2026

- Un primer guardado de la credencial fue rechazado por SUNAT (POST `j_security_check` → `/oauth2/error`); el adaptador ahora lo clasifica `invalid_credential`. Tras corregir los datos, el login entró y no se reintentó en bucle.
- Inventario completo, catálogo, S-04 pasivo, esquema, etiquetas, capacidad, archivos y detalle de ítems ya leídos: ver matriz de estado.
- S-14 sigue abierto: hay 3684 ítems sin leer, pero abrir uno es irreversible (`0→1`) y requiere elegirlo y confirmarlo antes.
- S-17 pasa: `isolation-check -Names A,B` abrió ambas cuentas a la vez y cada una mantuvo su propia huella en tres rondas paralelas.

## Cierre de S-06 y S-14 (30/09/2026, cuenta B)

- **S-06:** el cierre previo era incompleto: faltaba la llamada a `/time/gettime.pl` que el menú hace con la ruta devuelta por `prevApp`. Con la secuencia completa el acceso se pierde a los 20 s (visible a los 14 s en tres ejecuciones). `close()` del adaptador la ejecuta y hay una prueba unitaria con el orden de las cuatro llamadas.
- **Colisión:** `collision-check` abrió dos sesiones de B, cerró la primera y abrió una tercera de inmediato: las tres funcionaron de forma independiente.
- **S-14:** un Mensaje sin leer pasó de 0 a 1 tras `obtenerDetalleNotiMen`; visible a la segunda consulta (~10 s). La intención quedó anunciada antes de abrirlo.
- Un nombre de cookie con una cifra de 11 dígitos apareció en una salida de diagnóstico; corresponde al `randomCookie` del navegador, no confirmado como distinto del RUC; las sondas ahora enmascaran dígitos largos en nombres de cookie.
