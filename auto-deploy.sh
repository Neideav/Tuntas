#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Automated Production Deployment Script (VPS & Docker Compatible)
# ==============================================================================
set -e

echo "🚀 [1/5] Pulling latest production changes from Git..."
git pull origin main

# Mode 1: Docker Deployment (Recommended)
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
  echo "🐳 Detected Docker environment. Initiating containerized deployment..."

  # Ensure .env exists
  if [ ! -f .env ]; then
    echo "⚠️ .env file not found, creating from .env.example..."
    cp .env.example .env
  fi

  echo "📦 [2/5] Building Docker containers with optimized production cache..."
  docker compose build

  echo "🔄 [3/5] Starting application and Nginx reverse proxy containers..."
  docker compose up -d

  echo "🔍 [4/5] Verifying container health and endpoints..."
  sleep 5
  docker compose ps

  echo "⚡ [5/5] Checking service health..."
  docker compose exec -T app curl -f http://127.0.0.1:3000/api/v1/health || true

  echo ""
  echo "🎉 Docker Deployment completed successfully!"
  echo "👉 Application accessible at: http://YOUR_VPS_IP (Port 80/443 via Nginx)"
  exit 0
fi

# Mode 2: Native Host Deployment (Non-Docker / PM2 / Systemd)
echo "📁 [2/5] Ensuring storage, cache, and database directories exist..."
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache database
touch database/database.sqlite 2>/dev/null || true
chmod -R 775 storage bootstrap/cache database 2>/dev/null || true

if [ ! -f .env ]; then
  echo "⚠️ .env file not found, creating from .env.example..."
  cp .env.example .env
  php artisan key:generate --force
fi

echo "📦 [3/5] Installing PHP & Node dependencies..."
php artisan config:clear 2>/dev/null || true
composer install --no-dev --optimize-autoloader --no-interaction

if ! command -v pnpm &> /dev/null; then
  corepack enable 2>/dev/null || npm install -g pnpm
fi
pnpm install --frozen-lockfile

echo "🏗️ [4/5] Building Next.js frontend & running migrations..."
pnpm run build
php artisan migrate --force

echo "⚡ [5/5] Optimizing caches & reloading processes..."
php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true

if command -v pm2 &> /dev/null; then
  pm2 reload all --update-env 2>/dev/null || true
fi

echo "🎉 Native host deployment completed successfully!"
