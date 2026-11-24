#!/usr/bin/env bash
set -e

# Wait for MySQL/MariaDB (RDS) to be ready
if [ -n "$DB_HOST" ] && { [ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ]; }; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-3306}..."
  until php -r "
    new PDO(
      'mysql:host=' . getenv('DB_HOST') . ';port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_DATABASE'),
      getenv('DB_USERNAME'),
      getenv('DB_PASSWORD')
    );
  " 2>/dev/null; do
    echo "Database not ready, retrying in 3s..."
    sleep 3
  done
  echo "Database is ready."
fi

# Run database migrations
php artisan migrate --force

# Optimize Laravel caches in production
if [ "$APP_ENV" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache 2>/dev/null || true
fi

# Start Laravel backend on 0.0.0.0:8000 in background
php artisan serve --host=0.0.0.0 --port=8000 &
BACKEND_PID=$!

# Start background Queue Worker in production if enabled
QUEUE_PID=""
if [ "$QUEUE_CONNECTION" != "sync" ] && [ -n "$QUEUE_CONNECTION" ]; then
  echo "Starting background queue worker..."
  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &
  QUEUE_PID=$!
fi

# Trap termination signals to shut down child process cleanly
trap 'kill $BACKEND_PID $QUEUE_PID 2>/dev/null || true; exit 0' TERM INT

# Start Next.js frontend in foreground
exec pnpm run start
