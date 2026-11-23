#!/usr/bin/env sh
set -e

# Wait for MariaDB/MySQL to be ready
echo "Waiting for database connection..."
until php artisan db:monitor 2>/dev/null || \
      php -r "new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT').';dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'));" 2>/dev/null; do
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
done
echo "Database is ready."

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

# Trap termination signals to shut down child process cleanly
trap 'kill $BACKEND_PID 2>/dev/null || true; exit 0' TERM INT

# Start Next.js frontend in foreground
exec pnpm run start
