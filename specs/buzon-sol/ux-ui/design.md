# Especificación UX/UI v2

**Fuente visual:** [proyecto Claude Design de Buzón SOL](https://claude.ai/design/p/28bc9ee9-1a5e-4d16-a303-542e8c875f14?file=Buzon+SOL+-+Dise%C3%B1o+UX.dc.html) y capturas de mapa/flujos adjuntas. Importar con el MCP `claude_design` (`https://api.anthropic.com/v1/design/mcp`, autenticación con `/design-login`), leer `Buzon SOL - Diseño UX.dc.html` y el `support.js` que importa. Los identificadores A, U, W, D y M son los del diseño; ejemplos de RUC, personas, fechas y conteos son ficticios. Esta spec describe comportamiento, no copia la estructura HTML del diseño.

## 1. Navegación e información

| Zona | Vistas | Acceso |
|---|---|---|
| Acceso | Inicio de sesión de **buzon-sol**, recuperación vía administrador | Sin sesión. Nunca pide Clave SOL al usuario común. |
| Usuario, por cuenta seleccionada | Selector de cuenta; Resumen; Mensajes; Notificaciones; Carpetas/etiquetas como filtros; Actividad; Perfil/preferencias | Solo cuentas de su rol. Una ruta con cuenta ajena muestra «No tiene acceso a esta cuenta». |
| Administración | Cuentas SUNAT; datos/credencial, programador, usuarios con acceso; Usuarios; Roles y permisos; Actividad programada global; Auditoría | Según permisos, con comprobación servidor. |

La cuenta activa se refleja en título, navegación, filtros, datos, estado de consulta y descargas. Cambiar cuenta elimina filtros/selección transitorios de la anterior y cancela o ignora respuestas tardías de esa cuenta en pantalla. El inventario guardado de otra cuenta nunca se mezcla.

## 2. Inventario de pantallas

| Ref. | Pantalla y contenido mínimo | Estados/acciones |
|---|---|---|
| A1 | Lista de cuentas: alias, RUC/usuario SOL enmascarados, credencial válida/rechazada/ausente, programador, última consulta, nuevos y usuarios con acceso. | Banner de rechazo; alta; edición; ir a programador; desactivar. Los asuntos nunca aparecen en esta tabla global. |
| A2 | Alta/edición en panel: nombre interno, RUC, usuario SOL, Clave SOL de solo escritura, fecha/estado de clave guardada. | Guardar, reemplazar, probar conexión, desactivar. Probar advierte que el login puede abrir el primer elemento. No precargar ni revelar clave. |
| A3 | Programador por cuenta: frecuencia (30 min, 1/2/4 h, diaria), días L–D, ventana horaria Lima, bandejas, opción condicionada de adjuntos ya leídos, avisos, próximas y últimas consultas. | Activo/pausado/desactivado; guardar; consultar ahora; historial y causa de pausa. Validar inicio < fin y al menos un día/bandeja. |
| A4 | Roles: matriz de permisos y cuentas visibles, opción todas incluidas futuras, número de usuarios. | Crear/editar/guardar; advertir alcance de cambios y auditar. |
| A5 | Usuarios: alta, invitación, activo/desactivado, rol, vista previa de cuentas derivadas. | Cambiar rol o estado; la asignación de cuentas ocurre en el rol. |
| A6 | Auditoría: fecha, actor, acción, elemento y cambio; filtros por acción/elemento/actor/fecha; exportar CSV si autorizado. | Solo lectura; valor de Clave SOL nunca visible. |
| U1 | Selector de cuenta y novedades; resumen por cuenta. | Muestra solo cuentas visibles y cantidades pertinentes a esa cuenta. |
| D1 | Login de app con correo de trabajo y contraseña propia. | Errores sin revelar si existe el correo; orientación a administrador. |
| D4 | Resumen: estado/última/próxima consulta, «Actualizar inventario», «Leer contenido…», totales verificados/no leídos, discrepancia con SUNAT, pendientes. | Inventario y lectura tienen acciones, explicación y aspecto separados. Lectura múltiple pide confirmación con cantidad. |
| D5 | Bandeja Mensajes/Notificaciones: búsqueda por asunto, estado, fecha, carpeta, etiqueta, tabla con estado, destacado, remitente, asunto/etiqueta, adjuntos y fecha. | Inventario en curso/parcial/completo, carga, vacío, error; filtros locales sobre lo inventariado, orden y paginación. Abrir detalle desde control explícito de la fila. |
| D6 | Detalle sin abrir: metadatos visibles, cuerpo oculto, confirmación para no leído. | «Volver sin abrir» y «Abrir contenido». El foco no debe abrir contenido accidentalmente. |
| D7 | Detalle abierto: contenido sanitizado, estado remoto confirmando/confirmado/sin confirmar, marca de revisión local, documentos y adjuntos con progreso. | Leer y revisar son eventos independientes. |
| D8 | Actividad de cuenta: progreso por bandeja, páginas, encontrados/únicos, adjuntos, errores, historial y reanudar. | Pausa por credencial; inventario visible; acciones remotas bloqueadas mientras no haya sesión válida. |
| D10 | Perfil: identidad, rol, cuentas visibles y preferencia de aviso. | Reactivar/desactivar aviso y auditar. |
| M1–M4 | Bandeja móvil, confirmación en hoja inferior, detalle y consulta en pausa. | Mismas reglas y permisos que escritorio. |

Los wireframes W1–W4 validan jerarquía: panel lateral, una columna de trabajo, separaciones entre acción de inventario y lectura, y progreso por bandeja. No son pantallas adicionales.

## 3. Diseño adaptable e interacción

- **Escritorio:** referencia visual 1280×820; navegación lateral persistente, contenido principal de una columna, tabla para bandejas y panel lateral para editar cuenta. Tipografía sobria, fondo gris claro, superficies blancas, azul de marca y ámbar reservado para acciones con posible efecto remoto.
- **Tablet ≥768 px:** lateral reducido a iconos con nombre accesible; detalle a pantalla completa. No depender de `title` al pasar el cursor para descubrir navegación.
- **Móvil ~390 px:** barra inferior Mensajes, Notificaciones, Más; filtros en hoja inferior, listado en filas apiladas y confirmación en hoja inferior. Sincronización, Perfil y Administración accesibles desde Más según permiso.
- **Accesibilidad:** controles táctiles ≥44 px, foco visible de 3 px, label asociado, manejo de Escape/retorno de foco en diálogos, lectura por teclado sin activar contenido por foco, estados con icono+texto además de color, anuncios de progreso y error para lector de pantalla. La propuesta de flechas ↑/↓ e Intro de la maqueta se implementa solo si no rompe la semántica de tabla y el foco convencional; el control «Abrir» siempre debe poder tabularse.
- **Bandeja:** mantener encabezados/filtros al quedar 0 resultados; al filtrar/ordenar volver a página 1 y limpiar selección. Indicar «resultados en lo inventariado hasta ahora» durante un barrido y «total verificado» solo al completarlo. El declarado por SUNAT es secundario y se muestra cuando difiere.
- **Etiquetas SUNAT:** códigos desconocidos se muestran en neutro con nombre completo accesible; no desechar la fila por una etiqueta nueva.

## 4. Lenguaje y estados

Tratamiento de **usted**. Cada error indica qué ocurrió y qué puede hacer la persona. Copys normativos:

| Caso | Texto/acción |
|---|---|
| Inventario | «Actualizar inventario» + «Obtiene asunto, fecha, remitente, etiqueta y estado. No abre ningún contenido». Añadir aviso de posible apertura automática al inicio de sesión mientras G-02 siga sin superar. |
| Lectura | «Leer contenido…» + «Puede marcar como leído». Abrir no leído: «¿Abrir el contenido? … SUNAT puede marcarlo como leído. buzon-sol no puede revertir ese cambio». Acciones «Abrir contenido» / «Volver sin abrir». |
| Lectura múltiple | «¿Leer el contenido de N no leídos?»; indicar que se abren uno por uno y se puede detener el proceso. |
| Estado remoto | «No leído en SUNAT», «Confirmando lectura con SUNAT…», «Leído en SUNAT», «SUNAT aún no confirma la lectura». |
| Estado local | «Sin revisar» / «Revisado en buzon-sol». Nunca sustituye el estado remoto. |
| Inventario parcial | «Se revisaron N páginas. Los filtros solo incluyen lo ya inventariado» + «Reanudar». No usar «total verificado». |
| Credencial rechazada | «Consulta en pausa» + motivo y «Ver actividad» para usuarios; «Actualizar credencial» para admin. |
| Descarga fallida | «No se pudo descargar el archivo» + «Reintentar». |
| Sin resultados | «No hay mensajes con estos filtros» + «Quitar filtros». |
| Sin cuentas/sin inventario/sin carpetas | Mostrar explicación y acción pertinente del artefacto; deshabilitar acciones sin permiso. |

La maqueta dice que todas las acciones ámbar terminan en «…» y confirman. Para **Probar conexión** y cualquier inicio de sesión automático, mantener advertencia explícita del posible efecto remoto; la consulta programada no puede pedir confirmación interactiva en cada ejecución, por lo que requiere aceptación administrativa al activar la programación y registro de cada evento.

## 5. Comportamientos que necesitan resolver evidencia

- El artefacto llama «Sin efecto en SUNAT» al inventario. La petición de listado no abrió detalles en observaciones previas, pero el arranque del visor sí pudo abrir el primero. Hasta demostrar G-02, el copy debe acotarse a «El barrido no abre contenido; el inicio de sesión podría hacerlo».
- D7 dibuja PDF/ZIP/XML. Los ejemplos observados fueron PDF; los otros formatos son estados visuales, no formatos confirmados del servicio. El componente debe representar MIME/tipo desconocido sin asumirlo.
- Las cifras, nombres, horarios y colores del artefacto son muestras visuales, no datos productivos ni promesa de rendimiento.
