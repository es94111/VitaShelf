# ─── Stage 1: Build Frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Build Backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --prefer-offline
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# ── Backend production deps ──
COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# ── Backend compiled output ──
COPY --from=backend-builder /app/dist             ./dist
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/prisma                               ./prisma

# ── Frontend static files ──
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# ── Nginx config (proxy /api & /uploads to localhost:4001) ──
# node:20-alpine uses Alpine 3.20+ where nginx uses http.d/ instead of conf.d/
COPY nginx.conf /etc/nginx/http.d/app.conf
RUN rm -f /etc/nginx/http.d/default.conf

# ── Uploads directory ──
RUN mkdir -p /app/uploads

# ── Startup script ──
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV API_PORT=4001
ENV CORS_ORIGIN=http://localhost

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["/app/docker-entrypoint.sh"]
