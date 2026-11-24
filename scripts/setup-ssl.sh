#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Hardened Automated SSL / HTTPS Provisioning Script (Certbot + Nginx)
# Usage: ./scripts/setup-ssl.sh <domain.com> [admin-email]
# Dry-run: ./scripts/setup-ssl.sh --dry-run
# Example: ./scripts/setup-ssl.sh tuntas.id admin@tuntas.id
# ==============================================================================
set -e

# Handle Dry-Run Renewal Mode
if [ "$1" = "--dry-run" ] || [ "$1" = "dry-run" ]; then
  echo "======================================================"
  echo "🧪 Running Certbot Certificate Renewal Dry-Run Test"
  echo "======================================================"
  docker compose run --rm certbot renew --dry-run
  echo "✅ Renewal dry-run simulation completed successfully."
  exit 0
fi

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ]; then
  echo "❌ Error: Domain is required."
  echo "Usage: $0 <domain.com> [admin-email]"
  echo "   Or: $0 --dry-run"
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

# 3. Create challenge directory & Validate ACME HTTP-01 Challenge Endpoint via Nginx
echo "📡 [3/6] Setting up & validating ACME Webroot challenge path through Nginx..."
TEST_TOKEN="tuntas-acme-validation-$(date +%s)"

# Ensure ACME challenge directory exists inside webroot before writing check file
docker compose exec -T nginx mkdir -p /var/www/certbot/.well-known/acme-challenge || {
  echo "❌ FATAL: Failed to create /var/www/certbot/.well-known/acme-challenge directory!" >&2
  exit 1
}

# Write test token file into webroot
docker compose exec -T nginx sh -c "echo '${TEST_TOKEN}' > /var/www/certbot/.well-known/acme-challenge/test-check.txt" || {
  echo "❌ FATAL: Cannot write challenge token to /var/www/certbot/.well-known/acme-challenge/" >&2
  exit 1
}

# Verify web server responds to the challenge path over HTTP
CHALLENGE_RESPONSE=$(curl -s -f "http://127.0.0.1/.well-known/acme-challenge/test-check.txt" || true)
docker compose exec -T nginx rm -f /var/www/certbot/.well-known/acme-challenge/test-check.txt

if [ "$CHALLENGE_RESPONSE" != "$TEST_TOKEN" ]; then
  echo "❌ FATAL: ACME HTTP-01 challenge path validation failed!" >&2
  echo "   Nginx did not return the expected challenge verification token." >&2
  echo "👉 Ensure port 80 is not blocked by firewall (UFW/AWS Security Group) and Nginx reverse proxy is running." >&2
  exit 1
fi
echo "✅ ACME HTTP-01 challenge path verified successfully through Nginx."

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
  echo "❌ FATAL: Certbot failed to obtain an SSL certificate from Let's Encrypt!" >&2
  exit 1
fi

# 5. Validate Certificate Files Existence using shell entrypoint override & Nginx read check
echo "🔎 [5/6] Validating generated certificate and private key files..."
# Check volume via certbot container using explicit shell entrypoint
if ! docker compose run --rm --entrypoint sh certbot -c "[ -s /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && [ -s /etc/letsencrypt/live/${DOMAIN}/privkey.pem ]"; then
  echo "❌ FATAL: Certificate verification failed! fullchain.pem or privkey.pem is missing or empty in Certbot volume." >&2
  exit 1
fi

# Check that Nginx can actually read the certificate files
if ! docker compose exec -T nginx sh -c "[ -r /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && [ -r /etc/letsencrypt/live/${DOMAIN}/privkey.pem ]"; then
  echo "❌ FATAL: Nginx cannot read certificate files at /etc/letsencrypt/live/${DOMAIN}/. Check volume mounts and permissions!" >&2
  exit 1
fi
echo "✅ Certificate and private key files verified readable by Nginx."

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

# Test Nginx syntax inside the container before reloading
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
echo "✅ Nginx syntax verified and service reloaded with SSL active."

# 7. Configure Automated Renewal Crontab on Host (Duplicate-safe & availability checked)
CRON_CMD="0 3 * * * cd $(pwd) && docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1"

if command -v crontab >/dev/null 2>&1; then
  CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
  if echo "$CURRENT_CRONTAB" | grep -q "certbot renew"; then
    echo "✅ Automated daily certificate renewal cron job already exists in crontab."
  else
    (echo "$CURRENT_CRONTAB"; echo "$CRON_CMD") | crontab -
    echo "✅ Automated daily certificate renewal added to crontab (03:00 daily)."
  fi
else
  echo "⚠️ Notice: 'crontab' command is not available on this host environment."
  echo "👉 On Ubuntu host, ensure cron is active (sudo apt install -y cron) and add:"
  echo "   $CRON_CMD"
fi

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
