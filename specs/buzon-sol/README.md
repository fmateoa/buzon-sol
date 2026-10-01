# Buzón SOL · índice de especificaciones

**Versión de producto vigente:** v2, aplicación interna multiusuario. **Fecha:** 30/09/2026 (Lima). **Estado:** especificación para desarrollo; las condiciones de integración con SUNAT indicadas como pendientes requieren prueba controlada.

## Orden de lectura

1. [Producto](product/requirements.md): alcance, reglas, flujos F1–F7 y criterios de aceptación.
2. [UX/UI](ux-ui/design.md): navegación, pantallas, estados, textos y comportamiento adaptable.
3. [Frontend](frontend/spec.md): stack, estructura, componentes, estado y frontera con el backend.
4. [Backend](backend/spec.md): arquitectura multiusuario, datos, programador, seguridad y contratos internos pendientes. El [prompt técnico de backend](backend/prompt.md) recoge un stack propuesto y pautas de implementación.
5. Planes numerados en `plan/`: [01 Backend](plan/01-backend.md), [02 Integración SUNAT](plan/02-sunat-integration.md), [03 Frontend](plan/03-frontend.md) y [04 Integración web–API](plan/04-integration.md). El número identifica el documento; no obliga a ejecutar planes independientes en secuencia. La integración SUNAT valida cada capacidad remota antes de habilitarla; INT-1 e INT-2 tienen su propio seguimiento en el plan 04.
6. [Contrato SUNAT](sunat/contracts.md) y [evidencia de APIs](sunat/BUZON_SOL_APIS.md): servicios observados del visor, no API pública ni garantía de estabilidad.

Los documentos de [requisitos](legacy/requirements.md), [diseño](legacy/design.md) y [tareas](legacy/tasks.md) en `legacy/` describen una **v1 de lector supervisado, de una cuenta/sesión**. Sus reglas verificadas de paginación, lectura y descarga siguen siendo útiles, pero sus decisiones de login manual, almacenamiento local y ausencia de programador **no definen la v2**. Ante conflicto de alcance, usar los documentos de producto actuales; ante una afirmación sobre comportamiento real de SUNAT, exigir la evidencia del [contrato observado](sunat/contracts.md) y no dar por validado lo dibujado en UX.

**Regla de planificación:** todo plan vigente se guarda en `plan/` con un número único. Para la refactorización de arquitectura de API y worker se ejecuta [01 Backend, hito BE-8](plan/01-backend.md#be-8-refactorización-arquitectónica-de-api-y-worker). El [prompt de refactorización](plan/05-backend-architecture-refactor-prompt.md) está en la misma carpeta como material de apoyo para ese hito, no como un segundo plan.

## Fuentes de la v2

- [Proyecto Claude Design de Buzón SOL](https://claude.ai/design/p/28bc9ee9-1a5e-4d16-a303-542e8c875f14?file=Buzon+SOL+-+Dise%C3%B1o+UX.dc.html), importable con el MCP `claude_design` (`https://api.anthropic.com/v1/design/mcp`, autenticación con `/design-login`). Leer `Buzon SOL - Diseño UX.dc.html` y `support.js`. Incluye administración A1–A6, usuario U1, mapa, flujos F1–F7, wireframes W1–W4, escritorio D1/D4–D8/D10, móvil M1–M4, componentes, textos y distinción inventariar/leer. Todos sus datos de ejemplo son ficticios.
- Dos capturas adjuntas por el usuario: «Flujos del usuario» y «Mapa de navegación» del mismo artefacto.
- Los prompts frontend y de tablas adjuntos por el usuario aportan las restricciones técnicas para implementar todos los hitos FE-0 a FE-5. Las reglas CRUD de tablas corresponden a los listados de gestión; Mensajes y Notificaciones conservan las operaciones de lectura definidas por producto.

## Prioridades de interpretación

1. Lo observado en SUNAT prevalece sobre una promesa de la maqueta. En particular, entrar al visor puede abrir automáticamente el primer elemento y cambiar su estado de lectura.
2. Inventariar consulta metadatos; abrir detalle puede marcar como leído. Nunca mezclar ambos bajo una acción genérica.
3. La v2 requiere credenciales SOL cifradas, sesiones desatendidas y tareas programadas. **Esto es un requisito de producto aún no validado técnicamente**, no una capacidad confirmada de SUNAT. La liberación operativa depende de las [pruebas de integración SUNAT](plan/02-sunat-integration.md), en especial login desatendido y arranque pasivo.
4. Ningún ejemplo visual constituye un endpoint, respuesta JSON, permiso de SUNAT o requisito para cambiar estados remotos.
