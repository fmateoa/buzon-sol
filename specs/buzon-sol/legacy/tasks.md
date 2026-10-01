# SDD · Plan de implementación y verificación

> **Plan histórico (v1):** los planes actuales de desarrollo son [frontend](../plan/03-frontend.md) y [backend](../plan/01-backend.md). Las pruebas del adaptador descritas aquí se reutilizan donde corresponda.

Este plan implementa [requirements.md](requirements.md) contra el contrato de [contracts.md](../sunat/contracts.md) y el diseño de [design.md](design.md). Cada tarea termina con una prueba observable; los servicios de SUNAT no se invocan desde CI con cuentas reales.

## Hito 0 · Preparar el proyecto

### T-00 · Estructura y datos de prueba

- Elegir el runtime de la aplicación. Si no existe otro requisito, usar un solo proceso local con Playwright, SQLite y almacenamiento de archivos; añadir una interfaz web solo cuando haga falta a los usuarios.
- Crear fixtures **ficticios y redactados** para: listado normal, listado con `records/total` incorrectos, contenido HTML, `msjMensaje` JSON anidado, detalle con `updateLeido=true`, detalle con campos nulos, dos formas de adjunto y respuesta HTML de login/error.
- Añadir una prueba que falle si un fixture o log de prueba contiene un token, cookie, contraseña, RUC real o URL de `datos` sin redactar.

**Terminado cuando:** los fixtures permiten probar el lector sin conexión a SUNAT y no contienen datos de las dos cuentas observadas.

## Hito 1 · Sesión y adaptador de lectura

### T-01 · Contexto SOL por cuenta

- Abrir el enlace completo del login en un navegador separado para cada cuenta.
- Esperar el formulario o el visor ya autenticado; permitir al operador ingresar credenciales en SUNAT.
- Identificar el `iframe` `/visor/master` y rechazar una cuenta que no coincida con la cuenta que el operador seleccionó.
- Detectar la petición automática de detalle al entrar al visor y demostrar un arranque de Inventario que la evita, o declarar el modo como potencialmente modificador del primer registro. No afirmar preservación de no leídos sin esta prueba.
- Detectar expiración por redirección a login o por HTML cuando se esperaba JSON.
- Implementar «Salir» desde la interfaz y comprobar que el menú protegido vuelve al login.

**Pruebas:** dos contextos con fixtures distintos no comparten datos; login pendiente no ejecuta listados; un primer registro no leído no se abre automáticamente en Inventario, o la ejecución informa expresamente el riesgo; logout impide nuevas lecturas.

### T-02 · Cliente del visor con validación

- Implementar `listPage`, `listFolders`, `getLabelCatalog` y `getDetail` en el contexto autenticado.
- Enviar los parámetros y encabezados observados; permitir URL raíz configurable solo para pruebas controladas.
- Validar `HTTP`, MIME y esquema mínimo. Emitir errores tipados: `AuthExpired`, `RemoteFailure`, `SchemaChanged`, `TemporaryFailure`.
- Redactar URLs y encabezados antes de registrarlos.

**Pruebas:** JSON correcto se analiza; HTML de login/`500` no se trata como lista vacía; campos adicionales no rompen el parser.

## Hito 2 · Inventario fiable

### T-03 · Paginación y deduplicación

- Recorrer cada bandeja con `tipoOrden=NADA`, `page` ascendente y confirmación de primera página vacía.
- No cortar por `total` ni `records`; configurar un guardarraíl que produzca run incompleto si se alcanza.
- Hacer upsert por `(account_id, tipoMsj, codMensaje)`.
- Registrar contadores declarados y reales por página.

**Pruebas obligatorias:**

1. Notificaciones: 9 páginas de 25 + 2 filas en la 10, página 11 vacía → 227 únicos.
2. Mensajes: 133 páginas de 25 + 3 filas en la 134, página 135 vacía, aunque `total=108`/`records=2681` → 3328 únicos.
3. Una fila repetida en dos páginas → un registro almacenado, dos apariciones registradas.
4. Fallo `500` en una página → run incompleto, jamás completo.
5. Primera respuesta `rows=[]` transitoria y segunda con datos → continúa el recorrido.

### T-04 · Estado y consultas locales

- Guardar `indEstado` raw y derivar leído/no leído con la regla observada.
- Mostrar por cuenta y bandeja los totales verificados del inventario, y por separado `records`/`total` declarados por SUNAT.
- Implementar consulta local por estado, fechas, asunto, carpeta y etiqueta. La búsqueda remota por asunto y etiqueta queda disponible en el adaptador, pero no sustituye el inventario completo cuando se necesita exhaustividad.
- Leer `listarCarpetas` y el catálogo vivo de etiquetas; aceptar carpeta vacía, códigos desconocidos y catálogo no disponible.

**Pruebas:** `tipoOrden=NO_LEIDOS` que devuelve leídos en una página tardía no contamina el filtro local «solo no leídos»; fechas raw no reciben zona UTC inventada.

## Hito 3 · Contenido con efecto de lectura controlado

### T-05 · Flujo explícito de Lectura completa

- Antes de la llamada, mostrar cuántos seleccionados están no leídos y registrar un `read_event` con estado previo.
- Solicitar detalle por `(tipoMsj,codMensaje)` y conservar respuesta original validada.
- Unir con fila de listado; no depender de campos nulos del detalle.
- Procesar HTML (`indTexto="1"`), JSON anidado (`indTexto="3"`) y contenido desconocido sin pérdida del original.
- Si `updateLeido=true`, reconsultar el estado con espera acotada y registrar la transición, sin volver a abrir el detalle solo para verificarla.

**Pruebas:** fixture de no leído → detalle `updateLeido=true` → listados `0,0,1`; resultado final leído. Fixture de ya leído → `updateLeido=false`; historial previo permanece intacto. Error después de pedir detalle pero antes de guardar → evento parcial recuperable.

### T-06 · Documento generado

- Si `detail.url` pertenece al origen SUNAT esperado, pedir el HTML de `gendocS01Alias` en la misma sesión.
- Guardar HTML bruto y versión apta para mostrar; no incluir el parámetro `datos` en logs.
- Tratar el documento generado como artefacto distinto de un adjunto binario.

**Pruebas:** `listAttach` de dos elementos y `cantidadArchAdj=1` produce un documento generado y un PDF; no crea dos PDF.

## Hito 4 · Archivos

### T-07 · Descarga y almacenamiento

- Implementar descarga dentro de la sesión autenticada, comprobando HTTP, MIME, tamaño y nombre original.
- Aplicar sección serializada por cuenta para `codArchivo=0` desde la apertura del detalle hasta el fin del archivo.
- Guardar con nombre interno, escritura temporal y movimiento atómico; calcular SHA-256 y evitar duplicados en reintentos.
- Separar error de adjunto de error de detalle.

**Pruebas:** PDF con ID numérico y PDF con `codArchivo=0` se vinculan a sus mensajes; respuesta `500 text/html` no se registra como PDF; nombre original con separadores de ruta no sale del directorio de almacenamiento; dos reintentos no producen copias distintas.

## Hito 5 · Resultado operativo

### T-08 · Manifiesto y reanudación

- Exportar manifiesto por cuenta con mensajes, estado observado, contenido disponible y referencias a archivos, sin secretos de sesión.
- Permitir continuar un run incompleto sin duplicar datos.
- Presentar resumen de discrepancias de paginación y fallos por página/registro.

**Pruebas:** interrumpir en una página media, reanudar y obtener el mismo conjunto de IDs que un barrido completo; exportación sin cookies, tokens ni URLs sensibles.

### T-09 · Prueba supervisada en SUNAT

- Ejecutar Inventario en una cuenta autorizada; verificar ambos tipos de bandeja y comprobar desde la navegación inicial si SUNAT pidió automáticamente el detalle del primer registro. Certificar ausencia de detalles solo si el control de arranque la garantiza.
- Con autorización explícita del operador para la ejecución, leer uno o dos Mensajes antiguos no leídos y verificar `0 → 1`; no repetir esta prueba sobre registros nuevos si no hace falta.
- Leer una Notificación ya leída y comprobar que permanece leída. Cuando exista una Notificación no leída en una cuenta autorizada, probar su transición una sola vez y actualizar el contrato.
- Probar adjuntos reales adicionales solo si hay un caso representativo de múltiples archivos o `codArchivo=0`.
- Probar cierre de sesión al terminar.

**Terminado cuando:** los resultados de la ejecución se contrastan con el manifiesto, los efectos sobre leídos quedan registrados y las diferencias de contrato se incorporan a la especificación antes de ampliar el uso.

## Matriz de trazabilidad

| Requisito | Tareas | Evidencia de aceptación |
|---|---|---|
| RF-01 | T-01, T-02, T-09 | Login, aislamiento, expiración y salida comprobados. |
| RF-02 | T-01, T-02, T-03, T-09 | Recorre hasta página vacía; 3328/227 en fixtures; control del detalle automático al entrar. |
| RF-03 | T-04, T-05, T-09 | Detecta `indEstado=0`; registra `0 → 1` y retraso. |
| RF-04 | T-02, T-05, T-06 | HTML, JSON anidado y nulos procesados. |
| RF-05 | T-07, T-09 | Descargas válidas, error HTML y `codArchivo=0`. |
| RF-06 | T-02, T-04 | Carpetas, etiquetas, filtros locales y búsqueda. |
| RF-07 | T-03, T-05, T-08 | Manifiesto, auditoría redactada y reanudación. |

## Condición de cierre de la primera versión

Todos los requisitos RF-01 a RF-07 tienen prueba local automatizada con fixtures. Una prueba supervisada confirma Inventario en ambos buzones y una Lectura completa consentida. Las limitaciones no verificadas figuran en el resultado operativo; el sistema no promete sincronización desatendida ni conservación del estado no leído cuando obtiene detalles.
