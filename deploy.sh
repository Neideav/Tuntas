#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Production Deployment Script
# Architecture: Next.js 15 + Laravel 12 + AWS RDS MariaDB + Nginx Reverse Proxy
# ==============================================================================
set -e

echo "=========================================================="
echo "🚀 Starting Tuntas Production Deployment"
echo "=========================================================="

# 1. Pre-flight Checks
echo "🔍 [1/6] Running system pre-flight checks..."
if ! command -v docker &> /dev/null; then
  echo "❌ Error: Docker is not installed. Please install Docker Engine first." >&2
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ Error: Docker Compose v2 plugin is not installed." >&2
  exit 1
fi

# 2. Environment Verification
echo "📄 [2/6] Verifying environment configuration (.env)..."
if [ ! -f .env ]; then
  echo "⚠️ .env file not found. Creating from .env.example..."
  cp .env.example .env
  echo "👉 Action Required: Edit .env with your AWS RDS database credentials before proceeding!"
fi

# Ensure persistent APP_KEY exists in host .env
if ! grep -E '^APP_KEY=base64:[A-Za-z0-9+/=]{44}' .env > /dev/null 2>&1; then
  echo "🔑 Generating persistent APP_KEY in host .env..."
  RANDOM_KEY="base64:$(openssl rand -base64 32)"
  if grep -q '^APP_KEY=' .env; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${RANDOM_KEY}|" .env
  else
    echo "APP_KEY=${RANDOM_KEY}" >> .env
  fi
  echo "✅ Persistent APP_KEY configured."
fi

# 3. Build Docker Images
echo "📦 [3/6] Building production Docker images..."
docker compose build

# 4. Start Containers
echo "🔄 [4/6] Starting containerized services..."
docker compose up -d

# 5. Wait for Container Health
echo "⏳ [5/6] Waiting for services to become healthy..."
TIMEOUT=60
ELAPSED=0
HEALTHY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
  APP_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' tuntas 2>/dev/null || echo "starting")
  NGINX_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' tuntas-nginx 2>/dev/null || echo "starting")

  if [ "$APP_STATUS" = "healthy" ] && [ "$NGINX_STATUS" = "healthy" ]; then
    HEALTHY=true
    break
  fi

  echo "   Services warming up (app: $APP_STATUS, nginx: $NGINX_STATUS)... ($ELAPSED/$TIMEOUT s)"
  sleep 4
  ELAPSED=$((ELAPSED + 4))
done

if [ "$HEALTHY" = true ]; then
  echo "✅ All containers are healthy and operational!"
else
  echo "⚠️ Warning: Healthcheck timeout reached. Current status:"
  docker compose ps
fi

# 6. Verification & Final Status
echo "🌐 [6/6] Verifying API Health Endpoint through Nginx..."
HEALTH_CHECK=$(curl -s -f http://127.0.0.1/api/v1/health 2>/dev/null || echo '{"status":"starting"}')
echo "   Endpoint response: $HEALTH_CHECK"

echo ""
echo "=========================================================="
echo "🎉 Tuntas Production Deployment Complete!"
echo "=========================================================="
docker compose ps
echo ""
echo "👉 Web Access (Direct):  http://YOUR_SERVER_IP (Port 80 via Nginx)"
echo "👉 SSL Activation:       ./scripts/setup-ssl.sh <domain.com> <admin@domain.com>"
echo "👉 Create Administrator: docker compose exec app php artisan admin:create"
echo "👉 View Live Logs:       docker compose logs -f"
echo "=========================================================="
