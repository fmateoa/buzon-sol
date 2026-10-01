# API and worker image for local development. Both run TypeScript through tsx; the frontend is not included.
FROM node:24-bookworm-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/storage/package.json packages/storage/
COPY packages/sunat-adapter/package.json packages/sunat-adapter/
RUN pnpm install --frozen-lockfile --filter "@buzon-sol/api..." --filter "@buzon-sol/worker..."
COPY packages packages
COPY apps/api apps/api
COPY apps/worker apps/worker
USER node
