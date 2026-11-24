#!/usr/bin/env bash
# Install the host nginx site for crm.trackbook.co.
# If a Let's Encrypt cert exists, keep HTTPS on :443.
# Deploy must call this — copying the HTTP-only file drops :443 and Chrome
# shows "Your connection is not private" (wrong certificate on 443).
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

DOMAIN=crm.trackbook.co
LIVE=/etc/letsencrypt/live/${DOMAIN}
AVAIL=/etc/nginx/sites-available/${DOMAIN}
ENABLED=/etc/nginx/sites-enabled/${DOMAIN}

write_http_only() {
  sudo cp deploy/nginx/host-crm.trackbook.co.conf "$AVAIL"
}

write_https() {
  OPTS=""
  DH=""
  sudo test -f /etc/letsencrypt/options-ssl-nginx.conf && OPTS="include /etc/letsencrypt/options-ssl-nginx.conf;"
  sudo test -f /etc/letsencrypt/ssl-dhparams.pem && DH="ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"

  sudo tee "$AVAIL" >/dev/null <<EOF
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
}

sudo mkdir -p /var/www/html /etc/nginx/sites-available /etc/nginx/sites-enabled

if sudo test -f "${LIVE}/fullchain.pem" && sudo test -f "${LIVE}/privkey.pem"; then
  echo "Let's Encrypt cert found — installing HTTPS vhost for ${DOMAIN}"
  write_https
else
  echo "No cert at ${LIVE} — HTTP only."
  echo "After this, run: bash scripts/fix-crm-ssl.sh"
  write_http_only
fi

sudo ln -sf "$AVAIL" "$ENABLED"

if ! sudo nginx -t; then
  echo "ERROR: nginx config test failed. HRMS was not stopped."
  exit 1
fi
sudo systemctl reload nginx
echo "Host nginx reloaded — ${DOMAIN} → 127.0.0.1:9080"

if sudo test -f "${LIVE}/fullchain.pem"; then
  if ! sudo openssl x509 -checkend 0 -noout -in "${LIVE}/fullchain.pem"; then
    echo "Certificate is expired — renewing"
    sudo certbot renew --cert-name "${DOMAIN}" --non-interactive || true
    sudo systemctl reload nginx
  fi
  echo -n "Cert subject: "
  echo | sudo openssl s_client -servername "${DOMAIN}" -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -subject -dates || true
  echo -n "HTTPS health: "
  curl -fsSk --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health/" || curl -fsSk -H "Host: ${DOMAIN}" https://127.0.0.1/api/health/ || true
  echo ""
fi
