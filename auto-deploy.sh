#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Automated Production Deployment Script
# ==============================================================================
set -e

echo "🚀 [1/6] Pulling latest production changes..."
git pull origin main

echo "📦 [2/6] Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction

echo "📦 [3/6] Installing Node dependencies..."
pnpm install --frozen-lockfile

echo "🏗️ [4/6] Building Next.js frontend bundle..."
pnpm run build

echo "🗄️ [5/6] Executing database migrations..."
php artisan migrate --force

echo "⚡ [6/6] Optimizing caches..."
php artisan config:cache
php artisan route:cache

echo "🎉 Deployment completed successfully!"

