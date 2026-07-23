#!/usr/bin/env bash
# Deploy CRM beside HRMS on the same EC2.
# - Does NOT stop host nginx / HRMS
# - CRM Docker → 127.0.0.1:9080
# - Host nginx vhost crm.trackbook.co → :9080
#
# Run ONLY these lines on the server:
#   cd ~/crm && git pull && bash scripts/ec2-fix-and-deploy.sh
set -euo pipefail

echo "=== 1) Repo path ==="
if [[ -f "$HOME/crm/docker-compose.prod.yml" ]]; then
  cd "$HOME/crm"
elif [[ -f "$HOME/crm/crm/docker-compose.prod.yml" ]]; then
  echo "WARN: nested ~/crm/crm — using it"
  cd "$HOME/crm/crm"
elif [[ -f "./docker-compose.prod.yml" ]]; then
  :
else
  git clone https://github.com/shailendra900589/crm.git "$HOME/crm"
  cd "$HOME/crm"
fi
echo "Using: $(pwd)"
git pull --ff-only || true

echo "=== 2) Keep host nginx RUNNING (HRMS stays up) ==="
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "Host nginx is active — good (HRMS uses it)"
else
  echo "Host nginx not active — starting it"
  sudo systemctl enable --now nginx || true
fi

echo "=== 3) Docker Compose plugin ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl openssl docker-compose-plugin || true

if ! docker compose version >/dev/null 2>&1; then
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "ERROR: docker compose not available"
  exit 1
fi
echo "Using: ${DC[*]}"
sudo usermod -aG docker "$USER" 2>/dev/null || true

echo "=== 4) .env.prod (port 9080) ==="
if [[ ! -f .env.prod ]] || ! grep -q 'HTTP_PORT=9080' .env.prod; then
  bash scripts/make-env-prod.sh
else
  # Force port 9080 if an old env still has 80
  sed -i 's/^HTTP_PORT=.*/HTTP_PORT=9080/' .env.prod
fi

echo "=== 5) Start CRM Docker on 127.0.0.1:9080 ==="
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "=== 6) Install host nginx vhost for crm.trackbook.co ==="
# Avoid duplicate map if already defined in another file
HOST_CONF=deploy/nginx/host-crm.trackbook.co.conf
sudo cp "$HOST_CONF" /etc/nginx/sites-available/crm.trackbook.co
sudo ln -sf /etc/nginx/sites-available/crm.trackbook.co /etc/nginx/sites-enabled/crm.trackbook.co

# Remove crm from default / HRMS catch-alls if someone pointed crm there — cannot auto-fix all cases,
# but ensure our server_name wins for crm.trackbook.co
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "Host nginx reloaded — crm.trackbook.co → 127.0.0.1:9080"
else
  echo "ERROR: nginx -t failed. Fix config; HRMS should still be running."
  exit 1
fi

echo "=== 7) Health checks ==="
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod ps
sleep 2
echo -n "CRM docker :9080 → "
curl -sS -o /dev/null -w "%{http_code}" -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/ || true
echo ""
echo -n "Host proxy  :80  → "
curl -sS -o /dev/null -w "%{http_code}" -H "Host: crm.trackbook.co" http://127.0.0.1/api/health/ || true
echo ""
echo ""
echo "Done."
echo "  CRM:  https://crm.trackbook.co"
echo "  HRMS: https://hrms.trackbook.co  (unchanged)"
echo "Demo: admin / manager / tl / bdm · password123"
echo "Then: set RUN_SEED=0 in .env.prod"
