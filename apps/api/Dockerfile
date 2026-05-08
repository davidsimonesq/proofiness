# Proofiness API — production container.
# Targeted at Railway / Fly / any Node-compatible container host.
#
# Single-stage build using node:20-slim. better-sqlite3 ships prebuilt binaries
# for linux-x64 + linux-arm64; npm ci picks the right one and we don't need
# build tooling. If a host platform isn't covered by prebuilds (rare), swap
# the base to node:20 (full Debian) which includes the toolchain.

FROM node:20-slim

WORKDIR /app

# Copy manifests first so dependency install is cached when only source changes.
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# Install all workspace deps. We keep dev deps so tsx (used by the start
# script) is available; the image isn't huge and avoiding a separate build
# step keeps the deploy story simple.
RUN npm ci

# Source.
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

# Railway sets PORT; default 8080 when unset. HOST defaults to 0.0.0.0 in
# production via server.ts (NODE_ENV=production triggers the switch).
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck path: GET /health → {ok: true}.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "-w", "@proofiness/api", "run", "start"]
