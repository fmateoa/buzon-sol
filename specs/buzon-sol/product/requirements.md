# Especificación de producto v2 · Buzón SOL para equipos

## 1. Alcance y conceptos

Aplicación interna para **N cuentas SUNAT** y varios usuarios. Cada cuenta tiene un buzón, credencial, configuración de consulta, inventario y archivos aislados. Cada usuario entra con su cuenta de la aplicación, recibe exactamente un rol y ve solamente las cuentas incluidas en ese rol. El administrador gestiona cuentas, usuarios, roles, programación y auditoría.

El inventario obtiene metadatos de Mensajes y Notificaciones; **no abre contenidos**. La lectura de detalle, los documentos generados y ciertos adjuntos pueden requerir una petición a SUNAT con efecto de lectura. `estado_remoto_observado` y `revisado_en_app` son dos ejes independientes. «Nuevo» debe definirse respecto de una línea base explícita (véase decisiones abiertas); no equivale automáticamente a «No leído en SUNAT».

**Incluido:** acceso a la app, RBAC por rol y cuenta, alta y desactivación de cuentas, reemplazo de Clave SOL de solo escritura, programación por cuenta, inventario manual/programado con reanudación, bandejas y filtros, lectura explícita, descarga, revisión local, actividad, preferencias y auditoría. **Fuera de alcance:** escribir/mover/borrar mensajes en SUNAT; cambiar manualmente su estado remoto; asumir que los servicios internos de SUNAT son API pública; importar RUC reales o secretos en fixtures.

## 2. Flujos funcionales

| ID | Inicio y resultado | Reglas y aceptación observable |
|---|---|---|
| F1 Alta de cuenta | Admin registra alias, RUC, usuario SOL y Clave SOL; prueba conexión, configura programador y agrega la cuenta a los roles pertinentes. | La clave solo se escribe o reemplaza; ni lectura, exportación ni auditoría muestran su valor. Probar conexión registra si SUNAT abrió el primer elemento. Una credencial rechazada deja la cuenta sin consulta activa. La cuenta nueva no aparece a usuarios hasta estar incluida en su rol. |
| F2 Consulta programada | Llega la hora local configurada; servicio toma la credencial cifrada, inicia sesión, inventaría ambas bandejas, compara con el inventario anterior, avisa a usuarios autorizados y cierra sesión. | Una sola ejecución activa por cuenta; progreso por página y reanudación. Un inicio de sesión con apertura automática se registra como posible efecto en SUNAT. El aviso muestra cantidades y enlaza a la cuenta solo a usuarios que conservan acceso. |
| F3 Actualización manual | Usuario con permiso solicita «Actualizar inventario» para una cuenta visible. | Se recorren páginas, se deduplica, se muestra progreso y se obtiene «Completo · total verificado» solo tras confirmar fin. Si falla, «Inventario parcial» con página guardada y «Reanudar». Nunca llamar al detalle como parte del barrido; no prometer ausencia total de efecto remoto hasta superar G-02. |
| F4 Lectura de no leído | Usuario abre metadatos; si pide contenido de un no leído, se muestra confirmación según su preferencia e historial del elemento. | El cuerpo permanece oculto antes de confirmar. Se registra intención antes de llamar a SUNAT; tras abrir, estado «Confirmando con SUNAT…» hasta observar el cambio o quedar «Sin confirmar». «Revisado en la app» es acción opcional y separada. Si ya se abrió antes o el usuario desactivó el aviso, la acción conserva el indicador «Puede marcar como leído». |
| F5 Descarga | Desde detalle autorizado se descarga documento o adjunto. | Progreso por archivo, validación de respuesta y almacenamiento bajo la cuenta. Éxito: «Guardado en el espacio de la cuenta»; fallo: «No se pudo descargar» y «Reintentar». Si requiere abrir detalle para conseguir la URL, aplicar antes las reglas de F4. |
| F6 Sesión/credencial | Sesión vencida durante consulta o credencial rechazada. | Vencimiento: intentar nueva sesión según política acotada y retomar página. Rechazo: pausar programador, guardar progreso y avisar a administradores; reanudar solo tras reemplazo y prueba satisfactoria. No interpretar HTML de login como bandeja vacía. |
| F7 Roles y acceso | Admin crea/edita rol, permisos y cuentas visibles; asigna un rol a usuarios. | Backend aplica autorización en cada lectura, descarga y comando. El selector no muestra cuentas ajenas. Cambios de rol, acceso, usuario y preferencia de aviso quedan en auditoría. Los cambios de acceso se aplican a sesiones existentes sin esperar un nuevo login. |

## 3. Matriz de capacidades de referencia

Los nombres de rol de la maqueta son **plantillas iniciales**, editables por administración; la autorización real deriva de permisos y cuentas asignadas, nunca del nombre del rol.

| Capacidad | Administrador | Supervisor | Analista | Solo consulta |
|---|:---:|:---:|:---:|:---:|
| Ver metadatos de bandejas | ✓ | ✓ | ✓ | ✓ |
| Leer contenido | ✓ | ✓ | ✓ | — |
| Descargar archivos | ✓ | ✓ | ✓ | — |
| Marcar revisado en la app | ✓ | ✓ | ✓ | — |
| Consultar ahora | ✓ | ✓ | ✓ | — |
| Ver auditoría | ✓ | — | — | — |
| Configurar programador | ✓ | ✓ | — | — |
| Gestionar cuentas y credenciales | ✓ | — | — | — |
| Gestionar usuarios y roles | ✓ | — | — | — |

El administrador tiene todas las cuentas, incluidas las futuras. Otros roles tienen un conjunto explícito o la opción «todas» si así se configura. «Solo consulta» ve metadatos, pero no contenido ni descargas. Las pantallas y controles se ocultan o deshabilitan según permiso; el servidor devuelve denegación aun si se invoca una operación manualmente.

## 4. Reglas compartidas

- Cada consulta tiene estado `pendiente | ejecutando | completa | parcial | reintentando | pausada`; el motivo de pausa/error se guarda aparte. Los conteos verificados solo se etiquetan como tales tras un barrido completo. Durante barrido o fallo, mostrar «registrados hasta ahora» y advertir que filtros/totales pueden cambiar.
- Recorrer Mensajes y Notificaciones por separado hasta página vacía confirmada. Ignorar `records`/`total` como condición de fin, desduplicar por `(cuenta, tipoMsj, codMensaje)` y conservar páginas de origen; ver [diseño del lector v1](../legacy/design.md) §3.
- El estado remoto se basa en `indEstado` observado. La lectura de Mensajes no leídos produjo `updateLeido=true` en la evidencia; la transición de Notificaciones no leídas está pendiente. No existe flujo para revertir leído.
- Una descarga existente no debe repetirse innecesariamente. Documento generado y archivo adjunto son tipos distintos; `cantidadArchAdj` no determina cuántos elementos tiene `listAttach`.
- Desactivar una cuenta detiene su programador pero conserva inventario y auditoría. Desactivar un usuario bloquea su acceso y conserva sus acciones históricas.
- El aviso «No volver a mostrar» aplica al usuario, se puede reactivar en Perfil y se audita. La confirmación por elemento se omite después de una lectura previa **de ese usuario**, pero la acción mantiene su efecto visible.

## 5. Aceptación de la v2

1. Dos usuarios con roles distintos ven conjuntos correctos de cuentas y no pueden obtener datos ni archivos de una cuenta ajena llamando al backend directamente.
2. Dos cuentas se inventarían sin compartir sesión, datos ni archivos; una ejecución interrumpida retoma desde un checkpoint sin duplicados.
3. Con el fixture `total=108`, 134 páginas con datos y 135 vacía se guardan 3328 registros únicos; el total declarado se muestra aparte.
4. Abrir un no leído registra intención, muestra la advertencia, realiza una sola lectura remota y distingue «confirmando» de «leído confirmado» y «revisado en app».
5. Una credencial rechazada pausa solo su cuenta, conserva el inventario y produce un aviso administrativo sin mostrar secretos.
6. En escritorio y móvil se puede completar F1–F7 según permisos; estado vacío, carga, error, parcial y sin acceso tienen textos y acciones comprobables.

## 6. Decisiones abiertas antes de liberar funciones reales

| ID | Decisión necesaria | Propuesta para el desarrollo |
|---|---|---|
| P-01 | Definir «nuevo»: desde última consulta completa de la cuenta o desde última visita de cada usuario. La maqueta usa ambas expresiones. | Guardar ambos hitos por separado; usar `detectado_desde_consulta_anterior` para avisos del programador y `no_visto_por_usuario` para el badge personal, con textos distintos. |
| P-02 | Medio de aviso: la maqueta incluye app y correo diario. | Implementar primero aviso en app; correo queda pendiente de proveedor, destinatarios, frecuencia y consentimiento operacional. |
| P-03 | Descarga programada de «adjuntos de elementos ya leídos». | Permitirla solo si el detalle y URL ya están guardados o se demuestra que obtenerlos no cambia un no leído. Nunca abrir un elemento no leído por una descarga automática. |
| P-04 | Política de retención de cuerpos, archivos y auditoría. | Parametrizar por despliegue antes de producción; no fijar duración desde el wireframe. |
