#!/bin/sh
set -e

echo "[VitaShelf] Running database migrations..."
cd /app && npx prisma migrate deploy

echo "[VitaShelf] Starting API server (port 4001)..."
node /app/dist/index.js &
NODE_PID=$!

# Wait until the API is accepting connections
echo "[VitaShelf] Waiting for API to be ready..."
for i in $(seq 1 30); do
  if wget -qO- http://127.0.0.1:4001/health >/dev/null 2>&1; then
    echo "[VitaShelf] API is ready."
    break
  fi
  sleep 1
done

echo "[VitaShelf] Starting Nginx..."
exec nginx -g "daemon off;"
