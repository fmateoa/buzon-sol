Guía de entrada para agentes que desarrollen Buzón SOL en este repositorio.

Todo plan vigente se guarda en `specs/buzon-sol/plan/` con prefijo numérico de dos dígitos. Cada número debe ser único entre todos los archivos numerados de esa carpeta, incluidos los prompts de apoyo; revisar los existentes y usar el siguiente libre. Al mover archivos, actualizar todos sus enlaces. Para la refactorización de API y worker, ejecutar `specs/buzon-sol/plan/01-backend.md` desde BE-8; `specs/buzon-sol/plan/05-backend-architecture-refactor-prompt.md` es su guía técnica, no otro plan.

## Estado del repositorio

Especificaciones en `specs/buzon-sol/` (en español) para **Buzón SOL v2**, una aplicación interna multiusuario que inventaría y conserva Mensajes y Notificaciones del buzón electrónico SOL de N cuentas SUNAT. Monorepo pnpm (`pnpm-workspace.yaml`: `apps/*`, `packages/*`); no mezclar gestores de paquetes/lockfiles.

- **Frontend (FE-0 a FE-5 hechos):** `apps/web`, con datos ficticios y adaptador local tipado. Ver [apps/web/README.md](apps/web/README.md) para estructura, contrato `BuzonAdapter`, decisiones y pendientes de API.
- **Backend (BE-0 a BE-7 implementados en su alcance técnico; BE-8 pendiente):** `apps/api`, `apps/worker`, `packages/domain`, `packages/sunat-adapter`, `packages/storage`. **Hasta dónde se llegó:** sección «Seguimiento de avance» de [plan/01-backend.md](specs/buzon-sol/plan/01-backend.md#seguimiento-de-avance); leerla antes de continuar y actualizar sus checks en el mismo commit. Configuración, contrato HTTP y pruebas de integración en [apps/api/README.md](apps/api/README.md) (pruebas: `docker compose -f compose.test.yml up -d`; desarrollo: `node scripts/dev-env.mjs` y `docker compose -f compose.dev.yml -p buzon-dev up -d --build`). El worker usa el cliente HTTP real (`SunatHttpSession`) por cuenta; cada trabajo remoto está tras su puerta `SUNAT_*`, apagadas por defecto, que activa el operador y nunca se fijan para simular validación. BE-7 añade el archivo por cuenta (contenido y archivos de elementos ya leídos); BE-8 planifica la refactorización arquitectónica de API y worker.
- **Integración frontend–backend:** [plan/04-integration.md](specs/buzon-sol/plan/04-integration.md). INT-1 (gestión) e INT-2 (buzón: bandejas, actividad, inventario, lectura, archivos y archivo por cuenta) están hechas con `HttpAdapter` (`apps/web/src/adapters/http`); quedan avisos en app y el filtro por carpeta. `pnpm dev` arranca la web contra la API (`apps/web/.env`, proxy `/api` → `127.0.0.1:38080`); `pnpm dev:prototype` usa los datos ficticios. Los secretos locales del backend están en `apps/api/.env` (ignorado por git).
- Comandos desde la raíz: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Prueba única: `pnpm --filter @buzon-sol/web exec vitest run <ruta>`.

`.playwright-cli/` (ignorado por git) contiene artefactos de la exploración con Playwright; no son código del proyecto.

## Cómo leer las specs

Empezar por `specs/buzon-sol/README.md` (orden de lectura y prioridades). Reglas de precedencia importantes:

- `legacy/` describe la **v1** (lector supervisado, una cuenta, login manual, sin programador). Sus reglas de paginación, lectura y descarga siguen valiendo; sus decisiones de alcance **no**. Ante conflicto de alcance mandan `product/`, `backend/` y `frontend/`.
- Lo observado en SUNAT (`sunat/contracts.md`, `sunat/BUZON_SOL_APIS.md`) prevalece sobre lo dibujado en UX. Los endpoints son servicios internos del visor web, no una API pública ni estable.
- Login desatendido, cron y arranque pasivo son **requisitos aún no validados**. `plan/02-sunat-integration.md` define las pruebas S-01–S-20 y las puertas que habilitan cada función. No afirmar en código, UI ni logs capacidades no comprobadas.
- Los planes `plan/03-frontend.md`, `plan/01-backend.md` y `plan/02-sunat-integration.md` son independientes; la conexión frontend–backend se planifica después.

### Ruta de trabajo según el encargo

- **Si el encargo es desarrollar el frontend completo:** leer, en este orden, [índice](specs/buzon-sol/README.md), [producto](specs/buzon-sol/product/requirements.md), [UX/UI](specs/buzon-sol/ux-ui/design.md), [spec frontend](specs/buzon-sol/frontend/spec.md), [plan frontend](specs/buzon-sol/plan/03-frontend.md) y [skill de lizaui](.claude/skills/lizaui-component-reference/SKILL.md). Completar FE-0 a FE-5 con datos ficticios y adaptador local tipado. Consultar la spec backend solo para entender la frontera; no implementar API, worker ni integración real con SUNAT como parte de este encargo.
- **Si el encargo posterior es desarrollar el backend:** leer [índice](specs/buzon-sol/README.md), [producto](specs/buzon-sol/product/requirements.md), [spec backend](specs/buzon-sol/backend/spec.md), [prompt técnico](specs/buzon-sol/backend/prompt.md), [plan backend](specs/buzon-sol/plan/01-backend.md), [plan de pruebas SUNAT](specs/buzon-sol/plan/02-sunat-integration.md) y [contrato observado](specs/buzon-sol/sunat/contracts.md). No sustituir el plan backend por el frontend.
- **Integración frontend–backend:** leer el [plan de integración](specs/buzon-sol/plan/04-integration.md) y actualizar su seguimiento en el mismo commit. Las pantallas solo consumen `BuzonAdapter`; todo cambio de contrato se refleja en `LocalAdapter`, `HttpAdapter` y `apps/api/openapi.yaml`. Para probar con SUNAT, API y worker se ejecutan con Node y las puertas en el entorno (ver [apps/api/README.md](apps/api/README.md)).

## Reglas de dominio que cruzan varios módulos

- **Inventariar ≠ leer.** Inventario solo consulta filas (`listNotiMenPag`, `indEstado`). Abrir detalle (`obtenerDetalleNotiMen`) puede marcar como leído (`0→1`) de forma irreversible. Nunca pedir detalle desde listado, preview, precarga, tooltip o navegación; solo por comando explícito (`readContent`), registrando antes la intención (`mail_read_events`) y con aviso al usuario.
- El archivo automático por cuenta (`ArchiveProcessor`) solo abre elementos con `indEstado<>0`, registra antes `mail_read_events` con `origin='archive'` y se apaga solo si SUNAT responde `updateLeido=true`. No ampliarlo a no leídos sin autorización expresa.
- La web de SUNAT al entrar al visor abre automáticamente el primer ítem; por eso «inventario sin efecto en SUNAT» no puede afirmarse hasta resolver S-04.
- **Paginación:** recorrer `page=1…` hasta una página JSON válida con `rows=[]` (confirmada repitiéndola). `records`/`total` declarados no determinan el fin (caso real: declara 108 páginas, hay 134; 3328 filas únicas). Deduplicar por `(sunat_account_id, tipo_msj, cod_mensaje)`.
- HTML de login/error donde se espera JSON/PDF es error de sesión o descarga, nunca «buzón vacío» ni archivo válido.
- Tres estados separados: estado remoto SUNAT (`indEstado`), estado de descarga y revisión local (`mail_reviews`, nunca se envía a SUNAT).
- `codArchivo=0` no es clave global; descargas con ese valor van secuenciales por cuenta desde el detalle.
- Aislamiento por cuenta: cookie jar, sesión, RUC, archivos y logs nunca se cruzan; toda consulta lleva `account_id` y verifica permiso **y** cuenta concreta.
- Secretos: Clave SOL cifrada con clave fuera de MySQL, solo escritura desde el frontend, jamás en API, auditoría ni logs. No registrar cookies, `token`, `hc`, `state`, `datos`, RUC completo, asuntos ni cuerpos. Sin datos reales en fixtures/HAR/capturas.
- No agregar mover, destacar, marcar urgente ni «marcar como no leído» hasta tener caso de uso y comportamiento remoto verificado.

## Stack previsto

- **Backend** (`backend/prompt.md`, `backend/spec.md`): monorepo pnpm; `apps/api` y `apps/worker` (procesos separados), `packages/domain`, `packages/sunat-adapter`. TypeScript strict, NestJS + Fastify, TypeORM sobre MySQL 8 (`synchronize: false`, migraciones con comando aparte), BullMQ + Redis, MinIO/S3 con bucket privado. API y worker comparten casos de uso; el worker no llama a la API por HTTP. Adaptador SUNAT: primero cliente HTTP con cookie jar por cuenta; Playwright solo si se demuestra dependencia real del navegador. API `/api/v1`, Argon2id, timestamps UTC, zona `America/Lima` para programaciones.
- **Frontend** (`frontend/spec.md`): React 19, TypeScript estricto, Tailwind v4, `lizaui` desde npm, TanStack Query v5 (datos de servidor; no duplicar en Zustand), Formik + Yup. Adaptador de datos local tipado y ficticio hasta que exista backend; el navegador nunca habla con SUNAT. IDs de cuenta/ítem opacos (sin RUC ni token en rutas).
- Diseño de referencia: proyecto Claude Design (URL en el README de specs), importable con el MCP `claude_design`; sus datos son ficticios. Verificar acceso al MCP al iniciar. Si no está disponible, usar el [artefacto UX/UI compartido](https://claude.ai/artifact/9xRxtR7WAqdSRb4zA2zwyD) y [la spec UX/UI local](specs/buzon-sol/ux-ui/design.md), y dejar constancia de cualquier detalle visual que no se haya podido comprobar.

## lizaui

Skill del proyecto: `.claude/skills/lizaui-component-reference/`. Antes de usar un componente, leer su referencia y verificar exports/props contra los `.d.ts` de la versión instalada. Usar `Table` de `lizaui/table` (**no `DataTable`**), `lizaui/modal` (no `Dialog*` de `lizaui/ui`); `Table.BodyRow` no acepta `onClick` (usar un `Button` en la celda). La descripción del skill menciona una ruta de otra máquina (`/Users/leonardo/...`); el código fuente de referencia local está en `C:\Users\cmate\OneDrive\Documentos\busui`, solo para consulta, sin modificarlo.
