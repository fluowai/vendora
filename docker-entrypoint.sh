#!/bin/sh
set -e

echo "[Entrypoint] Running database migrations..."
npx prisma migrate deploy
echo "[Entrypoint] Migrations complete."

# If WACALLS_URL is not set externally, check if wacalls-server is available
if [ -z "$WACALLS_URL" ]; then
  if command -v wacalls-server >/dev/null 2>&1; then
    WACALLS_DB_PATH="${WACALLS_DB_PATH:-/data/wacalls.db}"
    WACALLS_PORT="${WACALLS_PORT:-8081}"
    echo "[Entrypoint] Starting embedded WaCalls server on :${WACALLS_PORT}..."
    mkdir -p "$(dirname "$WACALLS_DB_PATH")"
    wacalls-server -addr ":${WACALLS_PORT}" -db "${WACALLS_DB_PATH}" &
    WACALLS_PID=$!
    echo "[Entrypoint] WaCalls PID: ${WACALLS_PID}"
    export WACALLS_URL="http://localhost:${WACALLS_PORT}"
    sleep 2
  else
    echo "[Entrypoint] wacalls-server not found. Calls will be unavailable."
  fi
else
  echo "[Entrypoint] Using external WaCalls at ${WACALLS_URL}"
fi

echo "[Entrypoint] Starting application..."
exec node dist/server.cjs
