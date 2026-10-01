# Especificación backend v2

## 1. Arquitectura objetivo

Cliente React → backend de la aplicación → base de datos y almacén de archivos; un worker/programador del backend opera las consultas SUNAT. El navegador del usuario **nunca** recibe Clave SOL, cookies, `state`, tokens, URL de `datos` ni acceso directo a los servicios internos. El worker mantiene una sesión aislada por cuenta durante cada ejecución y la cierra o descarta al terminar. Primero se prueba un cliente HTTP con cookie jar; Playwright se incorpora solo si se demuestra una dependencia necesaria del navegador. El backend es dueño de autorización, cifrado, auditoría y avance de tareas. La tecnología de backend, base, cola y despliegue queda abierta; no inferirla del prompt frontend.

Los servicios del [contrato SUNAT](../sunat/contracts.md) fueron observados en el visor web y son internos. El 30/09/2026 se observó en el formulario público un `POST` a `j_security_check`, campos ocultos que el JavaScript rellena con RUC/usuario/clave y una condición de CAPTCHA. Un login manual autorizado llegó al buzón. **No se ha demostrado que un worker pueda iniciar, renovar y mantener una sesión SOL desatendida de forma fiable ni que un cliente HTTP externo pueda usar los servicios autenticados.** Prototipar contra una cuenta autorizada y documentar límites antes de habilitar programación real.

## 2. Datos y límites por cuenta

| Entidad lógica | Campos mínimos / invariante |
|---|---|
| `app_user` | ID, correo normalizado, nombre, estado, un `role_id`; autenticación propia de la app. No reutiliza Clave SOL. |
| `role` / `role_account` | Permisos explícitos, `all_accounts` o cuentas asignadas; cambios auditados. Una consulta con cuenta debe comprobar ambos permisos y membresía. |
| `sunat_account` | ID opaco, alias, RUC protegido, usuario SOL protegido, estado, fecha de alta/desactivación. Un buzón por cuenta. |
| `credential_secret` | Material cifrado en reposo y versión de clave; solo write/replace. Descifrado únicamente dentro del worker en memoria por el tiempo necesario. Nunca en respuesta, log ni auditoría. |
| `schedule` | Cuenta, frecuencia, días, ventana horaria `America/Lima`, bandejas, activación, política de aviso y próximo disparo. Una cuenta tiene a lo sumo un programador activo. |
| `sync_run` / `sync_page` | Cuenta, modo, bandeja, estado, inicio/fin, cursor de página, conteos recibidos/únicos/declarados, errores y causa de pausa. Checkpoint persistente. |
| `mail_item` | Clave única `(account_id, tipoMsj, codMensaje)`, metadatos originales y normalizados, `indEstado` raw, momento de observación, primer/último visto. |
| `read_event` | Actor, cuenta, elemento, intención antes de llamada, estado remoto antes/después, `updateLeido`, resultado, marcas de tiempo. |
| `review_state` | Usuario + elemento, revisado/no revisado y actor/fecha; no se envía a SUNAT. |
| `mail_content` / `file_asset` | Contenido original y versión segura de visualización; documento generado separado de adjunto; propietario `account_id`, MIME, tamaño, hash, nombre interno y nombre original solo como metadato. |
| `audit_event` / `in_app_notice` | Actor o sistema, acción, objeto, cambios sin secretos; aviso con destinatario autorizado y estado de lectura por usuario. |

Índices y permisos deben imponer segregación por `account_id`; los IDs del cliente no son prueba de acceso. Revocar acceso a un rol impide inmediatamente nuevas lecturas y descargas, incluso con una URL previamente copiada.

## 3. Comandos internos y autorización

| Operación semántica | Permiso | Efecto |
|---|---|---|
| Consultar cuentas/resumen/bandeja/actividad | `view_mailbox` + cuenta visible | Solo datos ya persistidos. |
| `startInventory` / `resumeRun` | `run_inventory` + cuenta visible | Encola un trabajo idempotente por cuenta; devuelve identificador y estado, no promesa de final inmediato. |
| `readContent` | `read_content` + cuenta visible | Registra intención y ejecuta una lectura de SUNAT que **puede** cambiar `indEstado`. La repetición con la misma clave de idempotencia no vuelve a abrir el mismo detalle. |
| `downloadFile` | `download_file` + cuenta visible | Devuelve archivo ya almacenado o inicia obtención autorizada, aplicando F4 si debe abrir un detalle no leído. |
| `setReviewed` | `mark_reviewed` + cuenta visible | Cambia solo estado local por usuario. |
| Gestionar cuentas/clave | `manage_accounts` | Alta, reemplazo, prueba, activación/desactivación. Nunca devuelve clave. |
| Guardar programación | `configure_schedule` + cuenta visible | Valida horario, bandejas y capacidad del worker. |
| Gestionar roles/usuarios; ver/exportar auditoría | Permisos administrativos específicos | Todas las modificaciones crean evento de auditoría. |

Definir OpenAPI/DTOs y códigos de error en la fase de backend antes de conectar React. Los contratos han de distinguir `forbidden`, `not_found`, `needs_credential`, `invalid_credential`, `remote_session_expired`, `remote_unavailable`, `schema_changed`, `incomplete_inventory` y `conflict_running`. No responder con un buzón vacío ante fallo de autenticación remota.

## 4. Programador y sincronización

1. Calcular disparos en `America/Lima`, incluidos cambios de día y límites de la ventana. La frecuencia de 30 min/1/2/4 h/diaria procede del diseño; si se requiere otra, modificar contrato y UI juntos.
2. Crear lease o exclusión por cuenta para impedir dos sesiones/trabajos simultáneos de la misma cuenta. Puede haber cuentas distintas ejecutándose separadas; limitar concurrencia global según pruebas con SUNAT, sin inventar un límite oficial.
3. Descifrar credencial en memoria del worker e iniciar sesión en un cookie jar aislado. Probar primero HTTP directo; al obtener `/visor/master`, tratar su HTML como datos sin ejecutar JavaScript y comprobar G-02. Si hace falta navegador, crear un contexto Playwright aislado e interceptar el detalle automático antes de cargar el visor.
4. Inventariar cada bandeja con el algoritmo del [diseño del lector v1](../legacy/design.md) §3: página ascendente, vacía confirmada, `total/records` diagnósticos, upsert, checkpoint por página, guardarraíl configurable y error explícito si se alcanza. Una página fallida se retoma sin saltar páginas; un reintento es idempotente.
5. Comparar con una línea base de la última ejecución **completa**. Una ejecución parcial no redefine por sí sola el total verificado ni descarta elementos ausentes. Crear avisos sin contenido sensible para usuarios que tengan acceso al emitir/abrir el aviso.
6. Cerrar sesión y liberar contexto incluso ante error. Sesión vencida: reautenticar una cantidad acotada de veces y continuar. Credencial rechazada o tres fallos consecutivos: pausar, registrar causa y notificar admin. Distinguir fallo transitorio de credencial inválida.

La UI ofrece «Consultar ahora» y «Reanudar» pero el trabajo real es asíncrono; el estado debe actualizarse por polling o canal de eventos definido al integrar. No abrir detalle para calcular nuevos/no leídos. La opción de descargas automáticas se restringe como P-03 de [requisitos de producto](../product/requirements.md).

## 5. Seguridad y tratamiento de datos

- Cifrado autenticado en reposo de Clave SOL con clave administrada fuera de la base y del repositorio; rotación/versionado y acceso mínimo del worker. Nada de descifrado en navegador. Evitar registrar cuerpos, RUC completo, claves, cookies, tokens, URL `datos` o encabezados de sesión.
- Contraseña de la app con autenticación propia elegida y documentada; sesiones de app con expiración y protección de acciones. Formularios de admin no exponen secreto ya guardado. CSV y archivos descargados aplican el mismo RBAC.
- HTML de SUNAT sanitizado antes de representación. Verificar HTTP, MIME, tamaño y hash de adjuntos; respuesta HTML de login/error no es archivo. Nombre original nunca controla ruta física. No ejecutar scripts ni estilos remotos.
- Auditoría de alta/edición/desactivación, cambio de rol/permisos, prueba y reemplazo de credencial, configuración, lectura con posible efecto remoto, preferencia de aviso, descarga y fallos. Valor anterior/nuevo de clave se registra solo como «reemplazada».
- Copias de seguridad, retención y borrado se definirán para el entorno real conforme P-04. No usar datos tributarios reales en fixtures ni capturas de prueba compartibles.

## 6. Puertas de validación con SUNAT

El procedimiento completo, la matriz de servicios y el criterio de liberación están en el [plan independiente de integración SUNAT](../plan/02-sunat-integration.md). Las puertas siguientes expresan la dependencia del producto; no sustituyen sus pruebas S-01–S-20.

| ID | Prueba controlada | Condición para habilitar |
|---|---|---|
| G-01 Sesión desatendida | Con cuenta autorizada: GET del enlace completo de portada con cookie jar nuevo, POST del formulario con campos y cookies de esa sesión, seguir redirecciones, obtener listado JSON de ambas bandejas por HTTP directo, repetir tras vencimiento y validar `Salir`. No imprimir ni persistir cookies/tokens. Registrar HTML inesperado y CAPTCHA. | Éxito repetible dentro de la ventana operativa. Si HTTP falla por dependencia real del navegador, evaluar Playwright y repetir la prueba. Si SUNAT exige intervención humana, mantener programación desactivada y solicitarla; no sortear el desafío. |
| G-02 Inventario sin lectura | Con primer elemento no leído de prueba, comprobar tráfico desde antes de cargar visor y estado remoto antes/después; impedir apertura automática o demostrar inocuidad. | Solo entonces usar sin matiz el copy «Sin efecto en SUNAT». Si no se supera, advertir que el inicio de sesión puede marcar el primero como leído y obtener aceptación administrativa para activar consultas. |
| G-03 Notificación no leída | Leer una notificación no leída autorizada y observar `updateLeido`/estado posterior. | Ajustar confirmación y modelo con evidencia; entretanto tratarla como potencialmente modificadora. |
| G-04 Adjuntos | Probar más de un archivo, formatos no PDF y `codArchivo=0` en sesión aislada. | No prometer formatos o descargas automáticas no comprobados. |

Las pruebas usan cuentas autorizadas, evidencia redactada y una ejecución supervisada. Los resultados se incorporan al [contrato SUNAT](../sunat/contracts.md) antes de declarar la integración lista.
