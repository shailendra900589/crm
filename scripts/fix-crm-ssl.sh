#!/usr/bin/env bash
# Fix "Not secure" on https://crm.trackbook.co — issue a real cert for THIS hostname.
# (Using only trackbook.co / hrms certs causes browser name mismatch.)
#
# Paste ONLY:
#   cd ~/crm && git pull && bash scripts/fix-crm-ssl.sh
set -euo pipefail

cd "${HOME}/crm" 2>/dev/null || cd "$(dirname "$0")/.."
git pull --ff-only || true

DOMAIN=crm.trackbook.co
LIVE=/etc/letsencrypt/live/${DOMAIN}

echo "=== 1) Ensure CRM app responds on :9080 ==="
curl -fsS -H "Host: ${DOMAIN}" http://127.0.0.1:9080/api/health/ >/dev/null
echo "CRM :9080 OK"

echo "=== 2) Ensure HTTP vhost exists (needed for certbot HTTP-01) ==="
# Minimal :80 proxy so certbot / ACME can reach the host
sudo tee /etc/nginx/sites-available/crm.trackbook.co >/dev/null <<'EOF'
map $http_upgrade $connection_upgrade_crm {
    default upgrade;
    ''      close;
}
upstream amazon_crm_docker {
    server 127.0.0.1:9080;
    keepalive 32;
}
server {
    listen 80;
    listen [::]:80;
    server_name crm.trackbook.co www.crm.trackbook.co;
    client_max_body_size 50M;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://amazon_crm_docker;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade_crm;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/crm.trackbook.co /etc/nginx/sites-enabled/crm.trackbook.co
sudo mkdir -p /var/www/html
sudo nginx -t
sudo systemctl reload nginx

echo "=== 3) Install certbot if needed ==="
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "=== 4) Issue / renew certificate for ${DOMAIN} ==="
# Prefer nginx plugin (auto-wires SSL). Fallback: webroot then we write SSL block ourselves.
if sudo test -f "${LIVE}/fullchain.pem"; then
  echo "Cert already exists — renewing if due"
  sudo certbot renew --cert-name "${DOMAIN}" --non-interactive || true
else
  sudo certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || sudo certbot certonly --webroot -w /var/www/html \
         -d "${DOMAIN}" -d "www.${DOMAIN}" \
         --non-interactive --agree-tos --register-unsafely-without-email
fi

if ! sudo test -f "${LIVE}/fullchain.pem"; then
  echo ""
  echo "ERROR: Could not obtain a certificate for ${DOMAIN}."
  echo "If Cloudflare proxy (orange cloud) blocks ACME:"
  echo "  1) Cloudflare → DNS → crm.trackbook.co → set to DNS only (grey cloud) temporarily"
  echo "  2) Re-run: bash scripts/fix-crm-ssl.sh"
  echo "  3) Turn orange cloud back ON"
  echo "  4) Cloudflare SSL/TLS mode = Full (strict)"
  exit 1
fi

echo "=== 5) Write final nginx config with CORRECT cert (${LIVE}) ==="
sudo tee /etc/nginx/sites-available/crm.trackbook.co >/dev/null <<EOF
map \$http_upgrade \$connection_upgrade_crm {
    default upgrade;
    ''      close;
}
upstream amazon_crm_docker {
    server 127.0.0.1:9080;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate     ${LIVE}/fullchain.pem;
    ssl_certificate_key ${LIVE}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://amazon_crm_docker;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade_crm;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
EOF

# ssl-dhparams / options may be missing on some installs
if ! sudo test -f /etc/letsencrypt/options-ssl-nginx.conf; then
  sudo sed -i '/options-ssl-nginx.conf/d' /etc/nginx/sites-available/crm.trackbook.co
fi
if ! sudo test -f /etc/letsencrypt/ssl-dhparams.pem; then
  sudo sed -i '/ssl-dhparams.pem/d' /etc/nginx/sites-available/crm.trackbook.co
fi

sudo ln -sf /etc/nginx/sites-available/crm.trackbook.co /etc/nginx/sites-enabled/crm.trackbook.co

echo "=== 6) Reload nginx ==="
sudo nginx -t
sudo systemctl reload nginx

echo "=== 7) Verify certificate name ==="
echo | openssl s_client -servername "${DOMAIN}" -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -subject -dates || true
echo ""
curl -fsS "https://${DOMAIN}/api/health/" | head -c 200
echo ""
echo ""
echo "Done. Open https://${DOMAIN} — padlock should be OK after hard refresh."
echo "Cloudflare SSL/TLS should be: Full or Full (strict)."
