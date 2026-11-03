# syntax=docker/dockerfile:1.7
# One image, two roles:  web (Next.js)  and  worker (agents + video editing).
#   docker build --target web -t studio-web .
#   docker build --target worker -t studio-worker .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @studio/web build

# ---------- web ----------
FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---------- worker ----------
FROM base AS worker
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip fonts-noto-core ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages faster-whisper \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PYTHON_BIN=python3 SUBTITLE_FONT="Noto Sans Arabic" \
    EDIT_REEL_SCRIPT=/app/apps/worker/tools/edit_reel.py HF_HOME=/models
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
WORKDIR /app/apps/worker
CMD ["npx", "tsx", "src/index.ts"]
