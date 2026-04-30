# ─── Stage 1: Build Frontend ──────────────────────────────────────────────────
FROM node:24-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci --prefer-offline
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Build Backend ───────────────────────────────────────────────────
FROM node:24-alpine AS backend-builder

WORKDIR /app

# better-sqlite3 (Prisma 7 driver adapter dep) ships native bindings — needs
# python3 + make + g++ to compile on alpine.
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci --prefer-offline
COPY backend/ ./
# DATABASE_URL placeholder needed because Prisma 7 prisma.config.ts evaluates
# env('DATABASE_URL') eagerly at config load — even for `prisma generate`.
RUN DATABASE_URL=file:/tmp/build-placeholder.db npx prisma generate
RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:24-alpine AS production

# nginx for static frontend; libstdc++ for better-sqlite3 native binding runtime.
RUN apk add --no-cache nginx libstdc++

WORKDIR /app

# ── Prisma schema + config (needed by `prisma migrate deploy` at startup) ──
COPY backend/prisma                               ./prisma
COPY backend/prisma.config.ts                     ./prisma.config.ts

# ── Backend production deps ──
# Build toolchain installed temporarily so `npm ci --omit=dev` can rebuild
# better-sqlite3 against this image's libc / node ABI. Stripped after install.
COPY backend/package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev --prefer-offline && npm cache clean --force \
 && apk del .build-deps

# ── Backend compiled output (includes generated Prisma client at dist/generated/prisma) ──
COPY --from=backend-builder /app/dist             ./dist

# ── Frontend static files ──
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# ── Nginx config (proxy /api & /uploads to localhost:4001) ──
# node:24-alpine uses Alpine 3.20+ where nginx uses http.d/ instead of conf.d/
COPY nginx.conf /etc/nginx/http.d/app.conf
RUN rm -f /etc/nginx/http.d/default.conf

# ── Uploads directory ──
RUN mkdir -p /app/uploads

# ── SQLite data directory ──
RUN mkdir -p /app/data

# ── Changelog (served as static file by nginx) ──
COPY changelog.json /usr/share/nginx/html/changelog.json

# ── Startup script ──
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV API_PORT=4001
ENV CORS_ORIGIN=http://localhost
ENV DATABASE_URL=file:/app/data/vitashelf.db

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["/app/docker-entrypoint.sh"]
