#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Scheduler Daemon
# Managed by Supervisord with exclusive lock, non-looping wait, heartbeat & rotation
# ==============================================================================
set -e

SCHEDULER_LOCK="/var/www/html/storage/framework/scheduler.lock"
HEARTBEAT_FILE="/var/www/html/storage/framework/scheduler_heartbeat.txt"

# Graceful cleanup on SIGTERM / SIGINT
cleanup() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduler daemon shutting down gracefully..." >&2
  rm -f "$HEARTBEAT_FILE" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# Acquire exclusive file lock without exit loop
exec 200>"$SCHEDULER_LOCK"
if ! flock -n 200; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Another scheduler instance holds the lock. Waiting for lock release..." >&2
  while ! flock -n 200; do
    sleep 10
  done
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Lock acquired after wait."
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduler daemon initialized with exclusive lock (PID: $$)."

while true; do
  # Run schedule
  if php artisan schedule:run --no-interaction --verbose; then
    # Heartbeat updated ONLY after schedule:run cycle completes successfully
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HEARTBEAT_FILE"
  else
    EXIT_CODE=$?
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARNING: schedule:run cycle failed with exit code $EXIT_CODE." >&2
    # Do not update heartbeat on failure so it naturally stales/expires if failures persist
  fi

  sleep 60
done
