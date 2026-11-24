#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Container Entrypoint
# ==============================================================================
set -e

echo "=== [1/7] Initializing Tuntas Production Environment ==="

# 1. Apply Timezone from Environment
export TZ="${APP_TIMEZONE:-Asia/Jakarta}"
echo "Timezone configured to: $TZ"

# 2. Ensure persistent APP_KEY is present (strictly no volatile ephemeral keys)
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
  # Check if defined inside .env
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

# 3. Ensure storage and bootstrap/cache permissions are compliant (chmod 775, no 777)
mkdir -p storage/framework/cache/data \
         storage/framework/sessions \
         storage/framework/views \
         storage/logs \
         bootstrap/cache
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# 4. Wait for MariaDB / MySQL (RDS) with TLS/SSL CA bundle validation
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

# 5. Execute database migrations with fresh-deployment lockfile resilience
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

# 6. Warm up Laravel configuration and route caches in production
if [ "$APP_ENV" = "production" ]; then
  echo "=== [4/7] Caching Laravel Configuration & Routes ==="
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache 2>/dev/null || true
fi

# 7. Start Background Queue Worker
QUEUE_PID=""
if [ "$QUEUE_CONNECTION" != "sync" ] && [ -n "$QUEUE_CONNECTION" ]; then
  echo "=== [5/7] Starting Background Queue Worker (driver: $QUEUE_CONNECTION) ==="
  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &
  QUEUE_PID=$!
fi

# 8. Start Laravel Backend API on internal port 8000 (accessible by Nginx container)
echo "=== [6/7] Starting Laravel API on internal port 0.0.0.0:8000 ==="
php artisan serve --host=0.0.0.0 --port=8000 &
BACKEND_PID=$!

# 9. Graceful shutdown handler for container SIGTERM / SIGINT
cleanup() {
  echo "Caught termination signal. Gracefully stopping services..."
  if [ -n "$QUEUE_PID" ]; then
    echo "Signaling queue worker to stop gracefully..."
    php artisan queue:restart 2>/dev/null || true
    kill -TERM "$QUEUE_PID" 2>/dev/null || true
    wait "$QUEUE_PID" 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ]; then
    echo "Stopping Laravel API..."
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup TERM INT

# 10. Start Next.js Frontend on internal port 3000 (foreground process)
echo "=== [7/7] Starting Next.js Frontend on internal port 3000 ==="
exec pnpm run start -- -p 3000 -H 0.0.0.0
