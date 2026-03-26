# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -S vitashelf && adduser -S vitashelf -G vitashelf

WORKDIR /app

# Only copy production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# Copy compiled output and prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Uploads directory
RUN mkdir -p /app/uploads && chown vitashelf:vitashelf /app/uploads

USER vitashelf

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
