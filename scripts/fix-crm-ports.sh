#!/usr/bin/env bash
# Fix CRM so it coexists with HRMS:
#   CRM Docker → 127.0.0.1:9080
#   Host nginx crm.trackbook.co → :9080
#   Host :80/:443 stay with HRMS
#
# Paste ONLY:
#   cd ~/crm && git pull && bash scripts/fix-crm-ports.sh
set -euo pipefail

cd "${HOME}/crm"
if [[ ! -f docker-compose.prod.yml ]]; then
  if [[ -f "${HOME}/crm/crm/docker-compose.prod.yml" ]]; then
    cd "${HOME}/crm/crm"
  else
    echo "Repo not found at ~/crm"
    exit 1
  fi
fi

echo "Using: $(pwd)"
git pull --ff-only

# Compose command
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "Install compose first: sudo apt-get install -y docker-compose-plugin"
  exit 1
fi

# Ensure env uses 9080
if [[ ! -f .env.prod ]]; then
  bash scripts/make-env-prod.sh
fi
grep -q '^HTTP_PORT=' .env.prod && sed -i 's/^HTTP_PORT=.*/HTTP_PORT=9080/' .env.prod || echo 'HTTP_PORT=9080' >> .env.prod
echo "HTTP_PORT in .env.prod:"
grep HTTP_PORT .env.prod

# Stop OLD stack that bound 0.0.0.0:80 (project name was often "crm")
echo "Stopping old containers that publish :80 ..."
sudo docker ps -q --filter "publish=80" | xargs -r sudo docker stop || true

# Also bring down old compose project names if present
sudo "${DC[@]}" -p crm -f docker-compose.prod.yml --env-file .env.prod down 2>/dev/null || true
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod down 2>/dev/null || true

# Ensure host nginx is up for HRMS
sudo systemctl enable --now nginx 2>/dev/null || true

echo "Starting CRM on 127.0.0.1:9080 ..."
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate

echo "Ports now:"
sudo docker ps --format "table {{.Names}}\t{{.Ports}}"

echo "Installing host vhost crm.trackbook.co → 127.0.0.1:9080"
sudo cp deploy/nginx/host-crm.trackbook.co.conf /etc/nginx/sites-available/crm.trackbook.co
sudo ln -sf /etc/nginx/sites-available/crm.trackbook.co /etc/nginx/sites-enabled/crm.trackbook.co

# Warn if another site still lists crm.trackbook.co
if sudo grep -R --include='*' -l 'crm.trackbook.co' /etc/nginx/sites-enabled/ 2>/dev/null | grep -v 'crm.trackbook.co$'; then
  echo "WARNING: crm.trackbook.co also appears in other nginx sites:"
  sudo grep -Rn 'crm.trackbook.co' /etc/nginx/sites-enabled/ || true
  echo "Remove it from those files so only sites-enabled/crm.trackbook.co owns the name."
fi

sudo nginx -t
sudo systemctl reload nginx

sleep 2
echo ""
echo -n "CRM :9080 health → "
curl -sS -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/ || echo FAIL
echo ""
echo -n "Host :80 CRM proxy → "
curl -sS -o /dev/null -w "%{http_code}" -H "Host: crm.trackbook.co" http://127.0.0.1/api/health/ || true
echo ""
echo -n "HRMS still ok → "
curl -sSk -o /dev/null -w "%{http_code}" https://127.0.0.1/login/ -H "Host: hrms.trackbook.co" || true
echo ""
echo "Open https://crm.trackbook.co  and  https://hrms.trackbook.co"
