#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Queue Worker Daemon
# Managed by Supervisord with graceful stop, child PID tracking & heartbeat cleanup
# ==============================================================================
set -e

HEARTBEAT_FILE="/var/www/html/storage/framework/queue_worker_heartbeat.txt"
WORKER_PID=""

cleanup() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue Worker daemon shutting down gracefully..." >&2
  rm -f "$HEARTBEAT_FILE" 2>/dev/null || true
  if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
    php artisan queue:restart 2>/dev/null || true
    kill -TERM "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup TERM INT

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue Worker daemon initialized (driver: ${QUEUE_CONNECTION:-database})."

while true; do
  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &
  WORKER_PID=$!

  if wait "$WORKER_PID"; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue worker completed max-time cycle normally. Restarting..."
  else
    EXIT_CODE=$?
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue worker exited with code $EXIT_CODE. Restarting in 2s..." >&2
  fi

  WORKER_PID=""
  sleep 2
done
