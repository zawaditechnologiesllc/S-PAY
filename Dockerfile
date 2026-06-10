FROM node:20-alpine AS builder
WORKDIR /workspace

# Install pnpm 10 explicitly (corepack in node:20-alpine defaults to pnpm 8
# which cannot parse the pnpm-workspace.yaml overrides used by this repo)
RUN npm install -g pnpm@10

# ── 1. Workspace manifests (dependency layer cache) ─────────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./

# Copy every workspace package.json so pnpm workspace discovery succeeds
COPY artifacts/api-server/package.json    ./artifacts/api-server/package.json
COPY artifacts/web/package.json           ./artifacts/web/package.json
COPY artifacts/mobile/package.json        ./artifacts/mobile/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY lib/api-zod/package.json             ./lib/api-zod/package.json
COPY lib/api-client-react/package.json    ./lib/api-client-react/package.json
COPY lib/api-spec/package.json            ./lib/api-spec/package.json
COPY lib/db/package.json                  ./lib/db/package.json
COPY scripts/package.json                 ./scripts/package.json

RUN pnpm install --frozen-lockfile

# ── 2. Source files needed for the build ────────────────────────────────────
COPY lib/api-zod/src          ./lib/api-zod/src
COPY lib/api-zod/tsconfig.json ./lib/api-zod/tsconfig.json

COPY lib/api-client-react/src           ./lib/api-client-react/src
COPY lib/api-client-react/tsconfig.json ./lib/api-client-react/tsconfig.json

COPY lib/db/src           ./lib/db/src
COPY lib/db/migrations    ./lib/db/migrations
COPY lib/db/tsconfig.json ./lib/db/tsconfig.json

COPY artifacts/api-server/src           ./artifacts/api-server/src
COPY artifacts/api-server/build.mjs     ./artifacts/api-server/build.mjs
COPY artifacts/api-server/tsconfig.json ./artifacts/api-server/tsconfig.json

# ── 3. Type-check lib packages, then bundle the server ──────────────────────
RUN pnpm -w run typecheck:libs
RUN pnpm --filter @workspace/api-server run build

# ── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# esbuild bundles all JS deps; pino transport workers land alongside index.mjs
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# SQL migrations applied automatically on boot (see src/lib/migrate.ts)
COPY --from=builder /workspace/lib/db/migrations ./migrations

EXPOSE 10000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
