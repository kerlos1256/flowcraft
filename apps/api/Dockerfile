# Flowcraft API image (NestJS + Inngest serve). Multi-stage pnpm workspace build.
# Deploys to Render as a Docker web service. On boot it applies pending Prisma
# migrations, then starts — so a fresh Neon database is set up automatically.
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# OpenSSL is needed by Prisma's query engine on slim images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# ── Install deps (workspace-aware) ──────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @flowcraft/api...

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @flowcraft/shared-types build \
 && pnpm --filter @flowcraft/api exec prisma generate \
 && pnpm --filter @flowcraft/api build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/shared-types /repo/packages/shared-types
COPY --from=build /repo/apps/api /repo/apps/api
WORKDIR /repo/apps/api
# Render provides PORT; the app reads API_PORT, so map it at start.
ENV API_PORT=10000
EXPOSE 10000
# Apply migrations, then boot. INNGEST_* (event/signing keys) come from the host.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
