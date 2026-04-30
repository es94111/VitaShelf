# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# better-sqlite3 (Prisma 7 driver adapter dep) ships native bindings — needs
# python3 + make + g++ to compile on alpine.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
# DATABASE_URL placeholder needed because Prisma 7 prisma.config.ts evaluates
# env('DATABASE_URL') eagerly at config load — even for `prisma generate`.
RUN DATABASE_URL=file:/tmp/build-placeholder.db npx prisma generate
RUN npm run build

# ─── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:24-alpine AS production

# better-sqlite3 native binding needs libstdc++ at runtime. Install it
# explicitly so it survives the `apk del` of build toolchain below.
RUN apk add --no-cache libstdc++

# Build toolchain so `npm ci --omit=dev` can rebuild better-sqlite3 against
# this image's libc / node ABI. Stripped after rebuild to keep image small.
RUN apk add --no-cache --virtual .build-deps python3 make g++

RUN addgroup -S vitashelf && adduser -S vitashelf -G vitashelf

WORKDIR /app

# Only copy production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# Strip build toolchain (keeps libstdc++ since it was installed separately)
RUN apk del .build-deps

# Copy compiled output (includes generated Prisma client at dist/generated/prisma)
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./

# Uploads directory
RUN mkdir -p /app/uploads && chown vitashelf:vitashelf /app/uploads

USER vitashelf

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
