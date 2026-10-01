# 07 · Despliegue con dos dominios

Estado: implementado en código y configuración; falta ejecutarlo en el servidor real.

## Topología

| Origen | Sirve | Cómo |
|---|---|---|
| `https://buzon.<dominio>` | Web (build de Vite en un contenedor nginx) | nginx del host → `127.0.0.1:38081` (contenedor `web`) |
| `https://api.<dominio>` | API `/api/v1` | nginx → `127.0.0.1:38080` (contenedor `api`) |

- Docker Compose (`compose.prod.yml`): `redis`, `migrate`, `api`, `worker`, `web`. MySQL y S3 son externos y se configuran en `apps/api/.env`. Redis solo es accesible dentro de la red de Compose.
- nginx termina TLS (ejemplo en `deploy/nginx/buzon.conf`). No agrega CORS: lo responde la API.
- El worker no abre puertos; solo sale hacia SUNAT, MySQL, Redis y S3.

## Por qué ambos deben compartir dominio padre

La cookie de sesión es `SameSite=Strict`. `buzon.x.com` y `api.x.com` son *same-site* (aunque cross-origin), así que el navegador la envía. Con la web en `*.vercel.app` y la API en otro dominio sería *cross-site* y no funcionaría. Si la web pasa a Vercel, usar un dominio propio bajo el mismo padre.

## Cambios

- **API:** `CORS_ALLOWED_ORIGINS` (orígenes exactos, coma; sin ella no hay cabeceras CORS) en `src/common/cors.ts`, instalado antes del hook de cookie en `main.ts`. `SESSION_COOKIE_DOMAIN` pone `Domain=` solo en `bz_csrf` para que la web la lea; `bz_session` sigue host-only y HttpOnly. Ambas se validan al arrancar (`src/config.ts`).
- **Web:** `VITE_API_URL` (origen de la API, fijado al compilar) y `credentials: "include"` en `HttpClient`. Sin la variable, `/api/v1` relativo (desarrollo con proxy).
- **Compose/Docker:** `compose.prod.yml`; el `Dockerfile` (API y worker) sirve a desarrollo y producción; `Dockerfile.web` compila la web con `VITE_API_URL` y la sirve con nginx (`deploy/web/nginx.conf`).

## Procedimiento

1. DNS: `buzon.<dominio>` y `api.<dominio>` hacia el servidor. Certificados TLS para ambos.
2. Crear en el servidor tres archivos (ninguno va a git; plantillas `.example` al lado):
   - `apps/api/.env` (backend: API, migraciones y worker): `DB_*` (instancia externa; el usuario necesita DDL para `migrate`), `S3_*` (S3 con soporte, bucket privado), `SOL_KEY_ID`, `SOL_PUBLIC_KEY_PEM`, `ACCOUNT_FINGERPRINT_KEY_B64`, `CORS_ALLOWED_ORIGINS=https://buzon.<dominio>`, `SESSION_COOKIE_DOMAIN=<dominio>`.
   - `apps/worker/.env` (opcional, solo worker): `SOL_PRIVATE_KEY_PEM` (y claves previas). Así la API nunca recibe la clave privada. Las puertas `SUNAT_*` van en `apps/api/.env`, porque la API también las lee.
   - `apps/web/.env.production` (frontend): `VITE_API_URL=https://api.<dominio>`.
3. `docker compose -f compose.prod.yml -p buzon up -d --build` (la web se compila dentro de la imagen; cambiar `VITE_API_URL` exige reconstruirla).
4. nginx del host: `deploy/nginx/buzon.conf`.
5. Verificar: `GET https://api.<dominio>/api/v1/health/ready`; iniciar sesión; una acción POST (comprueba CSRF); descargar un archivo.
6. Firewall: entrante solo 80/443 (y SSH restringido). MySQL solo acepta la IP del servidor.

## Pendientes

- Crear el primer administrador (`bootstrap:admin`) en el entorno real.
- El `Dockerfile` ejecuta TypeScript con `tsx`; compilar a JS es una mejora posible, no un requisito.
