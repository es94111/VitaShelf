#!/bin/sh
set -e

# Default DATABASE_URL points at the SQLite volume at /app/data
: "${DATABASE_URL:=file:/app/data/vitashelf.db}"
export DATABASE_URL

# Ensure data directory exists (mounted volume may be empty on first run)
mkdir -p /app/data

# Auto-generate JWT_SECRET if not set
if [ -z "$JWT_SECRET" ]; then
  export JWT_SECRET=$(cat /proc/sys/kernel/random/uuid | tr -d '-')$(cat /proc/sys/kernel/random/uuid | tr -d '-')$(cat /proc/sys/kernel/random/uuid | tr -d '-')$(cat /proc/sys/kernel/random/uuid | tr -d '-')
  echo "[VitaShelf] WARNING: JWT_SECRET not set. Generated a random secret for this session."
  echo "[VitaShelf] WARNING: All sessions will be invalidated on container restart. Set JWT_SECRET to a fixed value to avoid this."
fi

echo "[VitaShelf] Using DATABASE_URL=$DATABASE_URL"
echo "[VitaShelf] Running database migrations..."
cd /app && ./node_modules/.bin/prisma migrate deploy

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
