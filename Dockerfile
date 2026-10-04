# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

# Keep NODE_VERSION on a current LTS release.
ARG NODE_VERSION=24.13.0-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

# Copy package-related files first to leverage Docker's caching mechanism
COPY package.json pnpm-lock.yaml ./

# Install project dependencies with frozen lockfile for reproducible builds
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable pnpm && pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG RELEASE_VERSION
ENV BUILD_VERSION=$RELEASE_VERSION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && pnpm build

# ============================================
# Stage 3: Run Next.js application
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ARG RELEASE_VERSION
ENV BUILD_VERSION=$RELEASE_VERSION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Set the correct permission for prerender cache
RUN mkdir .next && chown node:node .next

# The project has no public/ directory yet. If one is added, copy it too:
# COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]
