#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Automated Production Deployment Script
# ==============================================================================
set -e

echo "🚀 [1/7] Pulling latest production changes..."
git pull origin main

echo "📁 [2/7] Ensuring storage, cache, and database directories exist..."
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache database
touch database/database.sqlite 2>/dev/null || true
chmod -R 775 storage bootstrap/cache database 2>/dev/null || true

# Ensure .env exists
if [ ! -f .env ]; then
  echo "⚠️ .env file not found, creating from .env.example..."
  cp .env.example .env
  php artisan key:generate --force
fi

echo "📦 [3/7] Installing PHP dependencies..."
# Clear cached config first so discovery doesn't fail on stale cache
php artisan config:clear 2>/dev/null || true
composer install --no-dev --optimize-autoloader --no-interaction

echo "📦 [4/7] Installing Node dependencies..."
if ! command -v pnpm &> /dev/null; then
  echo "⚠️ pnpm not found in PATH, enabling via corepack..."
  corepack enable 2>/dev/null || npm install -g pnpm
fi
pnpm install --frozen-lockfile

echo "🏗️ [5/7] Building Next.js frontend bundle..."
pnpm run build

echo "🗄️ [6/7] Executing database migrations..."
php artisan migrate --force

echo "⚡ [7/7] Optimizing caches..."
php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true

# Optional process reloader (PM2 / systemd)
if command -v pm2 &> /dev/null; then
  echo "🔄 Reloading PM2 processes..."
  pm2 reload all --update-env 2>/dev/null || true
fi

echo "🎉 Deployment completed successfully!"
