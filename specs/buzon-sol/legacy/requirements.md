# SDD · Requisitos del lector de Buzón SOL

> **Alcance histórico (v1):** lector supervisado. Para la aplicación multiusuario, roles, credenciales cifradas y programación, comenzar en [README.md](../README.md) y [requisitos de producto](../product/requirements.md). Las observaciones técnicas de SUNAT siguen siendo evidencia, pero este alcance no sustituye la v2.

**Estado:** propuesta implementable · **Base empírica:** [BUZON_SOL_APIS.md](../sunat/BUZON_SOL_APIS.md), inspección de dos cuentas el 29/09/2026 (Lima).  
**Objetivo:** construir un sistema que inventarie y, cuando el operador lo autorice, obtenga el contenido y los archivos de Mensajes y Notificaciones del Buzón electrónico SOL.

## 1. Límites y términos

- **Cuenta:** sesión SOL asociada a un RUC. Cada cuenta tiene datos y estado aislados.
- **Mensaje:** registro con `tipoMsj=1`.
- **Notificación:** registro con `tipoMsj=2`.
- **No leído:** fila con `indEstado=0`. La web trata `indEstado!=0` como leído.
- **Inventario:** consulta de listados y metadatos, sin llamar al servicio de detalle.
- **Lectura completa:** consulta de detalle, documento generado y adjuntos. `obtenerDetalleNotiMen` marcó como leídos dos Mensajes no leídos; para Notificaciones no se pudo observar esa transición.
- **Alcance del MVP:** lectura y descarga autenticadas de ambas bandejas, búsqueda local, etiquetas y carpetas en modo consulta, seguimiento del estado de sincronización y cierre de sesión. Las operaciones de crear, editar, eliminar, mover, destacar o marcar urgente quedan fuera del MVP.

Los servicios observados son internos de la web, no un contrato público soportado por SUNAT. Los requisitos deben implementarse detrás de un adaptador cuyo comportamiento pueda ajustarse si cambia la página.

## 2. Decisiones de producto para la primera versión

| ID | Decisión |
|---|---|
| D-01 | El modo inicial es **Inventario**. El propio lector no abrirá detalles; antes de prometer preservación de no leídos debe comprobarse y, si hace falta, evitarse la apertura automática del primer registro que puede hacer la web al entrar. |
| D-02 | La **Lectura completa** requiere una acción explícita del operador por cuenta o por selección de registros. Antes de ejecutarla se informa cuántos no leídos podrían pasar a leídos. |
| D-03 | El acceso se realiza mediante el flujo web SOL y una sesión de navegador aislada por cuenta. La automatización de credenciales y la renovación sin usuario no forman parte del contrato verificado. |
| D-04 | El sistema no confiará en `records` ni `total` para decidir el fin de la paginación. |
| D-05 | El estado de lectura de SUNAT y el estado local de procesamiento se almacenan por separado. |

Estas decisiones permiten implementar el lector ahora; se pueden cambiar por configuración de producto sin reinterpretar los datos de SUNAT.

## 3. Requisitos funcionales

### RF-01 · Inicio, sesión y aislamiento

1. El operador podrá abrir el enlace completo de «Buzón electrónico SOL» desde la portada o un enlace completo previamente verificado que incluya `originalUrl` y `state`.
2. Las credenciales se ingresarán en la página de SUNAT. El sistema detectará la llegada a `/visor/master` y asociará la sesión a una sola cuenta.
3. Todas las peticiones de una cuenta usarán exclusivamente su contexto autenticado. No se compartirán cookies, encabezados, tokens ni almacenamiento entre cuentas.
4. Si SUNAT devuelve la pantalla de login, HTML inesperado o un error de sesión durante una sincronización, el trabajo quedará en estado `requiere_reautenticacion`, sin interpretar la respuesta como una bandeja vacía.
5. La acción «Salir» ejecutará el cierre desde la interfaz y comprobará que el menú protegido vuelve al login. El cierre de la aplicación también descartará el contexto local de la sesión.

**Aceptación:** con dos cuentas abiertas sucesivamente, ninguna fila de una aparecerá asociada a la otra; tras cerrar sesión, el sistema no continuará llamadas de lectura con ese contexto.

### RF-02 · Inventario de ambas bandejas

1. Consultar `tipoMsj=1` y `tipoMsj=2` por separado con `codCarpeta=00`, `codEtiqueta` vacío y `tipoOrden=NADA` para el inventario principal.
2. Recorrer `page=1,2,...` hasta obtener una página `200` JSON válida con `rows=[]`. Confirmar una página vacía antes de finalizar y aplicar un límite de seguridad configurable que, si se alcanza, produce error explícito de inventario incompleto.
3. No detenerse por `total`, `records`, `endPage` ni por fecha. En una cuenta se declararon 108 páginas de Mensajes, pero se obtuvieron datos hasta la página 134.
4. Desduplicar por `(cuenta, tipoMsj, codMensaje)` y registrar qué páginas aportaron cada fila. Una fila repetida no crea un segundo mensaje.
5. Guardar el estado `indEstado`, asunto original, fecha original, remitente, etiqueta, indicadores de destacado y urgencia, y cantidad informada de adjuntos. El inventario **no** llama a `obtenerDetalleNotiMen`.
6. Exponer progreso: páginas consultadas, filas recibidas, mensajes únicos, no leídos y errores. Los contadores de SUNAT se muestran como declarados, nunca como total verificado.
7. Validar el inicio de la sesión: la web observada cargó automáticamente el detalle del primer registro al abrir el visor. Para ofrecer un Inventario que preserve no leídos, el adaptador deberá suprimir esa apertura automática o demostrar en una cuenta de prueba que no afecta un no leído. Si no puede hacerlo, el sistema informará que entrar al buzón podría cambiar un estado antes de iniciar el barrido.

**Aceptación:** un caso sintético con `total=108`, 134 páginas con filas y página 135 vacía produce 3328 registros únicos, si esas son las filas del fixture. El lector no abre detalles; la prueba de arranque comprueba que la web tampoco abrió el primero sin control. Repetir el inventario no duplica registros.

### RF-03 · Estado de lectura

1. Clasificar `indEstado=0` como no leído; cualquier otro valor recibido se conserva y se presenta como leído según la regla de la web.
2. Registrar `estado_remoto_observado`, `observado_en` y `estado_local_procesamiento` independientemente. La aplicación nunca deduce «procesado» solo porque SUNAT diga «leído».
3. Antes de Lectura completa, contar los registros no leídos seleccionados y presentar el efecto esperado. No existe en la web observada una función para volver a marcarlos como no leídos.
4. Después de abrir un detalle con `updateLeido=true`, reconsultar el listado hasta observar `indEstado!=0` o agotar un tiempo de espera configurable; conservar ambos hechos aunque el cambio remoto tarde en aparecer.
5. Para Notificaciones, tratar la lectura de detalle como potencialmente modificadora del estado hasta tener una prueba con una no leída. No prometer preservación de no leídos.

**Aceptación:** abrir por API un Mensaje no leído cambia su estado observado de `0` a `1` tras nuevas consultas; abrir uno ya leído devuelve `updateLeido=false`. Un inventario con arranque controlado no produce ese cambio.

### RF-04 · Detalle y contenido

1. Leer por `(tipoMsj, codMensaje)` únicamente en Lectura completa.
2. Unir el detalle con los metadatos del listado; muchos campos del detalle pueden ser `null`, incluso `codMensaje` y `desAsunto`.
3. Guardar el valor original de `msjMensaje` y una representación normalizada. Si `indTexto="1"`, tratarlo como HTML. Si `indTexto="3"`, intentar analizar el JSON que viene serializado como cadena y conservarlo también en bruto.
4. Si existe `url` de documento generado, solicitarla solo dentro de la misma sesión, conservar el HTML devuelto y vincularlo al mensaje. No construir `datos` desde valores inventados.
5. El HTML externo se sanitiza antes de mostrarse en una interfaz propia; el dato original se mantiene sin ejecutarlo.

**Aceptación:** un mensaje HTML y una notificación con JSON anidado/documento generado pueden consultarse y vincularse sin perder los datos originales. Un formato desconocido se conserva como bruto y queda señalado para revisión.

### RF-05 · Adjuntos

1. Enumerar `listAttach` y distinguir el documento generado (`indMensaje="3"` en el caso observado) del archivo descargable (`indMensaje="2"` en los casos observados). No asumir que `cantidadArchAdj == listAttach.length`.
2. Descargar archivos únicamente desde la URL observada o derivada conforme al patrón verificado `/visor/bajarArchivo/{codArchivo}/0/0/{ruc}` dentro de la misma sesión.
3. Si `codArchivo=0`, ejecutar la apertura de detalle y la descarga en una sección serializada por cuenta; no intercalar otros detalles hasta que termine, porque la ruta podría depender de estado de servidor.
4. Verificar respuesta HTTP, `Content-Type`, nombre de `Content-Disposition`, tamaño realmente recibido y hash SHA-256. Un HTML de error nunca se guarda como PDF válido.
5. Almacenar con un nombre interno seguro. El nombre original es metadato, no ruta de escritura. Reintentos no generan copias duplicadas.

**Aceptación:** se descargan los dos ejemplos PDF observados, uno con `codArchivo` numérico y otro con `0`; una descarga no autenticada o HTML de error queda marcada como fallo y no como documento.

### RF-06 · Carpetas, etiquetas y búsqueda

1. Consultar `/visor/ajax/listarCarpetas`; aceptar `[]` o carpetas con `codCarpeta`, `nomCarpeta`, `cantMensajes`.
2. Mostrar el catálogo de etiquetas provisto por `/visor/master` y el `codEtiqueta` de cada fila. Los códigos observados constan en [contracts.md](../sunat/contracts.md).
3. Permitir consulta por `codEtiqueta` y por asunto (`des_asunto`), indicando que no hay parámetro observado para rango de fechas.
4. Ofrecer filtros locales por rango de `fecPublica`, leído/no leído, etiqueta, carpeta y texto sin afirmar que SUNAT los soporta como filtros remotos. Un filtro por fecha debe aplicarse después de recorrer las páginas necesarias; no debe cortar el recorrido anticipadamente.
5. `tipoOrden=LEIDOS` y `NO_LEIDOS` puede priorizar estados, pero no limita el conjunto de resultados. El sistema filtrará localmente por `indEstado` si el usuario pide exclusivamente un estado.

**Aceptación:** seleccionar una etiqueta envía su código; un filtro «No leídos» local no devuelve filas con `indEstado!=0`, incluso si SUNAT las devuelve con `tipoOrden=NO_LEIDOS`.

### RF-07 · Resultado y auditoría

1. Exportar un manifiesto estructurado por cuenta y bandeja con metadatos, estado remoto observado, disponibilidad de detalle, adjuntos y errores. El formato exacto de exportación se define en diseño; el contenido de adjuntos no se incrusta en JSON.
2. Conservar evidencia de operación sin credenciales: hora, tipo de consulta, página, estado HTTP, cantidad de filas, identificador interno y transición de lectura. Redactar URL `token`, `state`, RUC en logs de diagnóstico compartibles, cookies, encabezados de sesión y cuerpos con datos personales.
3. Una sincronización interrumpida puede reanudarse; los mensajes ya persistidos se actualizan por clave natural sin duplicarse.

**Aceptación:** una ejecución fallida a mitad de paginación se marca incompleta, puede reanudarse y no mezcla información entre cuentas.

## 4. Requisitos no funcionales

- **RNF-01 · Privacidad:** credenciales y tokens solo en la sesión del navegador; nunca en el repositorio, exportaciones o logs. Los datos tributarios almacenados requieren permisos de acceso por cuenta y protección acorde al entorno de despliegue.
- **RNF-02 · Robustez:** validar tipo y forma de cada respuesta antes de procesarla. Detectar HTML de login/error donde se espera JSON o PDF.
- **RNF-03 · Idempotencia:** repetir inventario o descarga no duplica mensajes ni archivos. Repetir detalle de un leído no debe alterar el estado local previo.
- **RNF-04 · Ritmo:** peticiones secuenciales por cuenta en la primera versión, con pausa/reintento configurable para fallos transitorios. No se presume un límite de tasa conocido.
- **RNF-05 · Trazabilidad:** cada requisito y prueba remite a un comportamiento observado o queda rotulado como hipótesis por verificar.

## 5. Fuera de alcance y pendientes externos

- Inicio de sesión desatendido con RUC/usuario/contraseña, renovación automática de tokens y ejecución permanente sin navegador: no verificados.
- Crear/renombrar/eliminar carpetas, mover mensajes, marcar favoritos/urgentes, eliminar o marcar manualmente como no leído: no necesarios para leer datos y no verificados como flujo seguro.
- Contrato formal o garantía de compatibilidad de SUNAT: no observado.
- Cambio de no leída a leída en Notificaciones: no comprobado porque las 227 notificaciones de la cuenta de prueba ya estaban leídas.
- Adjuntos múltiples, formatos distintos de PDF y semántica exacta de `codArchivo=0`: requieren casos de prueba reales.
