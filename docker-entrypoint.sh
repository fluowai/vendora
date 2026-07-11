#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[Entrypoint] Running database migrations..."
  RUNTIME_DATABASE_URL="${DATABASE_URL:-}"
  if [ -n "${MIGRATE_DATABASE_URL:-}" ]; then
    export DATABASE_URL="${MIGRATE_DATABASE_URL}"
  fi
  timeout "${MIGRATE_TIMEOUT_SECONDS:-120}" npx prisma migrate deploy
  if [ -n "${RUNTIME_DATABASE_URL}" ]; then
    export DATABASE_URL="${RUNTIME_DATABASE_URL}"
  fi
  echo "[Entrypoint] Migrations complete."
else
  echo "[Entrypoint] Skipping database migrations. Set RUN_MIGRATIONS=true to run them."
fi

if [ "${RUN_DIALER_TABLE_SYNC:-false}" = "true" ]; then
  echo "[Entrypoint] Ensuring dialer tables..."
  node scripts/ensure-dialer-tables.mjs
  echo "[Entrypoint] Dialer tables ready."
fi

# If WACALLS_URL is not set externally, check if wacalls-server is available
if [ -z "$WACALLS_URL" ] && [ "${ENABLE_EMBEDDED_WACALLS:-false}" = "true" ]; then
  if command -v wacalls-server >/dev/null 2>&1; then
    WACALLS_DB_PATH="${WACALLS_DB_PATH:-/app/data/wacalls.db}"
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
elif [ -n "$WACALLS_URL" ]; then
  echo "[Entrypoint] Using external WaCalls at ${WACALLS_URL}"
else
  echo "[Entrypoint] Embedded WaCalls disabled. Calls will be unavailable unless WACALLS_URL is set."
fi

echo "[Entrypoint] Starting application..."
exec node dist/server.cjs
