#!/usr/bin/env bash
set -e

echo "=== Starting Tuntas Production Container ==="

# 1. Wait for MariaDB / MySQL (RDS) to be reachable
if [ -n "$DB_HOST" ] && { [ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ]; }; then
  echo "Checking database connectivity to $DB_HOST:${DB_PORT:-3306}..."
  MAX_RETRIES=30
  RETRY_COUNT=0
  until php -r "
    try {
      new PDO(
        'mysql:host=' . getenv('DB_HOST') . ';port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_DATABASE'),
        getenv('DB_USERNAME'),
        getenv('DB_PASSWORD'),
        [PDO::ATTR_TIMEOUT => 3, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
      );
      exit(0);
    } catch (\Throwable \$e) {
      exit(1);
    }
  " 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "ERROR: Failed to connect to database at $DB_HOST after ${MAX_RETRIES} attempts. Aborting startup." >&2
      exit 1
    fi
    echo "Database at $DB_HOST not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 2s..."
    sleep 2
  done
  echo "Database is ready and reachable."
fi

# 2. Run database migrations safely with atomic isolation lock
echo "Running database migrations..."
php artisan migrate --force --isolated || {
  echo "WARNING: Isolated migration lock busy or migration finished by another worker. Proceeding..."
}

# 3. Optimize Laravel configuration caches in production
if [ "$APP_ENV" = "production" ]; then
  echo "Caching Laravel configuration, routes, and views..."
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache 2>/dev/null || true
fi

# 4. Start background Queue Worker if database/redis queue is configured
QUEUE_PID=""
if [ "$QUEUE_CONNECTION" != "sync" ] && [ -n "$QUEUE_CONNECTION" ]; then
  echo "Starting background queue worker (connection: $QUEUE_CONNECTION)..."
  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &
  QUEUE_PID=$!
fi

# 5. Start Laravel backend API on internal port 8000
echo "Starting Laravel API on internal port 8000..."
php artisan serve --host=0.0.0.0 --port=8000 &
BACKEND_PID=$!

# 6. Trap termination signals to gracefully shut down background services
trap 'echo "Stopping container..."; kill -TERM $BACKEND_PID $QUEUE_PID 2>/dev/null || true; wait $BACKEND_PID 2>/dev/null || true; exit 0' TERM INT

# 7. Start Next.js frontend on internal port 3000 (public entrypoint proxied to port 80)
echo "Starting Next.js frontend on internal port 3000..."
exec pnpm run start -- -p 3000
