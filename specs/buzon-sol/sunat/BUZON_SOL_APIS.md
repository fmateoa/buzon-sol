# Buzón electrónico SOL: servicios observados para una integración

Inspección realizada el **29 de septiembre de 2026 (hora de Lima)** en dos sesiones autorizadas de SUNAT. Se observaron las solicitudes del navegador al abrir ambos buzones, leer mensajes, buscar por asunto, filtrar por etiqueta y descargar un PDF de cada buzón. Los ejemplos omiten RUC, nombres, números de expediente, identificadores reales y valores de sesión.

> **Alcance:** estos son servicios internos usados por la aplicación web, no una API pública documentada ni un contrato estable de SUNAT. Los métodos y formatos se comprobaron en la sesión indicada. No se probó un cliente externo ni una renovación automática de sesión.

## Arquitectura y autenticación observadas

1. El enlace «Buzón electrónico SOL» abre el inicio de sesión en `https://api-seguridad.sunat.gob.pe/v1/clientessol/{id-cliente}/oauth2/loginMenuSol`, con `originalUrl` y `state` en la URL.
2. El formulario envía un `POST` a `.../oauth2/j_security_check`. Se inició sesión mediante la interfaz; no se capturaron ni conservaron las credenciales.
3. El navegador pasa por `https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?...&exe=buzon` y carga el buzón en un `iframe` de `https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/master?hc={valor}&token={valor}`.
4. El `token` de la URL del `iframe` contiene información de la cuenta en formato serializado. Debe tratarse como secreto. También aparece en el `Referer` de peticiones posteriores. No se reproduce aquí.
5. Las llamadas JSON observadas llevan `X-Requested-With: XMLHttpRequest` y `X-RUC: {ruc}`. Su éxito dentro del navegador **no demuestra** que esos encabezados basten fuera de la sesión autenticada. También intervienen el inicio de sesión, el contexto del `iframe` y posiblemente cookies o estado del servidor.

**Conclusión para la integración:** la ruta comprobada es una sesión de navegador autenticada por el usuario. Antes de implementar un cliente HTTP directo hay que validar, con una sesión de prueba y autorización de SUNAT si corresponde, cómo se establece y renueva ese estado. No conviene persistir la contraseña, el token del `iframe`, cookies ni URLs completas que los contengan en logs.

## Secuencia mínima de lectura

```text
Inicio de sesión SOL y carga de /visor/master
  ├─ GET  /visor/ajax/listarCarpetas
  ├─ POST /visor/consultarAlertas
  ├─ GET  /visor/listNotiMenPag?tipoMsj=1|2&...
  ├─ GET  /visor/obtenerDetalleNotiMen?codigoMensaje=...&tipoMsj=...
  ├─ GET  /cl-ti-iagenerador/gendocS01Alias?...  [algunas notificaciones]
  └─ GET  /visor/bajarArchivo/{codArchivo}/0/0/{ruc} [si hay adjunto]
```

Base de los servicios de buzón: `https://ww1.sunat.gob.pe/ol-ti-itvisornoti`. Los dos buzones observados usan `tipoMsj=1` para **Mensajes** y `tipoMsj=2` para **Notificaciones**.

## Catálogo de servicios

### 1. Listar mensajes o notificaciones

`GET /visor/listNotiMenPag`

| Parámetro | Valor observado | Función observada |
|---|---|---|
| `tipoMsj` | `1` o `2` | Mensajes o notificaciones. Quedó vacío al filtrar solo por etiqueta. |
| `codCarpeta` | `00` | Carpeta principal en las vistas de ambos buzones. Quedó vacío en filtro por etiqueta. |
| `codEtiqueta` | vacío o código, por ejemplo `14` | Filtro de etiqueta. |
| `page` | `1` | Número de página solicitado. |
| `des_asunto` | vacío o texto URL codificado | Búsqueda por asunto; se verificó un texto con tilde codificado en UTF-8. |
| `codMensaje` | vacío | Filtro disponible en la petición; su comportamiento con un valor no se probó. |
| `tipoOrden` | `NADA` u otro valor del catálogo inferior | Prioridad de ordenamiento del listado y selección de casillas en la interfaz. |
| `_` | número variable | Parámetro de caché generado por la interfaz. |

Respuesta `200`, `application/json`. Estructura observada:

```json
{
  "estadoRespuesta": null,
  "page": null,
  "startPage": 1,
  "endPage": 6,
  "total": 1,
  "records": 6,
  "rows": [
    {
      "numPag": 0,
      "codMensaje": 123456789,
      "indEstado": 1,
      "indDesta": 0,
      "indUrg": 0,
      "fecVigencia": "2044-12-31 00:00:00.0",
      "indTipmsj": 1,
      "desAsunto": "Asunto de ejemplo",
      "fecEnvio": "12/05/2026",
      "fecPublica": "12/05/2026 19:06:40",
      "codUsremisor": "SUNAT",
      "indTexto": 1,
      "indTipgen": 2,
      "codDepen": "0000",
      "indAviso": 1,
      "cantidadArchAdj": 0,
      "codEtiqueta": "00",
      "indMensaje": 0,
      "codCarpeta": null,
      "numRuc": null
    }
  ]
}
```

`codMensaje` es la clave usada para solicitar el detalle. `cantidadArchAdj` indica el número mostrado de adjuntos; en una notificación con un PDF se observaron **dos** elementos en `listAttach`: uno para el documento generado y otro para el PDF. `desAsunto` puede contener entidades HTML, como `&oacute;`; debe decodificarse para mostrarlo. Las fechas vienen como cadenas locales sin zona horaria explícita.

#### Catálogo del menú de selección por estado

El menú situado junto a «Buscar por asunto» llama a `seleccionarChecks(tipo)`, que vuelve a pedir `listNotiMenPag` con `tipoOrden={tipo}`. El código de la página usa el valor para marcar las casillas correspondientes a las filas visibles. En la primera cuenta, con cinco registros leídos, los ocho valores devolvieron las mismas filas y se comprobó el resultado de las casillas. En una segunda cuenta con miles de registros, `LEIDOS` y `NO_LEIDOS` **también cambiaron el orden de los registros**: por ejemplo, en Mensajes página 1, `NO_LEIDOS` devolvió 25 no leídos y `LEIDOS` devolvió 25 leídos. No son filtros exclusivos: en páginas posteriores ambos modos pueden devolver filas del otro estado y conservar el mismo tamaño total de listado.

| Opción de la web | `tipoOrden` | Condición que usa la interfaz | Casillas marcadas en la prueba |
|---|---|---|---:|
| Todos | `TODOS` | Todas | 5/5 |
| Nada | `NADA` | Ninguna | 0/5 |
| Leídos | `LEIDOS` | `indEstado != 0` | 5/5 |
| No leídos | `NO_LEIDOS` | `indEstado == 0` | 0/5 |
| Destacados | `DESTACADOS` | `indDesta == 1` | 0/5 |
| Sin destacar | `SIN_DESTACAR` | `indDesta != 1` | 5/5 |
| Muy urgentes | `MUY_URGENTES` | `indUrg == 1` | 0/5 |
| No muy urgentes | `NO_MUY_URGENTES` | `indUrg != 1` | 5/5 |

Los cinco registros de la primera prueba tenían `indEstado=1`, `indDesta=0` e `indUrg=0`. La lógica de la página y la segunda cuenta confirman que **`indEstado=0` significa no leído** y cualquier otro valor se trata como leído; `indDesta=1` significa destacado y `indUrg=1` significa muy urgente. No se encontró una fila real con `indDesta=1` o `indUrg=1` para contrastar esas respuestas completas. La selección de casillas opera sobre las filas visibles de la página actual; `tipoOrden=NO_LEIDOS` prioriza los no leídos, pero no devuelve exclusivamente no leídos en todas las páginas.

**No se encontró una acción «Marcar como no leído» en esta versión de la web.** Se revisaron el menú de selección, el menú de acciones tras seleccionar un mensaje y las operaciones del código de la página. «No leídos» selecciona las casillas de registros que ya tienen `indEstado=0`; no cambia su estado. El `POST /visor/actualizarEstado` aparece para los indicadores `urgente` y `destacado`, sin una variante de lectura observada. Por ello no se pudo preparar una notificación leída como no leída mediante la interfaz para probar su transición.

**Precaución de paginación:** en una respuesta se observó `records=3` y **5** elementos en `rows`; en otra, `records=6` y **10** elementos. `total=1` mientras `endPage` tomó `3` o `6`. Por tanto, no se debe interpretar esos contadores como garantía de cantidad real sin más pruebas. Desduplicar por `(indTipmsj, codMensaje)` y recorrer páginas hasta comprobar el fin con datos de prueba de más de una página.

La prueba posterior con una segunda cuenta confirmó el problema a mayor escala; véase «Validación con una segunda cuenta».

### 2. Obtener contenido y metadatos de un mensaje

`GET /visor/obtenerDetalleNotiMen?codigoMensaje={codMensaje}&tipoMsj={1|2}&_={valor}`

Respuesta `200`, `application/json`. Campos observados:

| Campo | Uso / particularidad |
|---|---|
| `msjMensaje` | Contenido. Para mensajes (`indTexto="1"`) se recibió HTML. Para una notificación (`indTexto="3"`) se recibió un **JSON serializado dentro de una cadena**, con datos para generar el documento. |
| `listAttach` | Lista de elementos adjuntos: `codArchivo`, `nomArchivo`, `cntTamarch` (bytes), `tamanoArchivoFormat`, `indMensaje`, `numId`, entre otros. |
| `url` | Ruta relativa del generador de documento. En una notificación incluyó `accion=genhtml`, `iddoc` y `datos` serializados. |
| `codUsuario`, `nombUsuario` | Datos de la cuenta; pueden estar presentes o ser `null`. |
| `indTexto`, `sistema`, `codDepen` | Indicadores del tipo de contenido y dependencia. |
| `countNotiMen`, `codTipos` | Arreglos usados por la interfaz. Se vieron números negativos en `countNotiMen`; no se deduce su semántica. |
| `updateLeido` | Fue `true` al abrir por API un mensaje previamente no leído y `false` al volver a abrirlo una vez leído. Véase la validación de lectura inferior. |

Muchos otros campos del objeto llegaron como `null`: `codMensaje`, `indTipmsj`, `desAsunto`, `codUsremisor`, `indEstado`, `fecEnvio`, `fecLectura`, `fecEliminado`, `fecVigencia`, `objDestino`, `indTipGen`, `fecPublica`, `indAlerta`, `msjAdicional`, `nombreEmisor`, `registroEmisor`, `mailEmisor`, `codTipnotif` e `indAviso`. El cliente debe unir el detalle con la fila del listado usando los parámetros solicitados, sin esperar que el detalle repita todos los metadatos.

Ejemplo **esquemático y ficticio** de `listAttach`:

```json
[
  {"codArchivo": null, "numId": 200150, "indMensaje": "3", "nomArchivo": null},
  {"codArchivo": 123456, "numId": null, "indMensaje": "2", "nomArchivo": "constancia_ejemplo", "cntTamarch": 87143, "tamanoArchivoFormat": "85,1 KB"}
]
```

Para el cuerpo HTML conviene guardar el original y producir una versión de texto mediante un parser HTML. Si se mostrará en una aplicación propia, sanitizar el HTML antes de renderizarlo. El JSON anidado de `msjMensaje` debe tratarse como dato, no como una URL que el cliente construya por su cuenta.

### 3. Descargar archivos adjuntos

`GET /visor/bajarArchivo/{codArchivo}/0/0/{ruc}`

El enlace se obtuvo de la interfaz tras abrir el detalle. En los dos casos probados respondió `200`, `Content-Type: application/pdf` y `Content-Disposition: attachment; filename=...pdf`. Se descargó correctamente un PDF de **Mensajes** y otro de **Notificaciones**.

Dos variantes observadas:

- Notificación: `codArchivo` numérico no nulo proveniente de `listAttach`.
- Mensaje: `codArchivo=0`; la ruta por sí sola no identifica inequívocamente el archivo. Es posible que el servidor use estado asociado al mensaje abierto. Esto **no se ha verificado** y debe probarse antes de construir descargas concurrentes o reintentos independientes.

No se comprobó la descarga de otros formatos, múltiples adjuntos en un mismo mensaje, `Range`, expiración de enlaces ni errores por sesión vencida. El nombre de archivo puede contener RUC y otros identificadores: al almacenarlo, elegir una clave interna propia, conservar el nombre original solo como metadato y validar su ruta.

**Prueba sin sesión:** el 29 de septiembre se solicitó uno de los enlaces desde un contexto de navegador aislado, sin compartir cookies ni estado con la sesión SOL. Respondió `500` con `text/html`, sin entregar el PDF. La misma descarga desde la interfaz autenticada respondió `200` con `application/pdf`. Esto descarta que ese enlace concreto funcionara como descarga pública en la prueba, aunque el servidor no devolvió un código de autorización explícito (`401` o `403`).

### 4. Generar el documento HTML de una notificación

`GET https://ww1.sunat.gob.pe/cl-ti-iagenerador/gendocS01Alias?accion=genhtml&iddoc={id}&datos={json-codificado}`

La `url` relativa viene del detalle y la aplicación la carga en un `iframe`. Se verificó respuesta `200`, `Content-Type: text/html;charset=utf-8`, `Cache-Control: no-cache`. El parámetro `datos` incluye información personal y del documento, por lo que no debe registrarse en texto claro. Este documento HTML es distinto del PDF listado como adjunto. La estructura del HTML no se documenta aquí como contrato estable; para una integración conviene conservar el contenido devuelto junto al cuerpo original del mensaje si se necesita la representación íntegra.

### 5. Servicios auxiliares del buzón

| Solicitud | Resultado observado | Papel |
|---|---|---|
| `GET /visor/ajax/listarCarpetas` | `200`, JSON `[]` en esta cuenta | Carga carpetas propias; se invocó al entrar y tras abrir detalles. |
| `POST /visor/consultarAlertas` | `200`, `{"listaAlertas":[]}` | Consulta de alertas; cuerpo de petición vacío en el caso observado. Se repitió tras cambios de vista. |

La interfaz muestra etiquetas con códigos y permite filtrar el listado. Al seleccionar una etiqueta se observó `codEtiqueta=14` con `tipoMsj` y `codCarpeta` vacíos. No se ejecutaron operaciones de modificación de carpetas, favoritos, impresión, marcado como leído ni eliminación.

## Etiquetas y carpetas

### Etiquetas

Las etiquetas llegan como `listEtiquetas` dentro del HTML/JavaScript de `GET /visor/master`; **no se observó una petición separada para listar etiquetas**. Cada objeto incluye `codEtiqueta`, `descEtiqueta`, `colorEtiqueta` y `cantEtiqueta`, además de campos de estado en cero. Se pulsaron las diez etiquetas y se verificó que todas llamaron a `GET /visor/listNotiMenPag` con `codEtiqueta` igual al código siguiente, `tipoMsj` vacío y `codCarpeta` vacío.

| `codEtiqueta` | Etiqueta | Color observado |
|---|---|---|
| `10` | VALORES | `#ce0d0e` |
| `11` | RESOLUCIONES DE COBRANZA | `#ff9200` |
| `12` | RESOLUCIONES DE FRACCIONAMIENTO | `#00afff` |
| `13` | RESOLUCIONES NO CONTENCIOSAS | `#89bd12` |
| `14` | RESOLUCIONES DE FISCALIZACION | `#00b27e` |
| `15` | NOTIFICACIONES ANTERIORES | `#ff4546` |
| `16` | AVISOS | `#d45aed` |
| `18` | INSPECCION NO INTRUSIVA | `#daf7a6` |
| `19` | REQUERIMIENTOS DIVERSOS | `#ffc857` |
| `20` | CARTAS | `#a0522d` |

El código `17` no apareció en el catálogo observado. `codEtiqueta="00"` sí apareció en mensajes sin etiqueta específica, pero no como elemento del menú. No se encontró en esta interfaz un servicio para crear o modificar etiquetas; parecen asignadas por SUNAT.

### Carpetas

`GET /visor/ajax/listarCarpetas` respondió `[]` en la primera cuenta; «Mis carpetas» quedó vacío. En la segunda cuenta respondió dos objetos: `{"codCarpeta":"03","nomCarpeta":"Ordenes de Pago","cantMensajes":0}` y `{"codCarpeta":"04","nomCarpeta":"Resoluciones de Ejecucion Coactiva","cantMensajes":0}`. El código de la página espera esos tres campos. Al abrir una carpeta, la interfaz llamaría a `GET /visor/listNotiMenPag` con su código en `codCarpeta`. Las carpetas `03` y `04` reciben un tratamiento especial y un icono de candado.

La página también contiene las siguientes operaciones de carpetas. **Solo se inspeccionó su código; no se ejecutaron solicitudes que creen, cambien, muevan o eliminen datos.** Las llamadas `$.ajax` no especifican `type`, por lo que el método previsto por jQuery es `GET`, con parámetros en la URL y encabezado `X-Ruc`.

| Servicio bajo `/visor` | Parámetros preparados por la interfaz | Propósito |
|---|---|---|
| `/ajax/crearCarpeta` | `nom_carpeta`, `tipoMsj` | Crear carpeta. El cliente exige nombre no vacío con letras, números o espacios. |
| `/ajax/modificarCarpeta` | `cod_carpeta`, `nom_carpeta` | Renombrar carpeta. Aplica la misma validación local del nombre. |
| `/ajax/eliminarCarpeta` | `cod_carpeta` | Eliminar carpeta. |
| `/ajax/moverACarpeta` | `cod_carpeta`, `nom_carpeta`, `cod_mensajes`, `tipoMsj` | Mover o copiar mensajes seleccionados. La interfaz restringe los destinos `03` y `04` y los mensajes con etiqueta `10`. |

El manejador de estas operaciones espera JSON con al menos `type` (por ejemplo `SUCCESS`) y `content`. Como no se ejecutaron, faltan por confirmar códigos HTTP, errores y efectos reales. Para sincronizar el buzón en modo lectura solo se necesitan `listarCarpetas` y `listNotiMenPag`.

## Acceso directo y cierre de sesión

- El enlace «Buzón electrónico SOL» de la portada apunta a `https://api-seguridad.sunat.gob.pe/v1/clientessol/{id-cliente}/oauth2/loginMenuSol` con `originalUrl` y `state`. Su **URL completa** fue idéntica antes y después de recargar la portada durante esta prueba.
- Esa URL completa se abrió directamente en un contexto nuevo sin sesión y respondió `200` con los campos RUC, Usuario y Contraseña. Se puede entrar directamente al formulario usando el enlace completo comprobado. No se probó quitar `originalUrl` o `state`, ni se garantiza que el enlace permanezca igual en el futuro.
- El botón «Salir» provocó un `POST https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm` con `action=salir` (precedido por otro `POST` con `action=prevApp`). Después navegó a `.../oauth2/authen` y al formulario `.../oauth2/loginMenuSol`. La URL posterior al cierre añadió `lang`, `showDni` y `showLanguages` y usó otro valor de `state`.
- Tras salir, se intentó abrir de nuevo la URL protegida del menú del buzón. Redirigió al formulario de inicio de sesión; ya no mostró el buzón. Esta prueba valida el cierre desde la interfaz. No se comprobó la invalidez de cada token o cookie por separado.

## Validación con una segunda cuenta

Se consultaron ambos buzones el **29 de septiembre de 2026, hora de Lima**, sin registrar asuntos ni contenido. Esta cuenta permitió medir paginación extensa y probar el efecto de abrir por API mensajes que estaban no leídos.

| Buzón | `records` declarado | `total` declarado | Páginas con filas encontradas | Filas únicas encontradas | Primera página vacía |
|---|---:|---:|---:|---:|---:|
| Notificaciones (`tipoMsj=2`) | 227 | 10 | 10 | 227 | 11 |
| Mensajes (`tipoMsj=1`) | 2681 | 108 | 134 | 3328 | 135 |

Cada página llena devolvió 25 filas. La última página de Notificaciones tuvo 2 y la última de Mensajes tuvo 3. Se recorrieron todas las páginas indicadas y las adicionales hasta la primera vacía, y se desduplicó por `codMensaje`: no hubo duplicados dentro de cada buzón. En Mensajes, detenerse en `total=108` habría omitido **647** mensajes accesibles en las páginas 109–134. Incluso la página 109 respondió `200` con 25 filas mientras indicaba `startPage=2701`, `endPage=2681`, `records=2681` y `total=108`.

En Notificaciones, los 227 registros tenían `indEstado != 0`; no existió una notificación no leída para probar su transición. La lectura por API de una notificación antigua ya leída respondió `200`, `updateLeido=false` y su estado siguió en `1`.

En Mensajes se eligieron **dos registros no leídos de diciembre de 2013**. Para cada uno se hizo `GET /visor/obtenerDetalleNotiMen` con su `codigoMensaje` y `tipoMsj=1`. Ambos detalles devolvieron `updateLeido=true`. Al reconsultar el listado, `indEstado` pasó de `0` a `1`; el cambio no fue inmediato en todas las consultas y apareció tras nuevas lecturas del listado. Al abrir nuevamente uno de ellos, `updateLeido=false`. Por tanto, **consultar el detalle mediante este servicio marca como leído un mensaje no leído**. No se observó un servicio adicional de marcado como leído en esas dos pruebas. La lectura del listado por sí sola no cambió los estados.

`tipoOrden` también afecta el orden de los resultados. En Mensajes página 1, `NO_LEIDOS` devolvió 25 registros no leídos y `LEIDOS` 25 leídos; en página 130, `NO_LEIDOS` devolvió 25 leídos y `LEIDOS` 25 no leídos. Esto prioriza un estado, pero **no limita el conjunto total a ese estado**. Para sincronizar de forma reproducible, fijar `tipoOrden=NADA`, recorrer hasta una página vacía y calcular el estado de cada fila con `indEstado`. Las páginas pueden desplazarse mientras llegan mensajes o se abren detalles, por lo que conviene desduplicar por identificador y repetir la pasada si se necesita una instantánea consistente.

## Modelo de integración recomendado

1. Abrir una sesión SOL en navegador, entrar al buzón y mantener el estado autenticado en ese mismo contexto.
2. Consultar ambos tipos de buzón y las páginas disponibles. Usar `codMensaje` junto con `indTipmsj` como identificador del registro; conservar la respuesta original para auditar cambios del esquema.
3. Solicitar el detalle solo cuando se acepte que un mensaje no leído pase a leído. Unir los metadatos del listado con `msjMensaje`, `listAttach` y `url` del detalle.
4. Descargar cada elemento que tenga un enlace real de descarga; distinguir el documento HTML generado del PDF adjunto. Serializar las descargas cuando `codArchivo=0` hasta verificar su comportamiento.
5. Registrar estado de sincronización propio por mensaje y checksum del archivo. Tratar el listado como consulta de inventario y la lectura de detalle como una operación que puede cambiar estado. Detectar sesión caducada y volver a un flujo de inicio de sesión autorizado.

## Límites de la verificación

- Se observaron dos cuentas y se comprobó paginación extensa en la segunda. No se validaron errores, límites de tasa ni mensajes con varios adjuntos.
- No se pudo observar el cambio de no leído a leído en Notificaciones porque todos sus registros estaban leídos. La prueba positiva de cambio de estado se realizó en Mensajes.
- El flujo de autenticación directa por HTTP, la renovación de tokens y el uso desde un proceso sin navegador no se probaron.
- No se encontró evidencia, en esta inspección, de un endpoint público soportado por SUNAT para este buzón. Los servicios aquí descritos son los usados por su web en la fecha indicada y pueden cambiar sin aviso.
- No se conservan credenciales, tokens, cookies ni archivos descargados en este documento.
