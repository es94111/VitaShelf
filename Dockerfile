FROM node:20-alpine AS builder

WORKDIR /app

# Build backend from monorepo root context
COPY backend/package*.json ./
RUN npm ci --prefer-offline

COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production

RUN addgroup -S vitashelf && adduser -S vitashelf -G vitashelf

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown vitashelf:vitashelf /app/uploads

USER vitashelf

ENV NODE_ENV=production
ENV PORT=4000
ENV CORS_ORIGIN=http://localhost:3000
ENV JWT_SECRET=change-me-to-a-very-long-random-secret-32-plus

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
