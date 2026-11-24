#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Production Queue Worker Daemon
# Managed by Supervisord with graceful stop and log rotation
# ==============================================================================
set -e

HEARTBEAT_FILE="/var/www/html/storage/framework/queue_worker_heartbeat.txt"
LOG_FILE="/var/www/html/storage/logs/queue.log"
MAX_LOG_SIZE_KB=5120 # 5 MB

cleanup() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Signaling Queue Worker to stop gracefully..." >> "$LOG_FILE"
  php artisan queue:restart 2>/dev/null || true
  rm -f "$HEARTBEAT_FILE" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT EXIT

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue Worker daemon initialized (driver: ${QUEUE_CONNECTION:-database})." >> "$LOG_FILE"

while true; do
  # Log rotation check
  if [ -f "$LOG_FILE" ]; then
    SIZE_KB=$(du -k "$LOG_FILE" 2>/dev/null | cut -f1 || echo 0)
    if [ "$SIZE_KB" -gt "$MAX_LOG_SIZE_KB" ]; then
      mv "$LOG_FILE" "${LOG_FILE}.1" 2>/dev/null || true
      touch "$LOG_FILE"
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rotated queue log file (exceeded 5MB)." >> "$LOG_FILE"
    fi
  fi

  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 >> "$LOG_FILE" 2>&1 || {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Queue worker cycled or encountered error (exit code: $?). Restarting in 2s..." >> "$LOG_FILE"
  }
  sleep 2
done
