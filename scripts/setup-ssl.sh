#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Automated SSL / HTTPS Provisioning Script (Certbot + Nginx)
# Usage: ./scripts/setup-ssl.sh <domain.com> <email@domain.com>
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
echo "🔒 Tuntas SSL Provisioning for: ${DOMAIN}"
echo "📧 Notification Email: ${EMAIL}"
echo "======================================================"

# 1. Verify Docker Compose is running
if ! docker compose ps | grep -q "tuntas-nginx"; then
  echo "⚠️ Warning: tuntas-nginx container is not running. Starting containers..."
  docker compose up -d
  sleep 5
fi

# 2. Request Certificate from Let's Encrypt via Certbot Webroot
echo "📜 [1/4] Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" || {
    echo "⚠️ Failed with www.${DOMAIN}, attempting single domain ${DOMAIN}..."
    docker compose run --rm certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email "${EMAIL}" \
      --agree-tos \
      --no-eff-email \
      --force-renewal \
      -d "${DOMAIN}"
}

# 3. Generate active Nginx SSL configuration from template
echo "⚙️ [2/4] Generating Nginx SSL configuration..."
TEMPLATE_FILE="docker/nginx/conf.d/ssl.conf.template"
TARGET_FILE="docker/nginx/conf.d/ssl.conf"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "❌ Error: Template file $TEMPLATE_FILE not found!"
  exit 1
fi

sed "s/{{DOMAIN}}/${DOMAIN}/g" "$TEMPLATE_FILE" > "$TARGET_FILE"
echo "✅ Configuration written to $TARGET_FILE"

# 4. Test Nginx syntax and reload
echo "🔄 [3/4] Testing Nginx configuration and reloading..."
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload

# 5. Configure automated renewal crontab on VPS host
echo "⏰ [4/4] Setting up automatic daily certificate renewal..."
CRON_CMD="0 3 * * * cd $(pwd) && docker compose run --rm certbot renew --webroot -w /var/www/certbot && docker compose exec -T nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1"

(crontab -l 2>/dev/null | grep -F "certbot renew" || (crontab -l 2>/dev/null; echo "$CRON_CMD")) | crontab -

echo ""
echo "🎉 SUCCESS: SSL has been configured and activated!"
echo "👉 Your application is now accessible at: https://${DOMAIN}"
echo "👉 Direct IP access remains functional at: http://YOUR_VPS_IP"
