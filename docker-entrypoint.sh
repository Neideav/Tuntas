#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Container Entrypoint
# Architecture: Next.js 15 + Laravel 12 (PHP-FPM) + MariaDB + Supervisord
# ==============================================================================
set -e

echo "=== [1/5] Initializing Tuntas Production Environment ==="

# 1. Dependency Preflight Validation
echo "🔍 Running preflight dependency checks..."
for cmd in php flock curl pnpm supervisord php-fpm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ FATAL ERROR: Required system dependency '$cmd' is not available in PATH!" >&2
    exit 1
  fi
done
echo "✅ Core dependencies verified (php, flock, curl, pnpm, supervisord, php-fpm)."

# 2. Apply Timezone from Environment
export TZ="${APP_TIMEZONE:-Asia/Jakarta}"
echo "Timezone configured to: $TZ"

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
rm -f /var/www/html/storage/framework/queue_worker_heartbeat.txt 2>/dev/null || true
rm -f /var/www/html/storage/framework/scheduler.lock 2>/dev/null || true

# 5. Wait for MariaDB / MySQL (RDS) with TLS/SSL CA bundle validation
if [ -n "$DB_HOST" ] && { [ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ]; }; then
  echo "=== [2/5] Checking RDS MariaDB connectivity to $DB_HOST:${DB_PORT:-3306} ==="
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
echo "=== [3/5] Verifying & Executing Database Migrations ==="
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
  echo "=== [4/5] Caching Laravel Configuration & Routes ==="
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache 2>/dev/null || true
fi

# ==============================================================================
# Process Supervision via Supervisord (PID 1)
# ==============================================================================
echo "=== [5/5] Launching Process Supervisor (Supervisord) ==="
echo "Services supervised: PHP-FPM (FastCGI 9000), Next.js (3000), Queue Worker, Scheduler Daemon"
exec /usr/bin/supervisord -c /etc/supervisord.conf
