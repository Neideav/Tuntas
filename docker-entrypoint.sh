#!/usr/bin/env sh
set -e

# Ensure SQLite database directory & file exist
mkdir -p database/data
touch "${DB_DATABASE:-database/data/database.sqlite}" 2>/dev/null || true

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
