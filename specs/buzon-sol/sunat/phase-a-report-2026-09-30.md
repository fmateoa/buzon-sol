# Fase A · Exploración de login y sesión

**Fecha:** 30/09/2026 (Lima). **Entorno:** Windows, PowerShell 7, cliente HTTP directo. **Cuenta de prueba:** una cuenta autorizada, anonimizada como A; el control inicial no usó cuenta. **Decisión de transporte:** `NO_VALIDADO`.

## Evidencia nueva

- La portada pública respondió `200` y presentó el enlace `loginMenuSol` con `originalUrl` y `state` no vacíos. Se abrió con un cookie jar nuevo; el formulario respondió `200` sin redirecciones observadas.
- El formulario declara `POST j_security_check`. Se observaron los nombres de campos `tipo`, `dni`, `custom_ruc`, `j_username`, `j_password`, `captcha`, `originalUrl`, `lang`, `state`, `params` y `exe`. El campo `captcha` es oculto; su presencia no confirma un desafío activo.
- Sin sesión, `GET listNotiMenPag` respondió `200 application/json` con `rows:null` en dos variantes: sin encabezados adicionales y con `X-Requested-With`. Ninguna respuesta satisface el contrato de inventario (`rows` arreglo).
- Con la cuenta A y un jar nuevo, `POST j_security_check` produjo redirecciones `302` desde el origen de seguridad hacia `e-menu.sunat.gob.pe`, donde terminó en `200`. No volvió al formulario y el HTML final contenía la marca de la cuenta, comprobada sin imprimir su valor.
- Antes de pedir `/visor/master`, el listado con el mismo jar devolvió `rows:null` en las tres variantes: sin encabezados, con `X-Requested-With` y con `X-Requested-With` más `X-Ruc`. La sesión en el menú no basta para aceptar inventario desde esa ruta. Falta probar el visor y descartar otras dependencias.
- Una segunda ejecución desde jar limpio repitió el login hasta el menú y los tres `rows:null`. La búsqueda de una URL completa de `/visor/master` en el HTML final no encontró ninguna. Se añadió un diagnóstico redactado de iframes y scripts para localizar cómo el menú construye esa navegación; todavía no se ha ejecutado con la cuenta.
- Una tercera ejecución repitió el mismo resultado. El menú final tenía `exe=buzon`, seis iframes sin `src` y ningún texto `/visor/master` ni `itvisornoti` en el HTML. El origen `ww1.sunat.gob.pe` sí apareció en el HTML y se cargaron scripts del menú; el siguiente paso es inspeccionar su ruta y lógica de navegación sin conservar valores de sesión.
- Una cuarta ejecución reprodujo lo anterior y permitió ubicar el script estático `/a/js/improvePluginBandeja.js` del menú. Una lectura pública de ese script mostró llamadas `postMessage` al `iframeApplication`, pero no la URL ni la asignación de `src` del visor. La sonda ahora extrae solo identificadores de líneas relevantes de los scripts inline para localizar esa lógica sin exponer valores de sesión.
- Una quinta ejecución mostró en los scripts inline los identificadores `cargaBuzon2`, `cargaBuzon` y `iframeApplication.attr(url)`. Esto apunta a una navegación posterior al HTML inicial. La sonda incorpora extractos estructurales con cadenas y números largos eliminados para identificar la llamada que produce `url`.
- La sonda reproducible está en [probe-sunat-login.ps1](../../../scripts/probe-sunat-login.ps1). Sin `-Auth`, solo emite estados, orígenes, nombres de parámetros y campos, nombres de cookies y forma de `rows`. Con `-Auth`, solicita RUC, usuario y Clave SOL mediante entrada oculta, prueba el POST y tres variantes de listado con el mismo jar, y emite únicamente evidencia redactada. La rama autenticada aún no se ha ejecutado ni validado con una cuenta real. La sonda no guarda HTML, valores de cookies, credenciales ni respuestas del buzón.

## Matriz S-01–S-06

| ID | Estado | Evidencia y límite |
|---|---|---|
| S-01 | pasa | Enlace y formulario comprobados; POST HTTP llegó al menú con cuenta A y secuencia de redirecciones registrada sin valores sensibles. |
| S-02 | pendiente | Dos logins HTTP desde jars limpios llegaron al menú, pero el listado previo a `/visor/master` devolvió `rows:null`; faltan visor y ambas bandejas. |
| S-03 | pendiente | Controles sin sesión y con sesión antes de `/visor/master` realizados; faltan comparaciones tras el visor y prueba de descargas. |
| S-04 | pendiente | No se abrió el visor ni se pidió detalle. Falta observar un no leído autorizado antes y después. |
| S-05 | pendiente | Requiere sesión autenticada y observación temporal. |
| S-06 | pendiente | Requiere sesión autenticada para probar `prevApp`/`salir` y la invalidez posterior. |

## Próxima prueba controlada

Con la cuenta A, probar `GET /visor/master` como HTML, sin ejecutar JavaScript, y repetir el listado con el mismo jar para S-02/S-03. La sonda ya incorpora ese paso cuando encuentra la URL exacta en el menú. Después repetir desde un jar limpio, medir S-04 sin solicitar detalle y probar S-06 con el mismo jar. No activar cron ni cambiar las puertas del frontend hasta superar los criterios del plan. Si aparece CAPTCHA, registrar `requiere_intervencion` y detener el login desatendido.
