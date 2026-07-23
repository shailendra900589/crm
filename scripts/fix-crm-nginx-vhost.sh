#!/usr/bin/env bash
# Fix: crm.trackbook.co must NOT hit /var/www/hrms (DisallowedHost).
# Routes crm → 127.0.0.1:9080 on BOTH :80 and :443.
#
# Paste ONLY:
#   cd ~/crm && git pull && bash scripts/fix-crm-nginx-vhost.sh
set -euo pipefail

cd "${HOME}/crm" 2>/dev/null || cd "$(dirname "$0")/.."
if [[ ! -f docker-compose.prod.yml ]]; then
  echo "Run from ~/crm"
  exit 1
fi
git pull --ff-only || true

echo "=== A) CRM Docker on 127.0.0.1:9080 ==="
if ! curl -fsS -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/ >/dev/null 2>&1; then
  echo "CRM :9080 not up — running fix-crm-ports.sh ..."
  bash scripts/fix-crm-ports.sh
fi
echo -n "CRM health: "
curl -fsS -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/
echo ""

echo "=== B) Strip crm.trackbook.co from OTHER nginx sites ==="
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  [[ "$base" == "crm.trackbook.co" ]] && continue
  if sudo grep -q 'crm\.trackbook\.co' "$f" 2>/dev/null; then
    echo "Cleaning $f"
    sudo cp "$f" "$f.bak.crmfix.$(date +%s)"
    sudo sed -i -E \
      -e 's/\bwww\.crm\.trackbook\.co\b//g' \
      -e 's/\bcrm\.trackbook\.co\b//g' \
      "$f"
  fi
done < <(sudo find /etc/nginx/sites-enabled /etc/nginx/conf.d -type f -print0 2>/dev/null)

echo "=== C) Find TLS cert ==="
CERT=""
KEY=""
for d in \
  /etc/letsencrypt/live/crm.trackbook.co \
  /etc/letsencrypt/live/trackbook.co \
  /etc/letsencrypt/live/hrms.trackbook.co
do
  if sudo test -f "$d/fullchain.pem" && sudo test -f "$d/privkey.pem"; then
    CERT="$d/fullchain.pem"
    KEY="$d/privkey.pem"
    echo "Cert: $d"
    break
  fi
done

OUT=/tmp/crm.trackbook.co.nginx.conf
cat > "$OUT" <<'HTTPONLY'
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
HTTPONLY

if [[ -n "$CERT" ]]; then
  cat >> "$OUT" <<EOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crm.trackbook.co www.crm.trackbook.co;

    ssl_certificate     ${CERT};
    ssl_certificate_key ${KEY};

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
  echo "HTTPS :443 block added"
else
  echo "No cert yet — HTTP only for now (certbot next)"
fi

# If map/upstream already defined elsewhere, nginx -t may fail — use unique include file only once
sudo cp "$OUT" /etc/nginx/sites-available/crm.trackbook.co
sudo ln -sf /etc/nginx/sites-available/crm.trackbook.co /etc/nginx/sites-enabled/crm.trackbook.co

echo "=== D) Test & reload nginx ==="
if ! sudo nginx -t 2>/tmp/nginx-t.err; then
  # Common: duplicate map/upstream — strip map+upstream from our file and rely on first load, or rename
  if grep -q 'duplicate' /tmp/nginx-t.err; then
    echo "Duplicate map/upstream — rewriting without map (inline Connection upgrade)"
    cat > "$OUT" <<EOF
upstream amazon_crm_docker_9080 {
    server 127.0.0.1:9080;
    keepalive 32;
}
server {
    listen 80;
    listen [::]:80;
    server_name crm.trackbook.co www.crm.trackbook.co;
    client_max_body_size 50M;
    location / {
        proxy_pass http://amazon_crm_docker_9080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
EOF
    if [[ -n "$CERT" ]]; then
      cat >> "$OUT" <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crm.trackbook.co www.crm.trackbook.co;
    ssl_certificate     ${CERT};
    ssl_certificate_key ${KEY};
    client_max_body_size 50M;
    location / {
        proxy_pass http://amazon_crm_docker_9080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
EOF
    fi
    sudo cp "$OUT" /etc/nginx/sites-available/crm.trackbook.co
    sudo nginx -t
  else
    cat /tmp/nginx-t.err
    exit 1
  fi
fi
sudo systemctl reload nginx

if [[ -z "$CERT" ]] && command -v certbot >/dev/null 2>&1; then
  echo "=== E) Request Let's Encrypt cert ==="
  sudo certbot --nginx -d crm.trackbook.co --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
fi

echo "=== F) Routing proof (must be JSON status:ok — NOT DisallowedHost HTML) ==="
echo -n "local :9080 → "
curl -fsS -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/ || echo FAIL
echo ""
echo -n "host  :80   → "
curl -sS -H "Host: crm.trackbook.co" http://127.0.0.1/api/health/ | head -c 180
echo ""
echo -n "host  :443  → "
curl -skS -H "Host: crm.trackbook.co" https://127.0.0.1/api/health/ | head -c 180 || echo "no ssl"
echo ""
echo ""
echo "Browser: https://crm.trackbook.co"
echo "HRMS:    https://hrms.trackbook.co"
echo ""
echo "If browser still shows HRMS error, run:"
echo "  sudo grep -Rn 'default_server\\|crm.trackbook' /etc/nginx/sites-enabled/"
echo "  sudo nginx -T | grep -A2 'server_name crm'"
