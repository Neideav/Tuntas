#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Container Entrypoint & Process Supervisor
# Architecture: Next.js 15 + Laravel 12 + MariaDB + Queue Worker + Scheduler
# ==============================================================================
set -e

echo "=== [1/7] Initializing Tuntas Production Environment ==="

# 1. Dependency Preflight Validation
echo "🔍 Running preflight dependency checks..."
for cmd in php flock curl pnpm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ FATAL ERROR: Required system dependency '$cmd' is not available in PATH!" >&2
    echo "👉 Ensure Alpine packages (util-linux for flock, nodejs, npm, pnpm) are installed in Dockerfile." >&2
    exit 1
  fi
done
echo "✅ Core dependencies verified (php, flock, curl, pnpm)."

# 2. Apply Timezone and Workers from Environment
export TZ="${APP_TIMEZONE:-Asia/Jakarta}"
export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-8}"
echo "Timezone configured to: $TZ"
echo "PHP CLI Server workers: $PHP_CLI_SERVER_WORKERS"

# 3. Ensure persistent APP_KEY is present (strictly no volatile ephemeral keys)
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
  ENV_KEY=$(grep -E '^APP_KEY=base64:[A-Za-z0-9+/=]{44}' /var/www/html/.env 2>/dev/null | cut -d '=' -f2- || true)
  if [ -n "$ENV_KEY" ]; then
    export APP_KEY="$ENV_KEY"
    echo "Loaded persistent APP_KEY from .env configuration."
  else
    echo "❌ FATAL ERROR: Persistent APP_KEY is missing in .env and environment!" >&2
    echo "👉 Laravel requires a persistent APP_KEY to secure sessions, passwords, and tokens across reboots." >&2
    echo "👉 Generate a permanent key on your host and add it to your .env file:" >&2
    echo "   php -r 'echo \"base64:\" . base64_encode(random_bytes(32)) . PHP_EOL;'" >&2
    echo "   Or run: ./deploy.sh which provisions this automatically." >&2
    exit 1
  fi
fi

# 4. Ensure storage and bootstrap/cache permissions are compliant (chmod 775, no 777)
mkdir -p storage/framework/cache/data \
         storage/framework/sessions \
         storage/framework/views \
         storage/logs \
         bootstrap/cache
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# Clean up any stale heartbeat and lock files from prior crashes
rm -f /var/www/html/storage/framework/scheduler_heartbeat.txt 2>/dev/null || true
rm -f /var/www/html/storage/framework/scheduler.lock 2>/dev/null || true

# 5. Wait for MariaDB / MySQL (RDS) with TLS/SSL CA bundle validation
if [ -n "$DB_HOST" ] && { [ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ]; }; then
  echo "=== [2/7] Checking RDS MariaDB connectivity to $DB_HOST:${DB_PORT:-3306} ==="
  MAX_RETRIES=30
  RETRY_COUNT=0
  until php -r "
    \$host = getenv('DB_HOST');
    \$port = getenv('DB_PORT') ?: 3306;
    \$database = getenv('DB_DATABASE');
    \$username = getenv('DB_USERNAME');
    \$password = getenv('DB_PASSWORD');
    \$sslCa = getenv('MYSQL_ATTR_SSL_CA');
    \$verifyCert = getenv('DB_SSL_VERIFY_CERT');

    \$dsn = 'mysql:host=' . \$host . ';port=' . \$port;
    if (\$database) {
      \$dsn .= ';dbname=' . \$database;
    }

    \$options = [
      PDO::ATTR_TIMEOUT => 3,
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ];

    if (\$sslCa && file_exists(\$sslCa)) {
      \$options[PDO::MYSQL_ATTR_SSL_CA] = \$sslCa;
      if (\$verifyCert !== false && \$verifyCert !== 'false' && \$verifyCert !== '0') {
        \$options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
      }
    }

    try {
      new PDO(\$dsn, \$username, \$password, \$options);
      exit(0);
    } catch (\Throwable \$e) {
      fwrite(STDERR, 'Connection attempt failed: ' . \$e->getMessage() . PHP_EOL);
      exit(1);
    }
  "; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "❌ FATAL ERROR: Failed to connect to RDS database at $DB_HOST after ${MAX_RETRIES} attempts." >&2
      echo "👉 Verify DB_HOST, credentials, AWS Security Group inbound port 3306, and SSL CA bundle." >&2
      exit 1
    fi
    echo "Database at $DB_HOST not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 2s..."
    sleep 2
  done
  echo "✅ Database connection verified successfully."
fi

# 6. Execute database migrations with fresh-deployment lockfile resilience
echo "=== [3/7] Verifying & Executing Database Migrations ==="
HAS_CACHE_LOCKS=$(php -r "
  require 'vendor/autoload.php';
  \$app = require_once 'bootstrap/app.php';
  \$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
  try {
    echo \Illuminate\Support\Facades\Schema::hasTable('cache_locks') ? '1' : '0';
  } catch (\Throwable \$e) {
    echo '0';
  }
" 2>/dev/null || echo "0")

if [ "$HAS_CACHE_LOCKS" = "1" ]; then
  echo "Existing database schema detected. Running migrations with atomic isolation lock..."
  if ! php artisan migrate --force --isolated; then
    echo "❌ FATAL ERROR: Migration with atomic isolation lock failed!" >&2
    echo "👉 If lock was left orphaned by an abrupt termination, run: php artisan cache:forget 'illuminate:migrations'" >&2
    exit 1
  fi
else
  echo "Fresh deployment detected (cache_locks table not yet created)."
  echo "Running initial database migration directly..."
  if ! php artisan migrate --force; then
    echo "❌ FATAL ERROR: Initial migration failed to create database tables!" >&2
    exit 1
  fi
fi
echo "✅ Database migrations up-to-date."

# 7. Warm up Laravel configuration and route caches in production
if [ "$APP_ENV" = "production" ]; then
  echo "=== [4/7] Caching Laravel Configuration & Routes ==="
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache 2>/dev/null || true
fi

# ==============================================================================
# Process Supervision & Lifecycle Management
# ==============================================================================
QUEUE_PID=""
SCHEDULER_PID=""
BACKEND_PID=""
NEXT_PID=""
SHUTDOWN_IN_PROGRESS=0

# Helper to terminate a process and all its child processes cleanly
kill_process_tree() {
  local target_pid=$1
  local sig=${2:-TERM}
  if [ -n "$target_pid" ] && kill -0 "$target_pid" 2>/dev/null; then
    # Kill direct children first (e.g. node spawned by pnpm, php workers)
    pkill -P "$target_pid" -"$sig" 2>/dev/null || true
    kill -"$sig" "$target_pid" 2>/dev/null || true
  fi
}

cleanup() {
  local exit_code=${1:-0}
  SHUTDOWN_IN_PROGRESS=1
  echo ""
  echo "⚠️ Initiating graceful shutdown of all services (exit code: $exit_code)..."

  # 1. Gracefully stop Queue Worker (signals workers to finish current job)
  if [ -n "$QUEUE_PID" ] && kill -0 "$QUEUE_PID" 2>/dev/null; then
    echo "Stopping Queue Worker (PID: $QUEUE_PID)..."
    php artisan queue:restart 2>/dev/null || true
    kill_process_tree "$QUEUE_PID" TERM
  fi

  # 2. Stop Scheduler Daemon
  if [ -n "$SCHEDULER_PID" ] && kill -0 "$SCHEDULER_PID" 2>/dev/null; then
    echo "Stopping Scheduler Daemon (PID: $SCHEDULER_PID)..."
    kill_process_tree "$SCHEDULER_PID" TERM
  fi

  # 3. Stop Next.js Frontend
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" 2>/dev/null; then
    echo "Stopping Next.js Frontend (PID: $NEXT_PID)..."
    kill_process_tree "$NEXT_PID" TERM
  fi

  # 4. Stop Laravel Backend API
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Stopping Laravel API (PID: $BACKEND_PID)..."
    kill_process_tree "$BACKEND_PID" TERM
  fi

  # 5. Wait for child processes to exit with a 15-second shutdown timeout
  echo "Waiting up to 15s for all processes to terminate cleanly..."
  SHUTDOWN_TIMEOUT=15
  WAITED=0
  while [ $WAITED -lt $SHUTDOWN_TIMEOUT ]; do
    ALIVE=0
    for pid in $QUEUE_PID $SCHEDULER_PID $NEXT_PID $BACKEND_PID; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        ALIVE=1
        break
      fi
    done
    if [ $ALIVE -eq 0 ]; then
      break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
  done

  # Force kill any lingering stubborn processes after timeout to prevent orphan zombies
  for pid in $QUEUE_PID $SCHEDULER_PID $NEXT_PID $BACKEND_PID; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "Force killing lingering process PID $pid..."
      kill_process_tree "$pid" KILL
    fi
  done

  # Delete heartbeat file on shutdown
  rm -f /var/www/html/storage/framework/scheduler_heartbeat.txt 2>/dev/null || true
  rm -f /var/www/html/storage/framework/scheduler.lock 2>/dev/null || true

  echo "✅ All processes stopped. Container exiting with code $exit_code."
  exit "$exit_code"
}

# Trap termination signals to exit cleanly with 0
trap 'cleanup 0' TERM INT

# 8. Start Background Queue Worker (Self-contained subshell with TERM trap)
if [ "$QUEUE_CONNECTION" != "sync" ] && [ -n "$QUEUE_CONNECTION" ]; then
  echo "=== [5/7] Starting Background Queue Worker (driver: $QUEUE_CONNECTION) ==="
  (
    trap 'exit 0' TERM INT
    while true; do
      php artisan queue:work --sleep=3 --tries=3 --max-time=3600 || true
      sleep 2
    done
  ) &
  QUEUE_PID=$!
  echo "Queue Worker started (PID: $QUEUE_PID)."
fi

# 9. Start Background Laravel Scheduler Daemon (Exclusive flock + heartbeat)
echo "=== [6/7] Starting Production Laravel Scheduler Daemon ==="
touch /var/www/html/storage/logs/scheduler.log
SCHEDULER_LOCK="/var/www/html/storage/framework/scheduler.lock"
HEARTBEAT_FILE="/var/www/html/storage/framework/scheduler_heartbeat.txt"

(
  # Clean up heartbeat file if scheduler subshell exits
  trap 'rm -f "$HEARTBEAT_FILE" 2>/dev/null || true; exit 0' TERM INT EXIT

  exec 200>"$SCHEDULER_LOCK"
  if ! flock -n 200; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Another scheduler daemon instance holds the lock. Skipping duplicate runner." >> /var/www/html/storage/logs/scheduler.log
    exit 0
  fi

  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scheduler daemon initialized with exclusive lock (PID: $$)." >> /var/www/html/storage/logs/scheduler.log
  
  # Heartbeat is created ONLY AFTER acquiring exclusive lock
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HEARTBEAT_FILE"

  while true; do
    if php artisan schedule:run --no-interaction --verbose >> /var/www/html/storage/logs/scheduler.log 2>&1; then
      # Heartbeat updated ONLY after cycle runs
      date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HEARTBEAT_FILE"
    else
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARNING: schedule:run cycle failed with exit code $?." >> /var/www/html/storage/logs/scheduler.log
    fi
    sleep 60
  done
) &
SCHEDULER_PID=$!
echo "Scheduler Daemon started (PID: $SCHEDULER_PID)."

# 10. Start Laravel Backend API on internal port 8000
echo "=== [7/7] Starting Laravel API on internal port 0.0.0.0:8000 ==="
php artisan serve --host=0.0.0.0 --port=8000 &
BACKEND_PID=$!
echo "Laravel API started (PID: $BACKEND_PID)."

# 11. Start Next.js Frontend Web on internal port 3000
echo "=== Starting Next.js Web on internal port 0.0.0.0:3000 ==="
pnpm run start -- -p 3000 -H 0.0.0.0 &
NEXT_PID=$!
echo "Next.js Web started (PID: $NEXT_PID)."

echo ""
echo "🚀 Tuntas Container Process Supervisor running (PID: $$). All services active."

# Main Process Health Monitoring Loop
while [ "$SHUTDOWN_IN_PROGRESS" = "0" ]; do
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    echo "❌ FATAL: Next.js process (PID: $NEXT_PID) died unexpectedly!" >&2
    cleanup 1
  fi

  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ FATAL: Laravel API process (PID: $BACKEND_PID) died unexpectedly!" >&2
    cleanup 1
  fi

  sleep 2
done
