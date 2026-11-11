#!/usr/bin/env bash
# ==============================================================================
# Tuntas — System Diagnostics & Environment Verification Script
# ==============================================================================
set -e

echo "🔍 [1/5] Checking PHP and Composer runtime..."
php -v | head -n 1
composer --version | head -n 1

echo "🔍 [2/5] Checking Node.js and pnpm runtime..."
node -v
pnpm -v

echo "🔍 [3/5] Checking Database & Storage permissions..."
mkdir -p storage/framework/{cache,sessions,views} storage/logs
touch database/database.sqlite
chmod -R 775 storage bootstrap/cache database 2>/dev/null || true

echo "🔍 [4/5] Running Database Migrations..."
php artisan migrate --force

echo "🔍 [5/5] Running Automated Test Suite..."
php artisan test

echo "✅ All diagnostics passed! Tuntas system is healthy and operational."

