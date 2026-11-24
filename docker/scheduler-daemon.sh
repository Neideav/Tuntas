#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Production Scheduler Daemon
# Managed by Supervisord with exclusive file lock, heartbeat, and log rotation
# ==============================================================================
set -e

SCHEDULER_LOCK="/var/www/html/storage/framework/scheduler.lock"
HEARTBEAT_FILE="/var/www/html/storage/framework/scheduler_heartbeat.txt"
LOG_FILE="/var/www/html/storage/logs/scheduler.log"
MAX_LOG_SIZE_KB=5120 # 5 MB

# Cleanup heartbeat file when daemon terminates
cleanup() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduler daemon shutting down..." >> "$LOG_FILE"
  rm -f "$HEARTBEAT_FILE" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT EXIT

# Acquire exclusive file lock
exec 200>"$SCHEDULER_LOCK"
if ! flock -n 200; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Another scheduler daemon instance holds the lock. Skipping duplicate runner." >> "$LOG_FILE"
  exit 0
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduler daemon initialized with exclusive lock (PID: $$)." >> "$LOG_FILE"

# Heartbeat created ONLY AFTER acquiring exclusive lock
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HEARTBEAT_FILE"

while true; do
  # Log rotation check (5MB limit)
  if [ -f "$LOG_FILE" ]; then
    SIZE_KB=$(du -k "$LOG_FILE" 2>/dev/null | cut -f1 || echo 0)
    if [ "$SIZE_KB" -gt "$MAX_LOG_SIZE_KB" ]; then
      mv "$LOG_FILE" "${LOG_FILE}.1" 2>/dev/null || true
      touch "$LOG_FILE"
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rotated scheduler log file (exceeded 5MB)." >> "$LOG_FILE"
    fi
  fi

  # Run schedule
  if php artisan schedule:run --no-interaction --verbose >> "$LOG_FILE" 2>&1; then
    # Heartbeat updated ONLY after cycle runs successfully
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HEARTBEAT_FILE"
  else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARNING: schedule:run cycle failed with exit code $?." >> "$LOG_FILE"
  fi

  sleep 60
done
