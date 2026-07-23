#!/usr/bin/env bash
# Fix Chrome "Not secure" on crm.trackbook.co
# - Issue Let's Encrypt cert for crm.trackbook.co ONLY (no www)
# - Force HTTP → HTTPS redirect
# - Prove https works
#
# Paste:
#   cd ~/crm && git pull && bash scripts/fix-crm-ssl.sh
set -euo pipefail

cd "${HOME}/crm" 2>/dev/null || cd "$(dirname "$0")/.."
git pull --ff-only || true

DOMAIN=crm.trackbook.co
LIVE=/etc/letsencrypt/live/${DOMAIN}

echo "=== 0) Quick facts ==="
echo "Open in browser MUST be: https://${DOMAIN}  (not http://)"
echo ""

echo "=== 1) CRM on :9080 ==="
curl -fsS -H "Host: ${DOMAIN}" http://127.0.0.1:9080/api/health/ >/dev/null
echo "OK"

echo "=== 2) Install certbot ==="
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "=== 3) HTTP-only vhost (ACME + app) ==="
sudo mkdir -p /var/www/html
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
    server_name crm.trackbook.co;

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
sudo nginx -t
sudo systemctl reload nginx

echo "=== 4) Get certificate for ${DOMAIN} only ==="
if sudo test -f "${LIVE}/fullchain.pem"; then
  echo "Cert exists"
else
  # IMPORTANT: do not include www (NXDOMAIN)
  set +e
  sudo certbot certonly --webroot -w /var/www/html -d "${DOMAIN}" \
    --non-interactive --agree-tos --register-unsafely-without-email
  RC=$?
  set -e
  if [[ $RC -ne 0 ]] || ! sudo test -f "${LIVE}/fullchain.pem"; then
    echo ""
    echo "Certbot failed. Usually Cloudflare orange-cloud blocks HTTP-01."
    echo "Do this, then re-run this script:"
    echo "  1) Cloudflare → DNS → crm  → click cloud to GREY (DNS only)"
    echo "  2) Wait 1–2 min"
    echo "  3) bash scripts/fix-crm-ssl.sh"
    echo "  4) Cloudflare → turn orange cloud ON again"
    echo "  5) Cloudflare → SSL/TLS → Full (strict)"
    echo "  6) Cloudflare → SSL/TLS → Edge Certificates → Always Use HTTPS = ON"
    exit 1
  fi
fi

echo "=== 5) HTTPS vhost + force redirect ==="
OPTS=""
DH=""
sudo test -f /etc/letsencrypt/options-ssl-nginx.conf && OPTS="include /etc/letsencrypt/options-ssl-nginx.conf;"
sudo test -f /etc/letsencrypt/ssl-dhparams.pem && DH="ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"

sudo tee /etc/nginx/sites-available/crm.trackbook.co >/dev/null <<EOF
map \$http_upgrade \$connection_upgrade_crm {
    default upgrade;
    ''      close;
}
upstream amazon_crm_docker {
    server 127.0.0.1:9080;
    keepalive 32;
}

# Force HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${LIVE}/fullchain.pem;
    ssl_certificate_key ${LIVE}/privkey.pem;
    ${OPTS}
    ${DH}

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

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

sudo nginx -t
sudo systemctl reload nginx

echo "=== 6) Verify ==="
echo -n "HTTP redirect: "
curl -sI -H "Host: ${DOMAIN}" http://127.0.0.1/ | head -n 1
echo -n "Cert subject: "
echo | openssl s_client -servername "${DOMAIN}" -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -subject || true
echo -n "HTTPS health: "
curl -fsSk --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health/" || curl -fsSk -H "Host: ${DOMAIN}" https://127.0.0.1/api/health/ || true
echo ""
echo ""
echo "DONE. In browser open exactly:"
echo "  https://${DOMAIN}"
echo "Then Cloudflare:"
echo "  SSL/TLS mode = Full (strict)"
echo "  Always Use HTTPS = ON"
echo "Hard refresh: Ctrl+Shift+R"
