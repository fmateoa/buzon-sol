# Plan independiente · Integración con SUNAT Buzón SOL

**Propósito:** validar y construir el adaptador que extrae datos del Buzón SOL para la aplicación v2. Este plan cubre la frontera SUNAT y sus pruebas con cuentas autorizadas; [01-backend.md](01-backend.md) cubre API, worker, base de datos, colas y almacenamiento. Los servicios son **internos de la web**, no una API pública ni un contrato estable.

## Fuentes y regla de evidencia

- [Contrato observado](../sunat/contracts.md): endpoints, parámetros, respuestas, catálogos, estados y límites conocidos. Es la referencia primaria para cada prueba.
- [Exploración original](../sunat/BUZON_SOL_APIS.md): tráfico observado con Playwright en dos cuentas, paginación real, efecto de lectura, adjuntos y salida. **Playwright se usó para explorar; su uso en producción no está decidido.**
- [Diseño del lector v1](../legacy/design.md) §2–§7: algoritmo de paginación, separación Inventario/Lectura y recuperación. Sus elecciones de navegador/SQLite pertenecen a la v1.
- [Requisitos de producto v2](../product/requirements.md) F1–F6 y P-03; [spec backend](../backend/spec.md) §4 y §6: alcance multiusuario, programador y puertas G-01–G-04.

Toda prueba distingue **confirmado previamente**, **confirmado en cliente HTTP**, **confirmado solo en navegador** y **pendiente/no probado**. Una respuesta `200` aislada no valida la sesión completa: comprobar tipo de contenido, estructura, cuenta y efecto remoto. No guardar secretos, RUC, asuntos, cuerpos ni documentos reales en fixtures, HAR, capturas o logs compartibles.

## Estrategia de transporte

1. **Primera opción: cliente HTTP directo** con cookie jar nuevo por cuenta y ejecución. Obtener el enlace completo de la portada; conservar `originalUrl` y `state` recibidos, sin inventarlos. Enviar el formulario `j_security_check` con los campos y cookies de esa misma sesión, seguir redirecciones y comprobar menú, visor y listados. Tratar el HTML de `/visor/master` como datos; no ejecutar su JavaScript.
2. Si falla, identificar la dependencia concreta (por ejemplo JavaScript, estado de iframe, encabezado, desafío interactivo o token de servidor). **No deducir que Playwright es obligatorio** solo porque la web lo use.
3. Incorporar Playwright al worker únicamente si la prueba demuestra esa dependencia y si supera los mismos criterios de aislamiento, inventario pasivo, reingreso y salida. Un CAPTCHA u otra intervención humana se reporta como `requiere_intervencion`; no se automatiza su resolución.

La decisión de transporte se registra con evidencia redactada: `HTTP_VALIDADO`, `NAVEGADOR_REQUERIDO` o `NO_VALIDADO`. Hasta entonces, cron real permanece desactivado. Las credenciales se entregan al proceso de prueba mediante un mecanismo local protegido; jamás por argumentos de línea de comandos, archivos de fixture, mensajes de chat o logs.

## Fase A · Login, sesión y efecto del arranque

| ID | Prueba | Criterio de aceptación y evidencia | Referencia |
|---|---|---|---|
| S-01 Enlace y formulario | Obtener desde la portada el enlace «Buzón electrónico SOL» y abrirlo con cookie jar nuevo. Registrar solo orígenes, secuencia de redirecciones, nombres de campos y presencia de desafío; comprobar `GET loginMenuSol` y `POST j_security_check`. | El formulario se obtiene y los parámetros `originalUrl`/`state` se conservan tal como llegaron. No fijar una URL completa como constante permanente. | [Contrato §1](../sunat/contracts.md#1-orígenes-y-sesión); [exploración, acceso directo](../sunat/BUZON_SOL_APIS.md#acceso-directo-y-cierre-de-sesión). |
| S-02 Login desatendido HTTP | Con cuenta de prueba autorizada, iniciar sesión **sin navegador**. Verificar redirección al menú, identidad de cuenta sin imprimirla y acceso a JSON de `listNotiMenPag` en Mensajes y Notificaciones usando el mismo cookie jar. Repetir desde jar limpio. | Dos ejecuciones completas y aisladas; ningún HTML de login se acepta como JSON. Registrar si se exige CAPTCHA o intervención. Un login manual exitoso **no** satisface S-02. | [Contrato §1–2](../sunat/contracts.md#1-orígenes-y-sesión); [backend G-01](../backend/spec.md#6-puertas-de-validación-con-sunat). |
| S-03 Dependencias de sesión | Comparar, sin divulgar valores, respuestas con/sin cookies, con/sin encabezados observados (`X-Ruc`, `X-Requested-With`) y con/sin paso por `/visor/master`. Identificar el conjunto mínimo que realmente autentica listados y descargas. | Se documenta si basta HTTP y qué estado se obtiene del servidor; no copiar tokens de un navegador como solución de producción ni asumir que los encabezados autentican por sí solos. | [Contrato §1](../sunat/contracts.md#1-orígenes-y-sesión); [exploración, arquitectura](../sunat/BUZON_SOL_APIS.md#arquitectura-y-autenticación-observadas). |
| S-04 Arranque pasivo | Con un primer ítem no leído de prueba, observar estado antes/después del login y de obtener `/visor/master`. En HTTP, pedir HTML sin ejecutar scripts; en alternativa Playwright, interceptar `obtenerDetalleNotiMen` **antes** de cargar el visor y comprobar que el listado sigue accesible. | Inventario no emite detalle y conserva el estado remoto. Si no se logra, registrar el efecto y bloquear el copy «sin efecto en SUNAT»; decidir explícitamente si el producto acepta esa limitación. | [Contrato §1](../sunat/contracts.md#1-orígenes-y-sesión); [backend G-02](../backend/spec.md#6-puertas-de-validación-con-sunat). |
| S-05 Vencimiento y reingreso | Medir tiempo hasta que un servicio autenticado deje de responder correctamente, con actividad y sin ella, sin asumir una duración fija. Probar detección de redirección/login/HTML, nuevo login y reanudación desde página pendiente. | Distinguir sesión vencida, credencial rechazada, CAPTCHA y caída temporal. Reintentos acotados; no declarar un buzón vacío. Duración observada y condiciones de prueba quedan registradas, sin presentar una garantía general. | [Contrato §5](../sunat/contracts.md#5-respuestas-que-deben-considerarse-errores); [producto F6](../product/requirements.md#2-flujos-funcionales). |
| S-06 Salida | En el mismo jar, ejecutar la secuencia observada `prevApp`/`salir` cuando corresponda. Probar otra petición protegida con ese jar y validar que vuelve al login o pierde acceso. Descartar jar/contexto local. | La sesión no permite continuar consultas tras salir. No confundir cerrar el proceso con invalidación remota. | [Contrato §4](../sunat/contracts.md#4-salida-y-operaciones-no-incluidas); [exploración, salida](../sunat/BUZON_SOL_APIS.md#acceso-directo-y-cierre-de-sesión). |

**Puerta A:** S-02, S-04 y S-06 deben pasar en el transporte elegido antes de programar consultas reales. S-05 debe dar una política comprobable de recuperación. Si hay CAPTCHA no automatizable, el sistema necesita un estado de intervención humana y no puede prometer operación continua desatendida.

## Fase B · Inventario y catálogos sin abrir contenido

| ID | Servicio / prueba | Criterio de aceptación y evidencia | Referencia |
|---|---|---|---|
| S-07 Listados de ambas bandejas | `GET /visor/listNotiMenPag` con `tipoMsj=1` y `2`, `codCarpeta=00`, `codEtiqueta` vacío y `tipoOrden=NADA`. Validar `rows[]`, campos nulos, `indTipmsj`, `codMensaje`, fechas raw y `indEstado`. | Listado autenticado por cuenta; no se llama a detalle. `indEstado=0` clasifica no leído; otro valor se conserva y se muestra leído según la web. | [Contrato C-01](../sunat/contracts.md#c-01--inventario-paginado); [exploración, segunda cuenta](../sunat/BUZON_SOL_APIS.md#validación-con-una-segunda-cuenta). |
| S-08 Paginación completa | Recorrer `page=1…` hasta página `200` JSON con `rows=[]`, repetir esa página para confirmar, deduplicar y guardar checkpoint. Probar fixture de 134 páginas con filas y página 135 vacía; también error, HTML y vacío transitorio. | 3328 Mensajes pese a `total=108`/`records=2681`; 227 Notificaciones en 10 páginas más la 11 vacía. Ningún contador declarado corta el barrido. Una ejecución parcial no reemplaza el total verificado. | [Contrato C-01](../sunat/contracts.md#c-01--inventario-paginado); [diseño v1 §3](../legacy/design.md#3-algoritmo-de-paginación). |
| S-09 Búsqueda y selección de estados | `des_asunto` con texto URL codificado; verificar `tipoOrden` (`NADA`, `LEIDOS`, `NO_LEIDOS`, destacados/urgentes) solo en el alcance necesario para consulta. | No tratar `LEIDOS`/`NO_LEIDOS` como filtros exclusivos: el filtro exacto se aplica localmente sobre `indEstado`. No prometer búsqueda remota por fecha. | [Contrato §3, tipoOrden](../sunat/contracts.md#tipoorden); [exploración, segunda cuenta](../sunat/BUZON_SOL_APIS.md#validación-con-una-segunda-cuenta). |
| S-10 Carpetas | `GET /visor/ajax/listarCarpetas`; probar `[]` y registros con código/nombre/cantidad. Si una cuenta autorizada tiene carpeta con contenido, validar `codCarpeta` en `listNotiMenPag`. | Catálogo por cuenta sin asumir carpetas fijas. Crear, mover o borrar no forma parte de esta integración. | [Contrato C-03](../sunat/contracts.md#c-03--carpetas). |
| S-11 Etiquetas | Extraer `listEtiquetas` de `GET /visor/master` sin ejecutar scripts; validar códigos/nombres/colores y consulta con `codEtiqueta`, dejando `tipoMsj`/`codCarpeta` vacíos como observó la web. | Catálogo dinámico, códigos desconocidos preservados y sin suponer endpoint separado. Si falla la extracción, el inventario base continúa y el catálogo se marca no disponible. | [Contrato §3, etiquetas](../sunat/contracts.md#etiquetas). |
| S-12 Alertas auxiliares | `POST /visor/consultarAlertas` en sesión autorizada y con cuerpo observado. | Validar forma `listaAlertas`; error no invalida el inventario. No inventar semántica para alertas no observadas. | [Contrato C-04](../sunat/contracts.md#c-04--alertas). |

**Puerta B:** S-07/S-08 deben funcionar por HTTP o por la alternativa justificada. S-09/S-12 no bloquean el inventario base si fallan de forma explícita. S-10/S-11 se validan para presentar carpetas y etiquetas. Repetir el inventario no debe crear duplicados ni cambiar estados de lectura.

## Fase C · Lectura explícita y archivos

Estas pruebas usan solo registros de una cuenta autorizada. Preferir ya leídos o antiguos. Para probar una transición de no leído, identificar antes el registro y registrar autorización, estado inicial y efecto esperado; la llamada puede producir un cambio irreversible desde la interfaz observada.

| ID | Servicio / prueba | Criterio de aceptación y evidencia | Referencia |
|---|---|---|---|
| S-13 Detalle leído | `GET /visor/obtenerDetalleNotiMen` para un Mensaje y una Notificación ya leídos. Unir el resultado a la fila solicitada aunque el detalle devuelva IDs/fechas nulos. Probar HTML `indTexto=1` y JSON serializado `indTexto=3`. | Contenido original y normalizado sin pérdida; `listAttach` y `url` preservados. Reabrir un ya leído no crea duplicados ni cambia el estado local previo. | [Contrato C-02](../sunat/contracts.md#c-02--detalle). |
| S-14 Efecto de leer no leído | Registrar intención; abrir un Mensaje no leído antiguo y, si existe un caso autorizado, una Notificación no leída. Reconsultar listado hasta observar estado o agotar espera. | Para Mensajes, reproducir `updateLeido=true` y `0→1` observados; para Notificaciones, documentar el resultado real o mantener `potencialmente_modificadora`. La primera reconsulta con `0` no prueba fallo. | [Contrato C-02](../sunat/contracts.md#c-02--detalle); [backend G-03](../backend/spec.md#6-puertas-de-validación-con-sunat). |
| S-15 Adjuntos | Enumerar `listAttach`, distinguir archivo descargable de documento generado, llamar `GET /visor/bajarArchivo/{codArchivo}/0/0/{ruc}` en la misma sesión. Probar caso numérico y `codArchivo=0`; otros formatos y adjuntos múltiples solo cuando haya casos reales. | Verificar HTTP, MIME, bytes, tamaño, hash y nombre recibido. HTML/error no se guarda como archivo válido. Para `codArchivo=0`, mantener secuencia detalle→descarga sin intercalar otro ítem de la cuenta. | [Contrato C-05](../sunat/contracts.md#c-05--descarga); [backend G-04](../backend/spec.md#6-puertas-de-validación-con-sunat). |
| S-16 Documento generado | Seguir **solo** la `url` devuelta por el detalle para `gendocS01Alias`; validar origen, HTTP y `text/html`, sin reconstruir `datos`. | Guardar el HTML como documento distinto del adjunto y de `msjMensaje`; nunca registrar la URL completa ni ejecutar scripts al presentarlo. | [Contrato C-06](../sunat/contracts.md#c-06--documento-html-generado). |

**Puerta C:** S-13/S-15/S-16 habilitan lectura y almacenamiento de casos probados. S-14 exige advertencia previa en producto y auditoría de intención. La ausencia de una Notificación no leída de prueba no autoriza a afirmar que leerla sea pasivo.

## Fase D · Robustez multi cuenta y cierre de decisión

| ID | Prueba | Criterio de aceptación |
|---|---|---|
| S-17 Aislamiento | Dos cuentas consecutivas y, después, dos ejecuciones concurrentes controladas: cookies/jars, RUC, resultados, archivos y logs nunca se cruzan. Una cuenta con error no pausa la otra. |
| S-18 Reintentos e idempotencia | Error de red/5xx, respuesta HTML inesperada, JSON sin `rows`, sesión vencida en página media y descarga parcial. Reanudar desde checkpoint sin duplicados; no repetir un detalle no leído automáticamente después de un resultado incierto. |
| S-19 Ritmo y capacidad | Medir duración de login, páginas, detalle y descarga; iniciar con peticiones secuenciales por cuenta y concurrencia global baja configurable. Registrar errores y pausas; no inventar un límite oficial de SUNAT. |
| S-20 Compatibilidad | Comparar respuestas nuevas con fixtures redactados: campos obligatorios, tipos, MIME, HTML del visor y catálogo. Un cambio incompatible produce `schema_changed` y detiene solo la cuenta afectada. |

**Entrega de esta fase:** informe de decisión del transporte, matriz S-01–S-20 con `pasa | falla | pendiente | no aplica`, fecha, cuenta de prueba anonimizada, entorno y evidencia redactada. Actualizar [contracts.md](../sunat/contracts.md) solo con hechos nuevos; mantener separadas observación e inferencia. Incorporar las pruebas de contrato al adaptador y comunicar al [plan backend](01-backend.md) qué funciones pueden activarse.

## Criterio de liberación

- **Inventario manual:** S-01–S-04, S-06–S-08, S-17/S-18 pasan en el transporte elegido. Si S-04 falla, la interfaz debe advertir el efecto y no puede llamarlo pasivo.
- **Lectura/descarga:** además pasan S-13/S-15/S-16 para los formatos ofrecidos; S-14 determina el texto de advertencia y la confirmación del estado remoto.
- **Cron desatendido:** además pasan S-02/S-05 en ejecuciones repetidas y la política de CAPTCHA/intervención queda resuelta. El éxito manual en navegador no satisface este criterio.
- **Funciones auxiliares:** S-09–S-12 se habilitan de acuerdo con cada prueba; su fallo no se disfraza como bandeja vacía.
