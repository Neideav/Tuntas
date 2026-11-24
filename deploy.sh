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
echo "🔍 [1/7] Running system pre-flight checks..."
if ! command -v docker &> /dev/null; then
  echo "❌ FATAL: Docker is not installed. Please install Docker Engine first." >&2
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ FATAL: Docker Compose v2 plugin is not installed." >&2
  exit 1
fi

# 2. Environment Verification (.env)
echo "📄 [2/7] Verifying environment configuration (.env)..."
if [ ! -f .env ]; then
  echo "⚠️ .env file not found. Initializing from .env.example..."
  cp .env.example .env
  echo "👉 Action Required: Populate .env with production database credentials before proceeding!"
  exit 1
fi

# Validate essential environment keys
for VAR in DB_HOST DB_DATABASE DB_USERNAME; do
  VAL=$(grep -E "^${VAR}=" .env 2>/dev/null | cut -d '=' -f2- | tr -d ' "' || true)
  if [ -z "$VAL" ]; then
    echo "❌ FATAL: Required environment variable $VAR is empty in .env!" >&2
    exit 1
  fi
done

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

# 3. Validate Docker Compose Configuration
echo "⚙️ [3/7] Validating Docker Compose configuration..."
if ! docker compose config --quiet; then
  echo "❌ FATAL: Docker Compose configuration syntax error!" >&2
  docker compose config
  exit 1
fi
echo "✅ Docker Compose syntax valid."

# 4. Build Production Docker Images
echo "📦 [4/7] Building production Docker images..."
if ! docker compose build; then
  echo "❌ FATAL: Docker build failed! Aborting deployment." >&2
  exit 1
fi
echo "✅ Docker images built successfully."

# 5. Start Containerized Services
echo "🔄 [5/7] Starting containerized services..."
if ! docker compose up -d; then
  echo "❌ FATAL: Failed to start Docker Compose services!" >&2
  exit 1
fi

# 6. Wait for Container Health
echo "⏳ [6/7] Waiting for services to become healthy..."
TIMEOUT=120
ELAPSED=0
HEALTHY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
  APP_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' tuntas 2>/dev/null || echo "starting")
  NGINX_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' tuntas-nginx 2>/dev/null || echo "starting")

  if [ "$APP_STATUS" = "healthy" ] && [ "$NGINX_STATUS" = "healthy" ]; then
    HEALTHY=true
    break
  fi

  echo "   Services warming up (app: $APP_STATUS, nginx: $NGINX_STATUS)... ($ELAPSED/${TIMEOUT}s)"
  sleep 4
  ELAPSED=$((ELAPSED + 4))
done

if [ "$HEALTHY" != true ]; then
  echo "❌ FATAL: Healthcheck timeout reached after ${TIMEOUT}s!" >&2
  echo "=== Container Status ===" >&2
  docker compose ps >&2
  echo "=== Application Container Logs ===" >&2
  docker compose logs --tail=50 app >&2
  echo "=== Nginx Container Logs ===" >&2
  docker compose logs --tail=30 nginx >&2
  exit 1
fi
echo "✅ All containers are healthy and operational!"

# 7. Verification of Public API Gateway through Nginx
echo "🌐 [7/7] Verifying API Health Endpoint through Nginx gateway (Port 80)..."
HEALTH_HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" http://127.0.0.1/api/v1/health || echo "000")

if [ "$HEALTH_HTTP_CODE" != "200" ]; then
  echo "❌ FATAL: API healthcheck returned HTTP $HEALTH_HTTP_CODE (expected 200)!" >&2
  cat /tmp/health_response.json 2>/dev/null || true
  echo "" >&2
  echo "=== Application Container Logs ===" >&2
  docker compose logs --tail=50 app >&2
  exit 1
fi

if grep -q '"status":"degraded"' /tmp/health_response.json 2>/dev/null; then
  echo "❌ FATAL: API health status is DEGRADED! Core service disconnected or inactive." >&2
  cat /tmp/health_response.json >&2
  echo "" >&2
  echo "=== Application Container Logs ===" >&2
  docker compose logs --tail=50 app >&2
  exit 1
fi

echo "   Endpoint response:"
cat /tmp/health_response.json 2>/dev/null || true
echo ""

echo "=========================================================="
echo "🎉 Tuntas Production Deployment Complete & Verified Healthy!"
echo "=========================================================="
docker compose ps
echo ""
echo "👉 Direct Web Access:    http://YOUR_SERVER_IP"
echo "👉 SSL Activation:       ./scripts/setup-ssl.sh <domain.com> <admin@domain.com>"
echo "👉 Create Administrator: docker compose exec app php artisan admin:create"
echo "👉 View Live Logs:       docker compose logs -f"
echo "=========================================================="
