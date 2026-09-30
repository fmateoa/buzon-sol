# SDD · Contrato observado de SUNAT Buzón SOL

**Naturaleza del documento:** contrato empírico del navegador, no documentación oficial de SUNAT. Distinguir **confirmado por red** de **solo presente en el código de la web**. Evidencia completa: [BUZON_SOL_APIS.md](BUZON_SOL_APIS.md).

## 1. Orígenes y sesión

| Origen | Papel |
|---|---|
| `https://www.sunat.gob.pe` | Portada y enlace «Buzón electrónico SOL». |
| `https://api-seguridad.sunat.gob.pe` | Formulario SOL y autenticación. |
| `https://e-menu.sunat.gob.pe` | Menú autenticado, entrada al buzón y salida. |
| `https://ww1.sunat.gob.pe` | Visor, listados, detalles, documentos y descargas. |

El enlace de portada usa `GET /v1/clientessol/{id-cliente}/oauth2/loginMenuSol?originalUrl={...}&state={...}`. La URL completa fue estable en dos cargas de la portada y abrió el formulario en un contexto sin sesión. Tras salir, el sistema mostró otra URL del mismo formulario con más parámetros y distinto `state`. Conservar el enlace completo; no deducir ni regenerar `state`.

El formulario envía `POST .../oauth2/j_security_check`. No se almacena la contraseña en este contrato. El menú carga el visor en `/ol-ti-itvisornoti/visor/master?hc={secreto}&token={secreto}`. `token` y el `Referer` que lo contiene son secretos de sesión. Las peticiones JSON observadas incluyeron `X-Ruc` y `X-Requested-With: XMLHttpRequest`. El login y ambas listas funcionan con un cliente HTTP independiente del navegador desde un jar limpio.

**Revisión del 30/09/2026, sin registrar secretos:** una consulta HTTP pública del formulario devolvió `200`, encabezados `Set-Cookie` y un formulario `POST` con acción relativa `j_security_check`. El JavaScript de envío copia RUC, usuario y contraseña a campos ocultos; también contempla un campo `captcha` cuando se presenta ese desafío. La cuenta autorizada A completó el login desatendido por HTTP en PowerShell y Node.js.

**Control negativo HTTP del 30/09/2026:** `GET /visor/listNotiMenPag` sin sesión devolvió `200`, `application/json` y `rows:null`, tanto sin encabezados adicionales como con `X-Requested-With: XMLHttpRequest`. No se utilizó RUC. Esto confirma que `200` y JSON válido por sí solos no prueban autenticación; el consumidor debe exigir `rows` como arreglo y verificar la cuenta antes de aceptar un inventario. La presencia del campo oculto `captcha` en el HTML no demuestra que haya un desafío activo.

**Prueba HTTP autorizada del 30/09/2026:** con cookie jar nuevo, el `POST j_security_check` redirigió a `e-menu.sunat.gob.pe` y terminó en `200` sin volver al formulario. El HTML final contenía la marca de la cuenta usada, comprobada sin imprimirla. Sin pasar por `/visor/master`, `listNotiMenPag` siguió respondiendo `200 application/json` con `rows:null` incluso con `X-Requested-With` y `X-Ruc`. Tras seguir la navegación del menú y pedir el HTML del visor, Mensajes y Notificaciones devolvieron `rows[]`. Esta secuencia se repitió dos veces con el adaptador de Node desde jars nuevos.

El menú final tiene `exe=buzon`, pero su HTML no incluye una URL completa de `/visor/master`: se observaron seis iframes sin atributo `src`. `cargaBuzon()` llama a `logoutAndLoad(...)`; `POST action=prevApp` seguido de `GET action=buzon&s=ww1` entrega una redirección a la URL exacta del visor. No se fabrican `hc` ni `token`. La salida sigue sin validarse: `prevApp`/`salir` no invalidó el listado del visor en el mismo jar.

Al entrar en el visor, la web observada pidió el listado y luego abrió automáticamente el detalle del primer registro. Esa llamada puede cambiar un no leído a leído; por tanto el simple acceso a la interfaz no está demostrado como pasivo.

Base de endpoints de visor: `https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor`.

## 2. Servicios de consulta confirmados

### C-01 · Inventario paginado

`GET /listNotiMenPag`

| Parámetro | Tipo | Uso comprobado |
|---|---|---|
| `tipoMsj` | cadena `"1"`, `"2"` o vacía | `1` Mensajes; `2` Notificaciones; vacío al navegar por etiqueta. |
| `codCarpeta` | cadena | `"00"` bandeja principal; vacío al navegar por etiqueta; códigos de carpeta desde `listarCarpetas`. |
| `codEtiqueta` | cadena | Vacía sin filtro; código del catálogo al seleccionar etiqueta. |
| `page` | entero positivo codificado como texto | Página de 25 filas en las cuentas observadas. |
| `des_asunto` | texto URL codificado | Búsqueda por asunto. Se observó UTF-8. |
| `codMensaje` | texto | Vacío en las consultas vistas; semántica con valor no probada. |
| `tipoOrden` | código | Orden de servidor y selección de casillas; usar `NADA` para inventario base. |
| `_` | número variable | Evita caché en la web. Puede generarse un valor nuevo por petición. |

Respuesta confirmada: `200`, `application/json`:

```json
{
  "estadoRespuesta": null,
  "page": null,
  "startPage": 1,
  "endPage": 25,
  "total": 108,
  "records": 2681,
  "rows": [
    {
      "codMensaje": 123456789,
      "indTipmsj": 1,
      "indEstado": 0,
      "indDesta": 0,
      "indUrg": 0,
      "desAsunto": "Asunto ficticio",
      "fecEnvio": "29/09/2026",
      "fecPublica": "29/09/2026 18:23:54",
      "fecVigencia": "2044-12-31 00:00:00.0",
      "codUsremisor": "SUNAT",
      "indTexto": 1,
      "indTipgen": 2,
      "codDepen": "0000",
      "indAviso": 1,
      "cantidadArchAdj": 0,
      "codEtiqueta": "00",
      "indMensaje": 0,
      "codCarpeta": null,
      "numRuc": null,
      "numPag": 0
    }
  ]
}
```

El ejemplo es ficticio. Los campos pueden venir `null`; el consumidor debe conservar campos desconocidos. `desAsunto` puede contener entidades HTML. `fecPublica` no expresa zona horaria. Para mostrar fechas usar el texto original o una interpretación local explícita; no asignar UTC silenciosamente.

**Semántica de estado confirmada:** `indEstado=0` no leído; la web trata `indEstado!=0` como leído. `indDesta=1` destacado; `indUrg=1` muy urgente. No se observó una fila destacada o urgente real para probar todos sus valores.

**Paginación observada:** Notificaciones: 227 filas únicas, 10 páginas con datos y página 11 vacía; `records=227`, `total=10`. Mensajes: 3328 filas únicas, 134 páginas con datos y página 135 vacía, aunque `records=2681`, `total=108`. La página 109 de Mensajes aún devolvió 25 filas y reportó `startPage=2701`, `endPage=2681`. Por tanto `total`, `records` y `endPage` no son condiciones de corte fiables. Una página fuera de rango respondió `200` con `rows=[]`.

### C-02 · Detalle

`GET /obtenerDetalleNotiMen?codigoMensaje={id}&tipoMsj={1|2}&_={valor}`

Respuesta confirmada: `200`, `application/json`. Campos relevantes:

| Campo | Forma observada | Tratamiento |
|---|---|---|
| `msjMensaje` | cadena con HTML (`indTexto="1"`) o JSON serializado como cadena (`indTexto="3"`) | Conservar original; normalizar según indicador. |
| `indTexto` | cadena | Discriminador del contenido. Otros valores no probados. |
| `listAttach` | arreglo | Puede contener documento generado y archivos; no equiparar su longitud con `cantidadArchAdj`. |
| `url` | ruta relativa | En una notificación apuntó al generador HTML. |
| `updateLeido` | booleano | `true` al abrir dos Mensajes previamente no leídos; `false` al reabrir leído o abrir Notificación ya leída. |
| `countNotiMen`, `codTipos` | arreglos | Usados por la web; aparecieron números negativos, semántica no adoptada. |
| `codUsuario`, `nombUsuario`, `codDepen`, `sistema` | datos de cuenta/documento | Pueden ser sensibles o nulos. |

El detalle **no** repite de forma confiable `codMensaje`, `desAsunto`, `fecPublica` ni `indEstado`: llegaron `null` en ejemplos. Unirlo a la fila solicitada mediante `(tipoMsj, codigoMensaje)`.

**Efecto secundario confirmado en Mensajes:** una llamada de detalle cambió `indEstado` de `0` a `1` en dos casos de 2013; el listado tardó algunas consultas en reflejarlo. No hubo una Notificación no leída disponible para probar ese cambio, por lo que el consumidor debe tratar la lectura de cualquier detalle como potencialmente modificadora.

### C-03 · Carpetas

`GET /ajax/listarCarpetas`

Respuesta confirmada: `200`, JSON. La primera cuenta devolvió `[]`; la segunda devolvió:

```json
[
  {"codCarpeta":"03","nomCarpeta":"Ordenes de Pago","cantMensajes":0},
  {"codCarpeta":"04","nomCarpeta":"Resoluciones de Ejecucion Coactiva","cantMensajes":0}
]
```

El código de la web usa `codCarpeta` en `listNotiMenPag` al abrir una carpeta. Los códigos `03` y `04` se presentan con candado. No se validó una carpeta creada por el usuario con mensajes reales.

### C-04 · Alertas

`POST /consultarAlertas`, cuerpo vacío en la prueba. Respuesta observada: `200`, `{"listaAlertas":[]}`. Es auxiliar; su ausencia no impide inventariar filas, pero cualquier alerta recibida debe conservarse para diagnóstico antes de decidir acciones.

### C-05 · Descarga

`GET /bajarArchivo/{codArchivo}/0/0/{ruc}`

En dos pruebas autenticadas respondió `200`, `Content-Type: application/pdf` y `Content-Disposition: attachment; filename=...pdf`. Desde un contexto aislado sin sesión, un enlace respondió `500`, `text/html`, sin PDF. No asumir descarga pública.

| Variante | Dato observado | Consecuencia |
|---|---|---|
| Notificación | `codArchivo` numérico de `listAttach` | Puede asociarse al mensaje y adjunto. |
| Mensaje | `codArchivo=0` | La URL no distingue por sí sola el archivo; serializar apertura de detalle y descarga por cuenta hasta verificar el mecanismo. |

Campos observados por elemento de `listAttach`: `codArchivo`, `nomArchivo`, `nomAdjunto`, `cntTamarch` (bytes), `tamanoArchivoFormat`, `numId`, `indMensaje`, `numEcm`. La presencia de `codArchivo=null` y `numId` no nulo correspondió a un documento generado, no al PDF descargable del ejemplo.

### C-06 · Documento HTML generado

`GET https://ww1.sunat.gob.pe/cl-ti-iagenerador/gendocS01Alias?accion=genhtml&iddoc={id}&datos={json-codificado}`

La ruta completa procede del campo `url` del detalle y puede incluir datos personales en `datos`. Respuesta observada: `200`, `text/html;charset=utf-8`, `Cache-Control: no-cache`. No construir la URL con campos inferidos ni registrarla entera.

## 3. Catálogos

### Tipos y estados

| Campo | Código | Significado observado |
|---|---|---|
| `tipoMsj` | `1` | Mensajes |
| `tipoMsj` | `2` | Notificaciones |
| `indEstado` | `0` | No leído |
| `indEstado` | distinto de `0` | Leído según la web |
| `indDesta` | `1` | Destacado |
| `indUrg` | `1` | Muy urgente |

### Etiquetas

El catálogo `listEtiquetas` está integrado en el HTML/JavaScript de `GET /master`; no se observó un endpoint separado para listarlo. Cada enlace de etiqueta envió `GET /listNotiMenPag` con `codEtiqueta` y con `tipoMsj` y `codCarpeta` vacíos.

| Código | Nombre | Color |
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

`codEtiqueta="00"` apareció en filas sin etiqueta específica. El código `17` no apareció. El catálogo puede variar; el adaptador debe preferir la fuente viva y conservar códigos desconocidos.

### `tipoOrden`

| Código | Opción | Condición de casilla en la web |
|---|---|---|
| `TODOS` | Todos | Todas |
| `NADA` | Nada | Ninguna |
| `LEIDOS` | Leídos | `indEstado!=0` |
| `NO_LEIDOS` | No leídos | `indEstado==0` |
| `DESTACADOS` | Destacados | `indDesta==1` |
| `SIN_DESTACAR` | Sin destacar | `indDesta!=1` |
| `MUY_URGENTES` | Muy urgentes | `indUrg==1` |
| `NO_MUY_URGENTES` | No muy urgentes | `indUrg!=1` |

Además de marcar casillas en la interfaz, `LEIDOS` y `NO_LEIDOS` reordenaron filas en una cuenta con estados mezclados. **No son filtros exclusivos**: en la página 130 `NO_LEIDOS` devolvió 25 leídos y `LEIDOS` 25 no leídos. Para un filtro exacto, usar `indEstado` localmente.

## 4. Salida y operaciones no incluidas

**Salida confirmada:** el botón «Salir» envió `POST https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm` con `action=salir` después de `action=prevApp`, y devolvió al formulario. Reabrir el menú protegido volvió a pedir login.

**Solo detectados en el código, sin ejecutar:** `GET /ajax/crearCarpeta`, `/ajax/modificarCarpeta`, `/ajax/eliminarCarpeta`, `/ajax/moverACarpeta` (método por defecto de `$.ajax`, no comprobado en red); `POST /actualizarEstado` para `urgente` y `destacado`. No se encontró una acción «Marcar como no leído» en la interfaz inspeccionada. Estos servicios no son dependencia del lector en modo consulta.

## 5. Respuestas que deben considerarse errores

- HTML de login cuando se esperaba JSON: sesión vencida o no autenticada.
- `200` con JSON sin `rows` de tipo arreglo en `listNotiMenPag`: puede ser una respuesta sin sesión (control negativo observado con `rows:null`), contrato cambiado o respuesta defectuosa; no equivale a página vacía.
- `200` con `rows=[]` en una página: candidato a final; confirmar según la política de paginación del diseño.
- `500`/HTML en descarga o `Content-Type` incompatible: descarga fallida; no crear archivo válido.
- `updateLeido=true` sin cambio inmediato en el siguiente listado: esperar y reconciliar, no asumir que falló al primer intento.
