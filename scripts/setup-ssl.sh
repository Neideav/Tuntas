#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Automated SSL / HTTPS Provisioning Script (Certbot + Nginx)
# Usage: ./scripts/setup-ssl.sh <domain.com> [admin-email]
# Example: ./scripts/setup-ssl.sh tuntas.id admin@tuntas.id
# ==============================================================================
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ]; then
  echo "❌ Error: Domain is required."
  echo "Usage: $0 <domain.com> [admin-email]"
  echo "Example: $0 tuntas.id admin@tuntas.id"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@${DOMAIN}"
fi

echo "======================================================"
echo "🔒 Tuntas Production SSL Provisioning for: ${DOMAIN}"
echo "📧 Notification Email: ${EMAIL}"
echo "======================================================"

# 1. Verify Docker Compose Services are Running
echo "🔍 [1/6] Verifying running services..."
if ! docker compose ps | grep -q "tuntas-nginx"; then
  echo "⚠️ tuntas-nginx container is not running. Starting services..."
  docker compose up -d
  sleep 4
fi

# 2. Validate DNS Resolution for Domain
echo "🌐 [2/6] Validating DNS resolution for ${DOMAIN}..."
DOMAIN_IP=""
if command -v getent &> /dev/null; then
  DOMAIN_IP=$(getent hosts "${DOMAIN}" | awk '{ print $1 }' | head -n 1 || true)
elif command -v host &> /dev/null; then
  DOMAIN_IP=$(host "${DOMAIN}" | grep "has address" | awk '{ print $4 }' | head -n 1 || true)
fi

if [ -n "$DOMAIN_IP" ]; then
  echo "✅ Domain ${DOMAIN} resolves to IP: ${DOMAIN_IP}"
else
  echo "⚠️ Warning: Could not resolve IP for ${DOMAIN} locally. Ensure your DNS A record points to this server's public IP!"
fi

# 3. Validate ACME HTTP-01 Challenge Endpoint via Nginx
echo "📡 [3/6] Validating ACME Webroot challenge path through Nginx..."
TEST_TOKEN="tuntas-acme-validation-$(date +%s)"
# Write a temporary test token into the shared webroot volume
docker compose exec -T nginx sh -c "echo '${TEST_TOKEN}' > /var/www/certbot/.well-known/acme-challenge/test-check.txt" || {
  echo "❌ FATAL: Cannot write challenge token to /var/www/certbot/.well-known/acme-challenge/" >&2
  exit 1
}

# Verify web server responds to the challenge path
CHALLENGE_RESPONSE=$(curl -s -f "http://127.0.0.1/.well-known/acme-challenge/test-check.txt" || true)
docker compose exec -T nginx rm -f /var/www/certbot/.well-known/acme-challenge/test-check.txt

if [ "$CHALLENGE_RESPONSE" != "$TEST_TOKEN" ]; then
  echo "❌ FATAL: ACME challenge path validation failed! Nginx did not serve challenge token." >&2
  echo "👉 Ensure port 80 is not blocked and Nginx reverse proxy configuration is active." >&2
  exit 1
fi
echo "✅ ACME HTTP-01 challenge path is accessible."

# 4. Request Certificate from Let's Encrypt via Certbot Webroot (without aggressive --force-renewal)
echo "📜 [4/6] Requesting SSL certificate from Let's Encrypt..."
CERT_SUCCESS=false

# First attempt with root domain and www subdomain
if docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}"; then
  CERT_SUCCESS=true
else
  echo "⚠️ Failed with www.${DOMAIN}. Attempting single domain ${DOMAIN}..."
  if docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    -d "${DOMAIN}"; then
    CERT_SUCCESS=true
  fi
fi

if [ "$CERT_SUCCESS" != true ]; then
  echo "❌ FATAL: Certbot failed to obtain an SSL certificate from Let's Encrypt." >&2
  exit 1
fi

# 5. Validate Certificate Files Existence before modifying Nginx
echo "🔎 [5/6] Validating generated certificate files..."
if ! docker compose run --rm certbot test -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
  echo "❌ FATAL: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem not found!" >&2
  exit 1
fi
if ! docker compose run --rm certbot test -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"; then
  echo "❌ FATAL: /etc/letsencrypt/live/${DOMAIN}/privkey.pem not found!" >&2
  exit 1
fi
echo "✅ Certificate files verified."

# 6. Generate Nginx SSL Configuration & Reload
echo "⚙️ [6/6] Generating Nginx SSL configuration and testing syntax..."
TEMPLATE_FILE="docker/nginx/conf.d/ssl.conf.template"
TARGET_FILE="docker/nginx/conf.d/ssl.conf"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "❌ FATAL: Template file $TEMPLATE_FILE not found!" >&2
  exit 1
fi

# Backup existing ssl.conf if present
if [ -f "$TARGET_FILE" ]; then
  cp "$TARGET_FILE" "${TARGET_FILE}.bak"
fi

sed "s/{{DOMAIN}}/${DOMAIN}/g" "$TEMPLATE_FILE" > "$TARGET_FILE"

# Test Nginx syntax inside the container
if ! docker compose exec nginx nginx -t; then
  echo "❌ FATAL: Nginx syntax test failed after generating SSL config! Reverting changes..." >&2
  if [ -f "${TARGET_FILE}.bak" ]; then
    mv "${TARGET_FILE}.bak" "$TARGET_FILE"
  else
    rm -f "$TARGET_FILE"
  fi
  docker compose exec nginx nginx -s reload 2>/dev/null || true
  exit 1
fi

rm -f "${TARGET_FILE}.bak" 2>/dev/null || true
docker compose exec nginx nginx -s reload
echo "✅ Nginx reloaded successfully with SSL active."

# 7. Configure Automated Renewal Crontab on Host
CRON_CMD="0 3 * * * cd $(pwd) && docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1"
(crontab -l 2>/dev/null | grep -F "certbot renew" || (crontab -l 2>/dev/null; echo "$CRON_CMD")) | crontab -
echo "✅ Automated daily certificate renewal configured in crontab (03:00 daily)."

echo ""
echo "=========================================================="
echo "🎉 SUCCESS: HTTPS SSL Activated for ${DOMAIN}!"
echo "=========================================================="
echo "👉 Application URL:        https://${DOMAIN}"
echo "👉 Direct IP Access:       http://YOUR_SERVER_IP (Remains fully accessible via HTTP)"
echo ""
echo "👉 ACTION REQUIRED: Update your host .env file for HTTPS session security:"
echo "   SESSION_SECURE_COOKIE=true"
echo "   APP_URL=https://${DOMAIN}"
echo "   FRONTEND_URL=https://${DOMAIN}"
echo "   CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}"
echo "   SANCTUM_STATEFUL_DOMAINS=${DOMAIN},www.${DOMAIN}"
echo "   Then run: docker compose exec app php artisan config:cache"
echo "=========================================================="
