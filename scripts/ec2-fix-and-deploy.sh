#!/usr/bin/env bash
# One-shot fix + deploy for EC2. Copy-paste ONLY this file's run command:
#   cd ~ && bash -c "$(curl -fsSL https://raw.githubusercontent.com/shailendra900589/crm/main/scripts/ec2-fix-and-deploy.sh)"
# Or from inside a clone:
#   bash scripts/ec2-fix-and-deploy.sh
set -euo pipefail

echo "=== 1) Find / use correct repo path ==="
if [[ -f "$HOME/crm/docker-compose.prod.yml" ]]; then
  cd "$HOME/crm"
elif [[ -f "$HOME/crm/crm/docker-compose.prod.yml" ]]; then
  echo "WARN: nested ~/crm/crm found — using that, but prefer a single ~/crm clone"
  cd "$HOME/crm/crm"
elif [[ -f "./docker-compose.prod.yml" ]]; then
  cd "$(pwd)"
else
  echo "Cloning repo to ~/crm ..."
  git clone https://github.com/shailendra900589/crm.git "$HOME/crm"
  cd "$HOME/crm"
fi
echo "Using: $(pwd)"
git pull --ff-only || true

echo "=== 2) Stop host nginx (it steals port 80) ==="
if systemctl is-active --quiet nginx 2>/dev/null; then
  sudo systemctl stop nginx
  sudo systemctl disable nginx
  echo "Stopped and disabled system nginx"
else
  echo "System nginx not active (ok)"
fi

echo "=== 3) Install Docker Compose V2 plugin ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl openssl docker-compose-plugin || true

if ! docker compose version >/dev/null 2>&1; then
  echo "Plugin missing — installing standalone docker-compose binary"
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

# Prefer plugin; fall back to binary
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
  echo "Using: docker compose"
  docker compose version
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
  echo "Using: docker-compose"
  docker-compose version
else
  echo "ERROR: compose still not available"
  exit 1
fi

if ! groups | grep -q docker; then
  sudo usermod -aG docker "$USER" || true
  echo "Added $USER to docker group — if permission errors, run: newgrp docker"
fi

echo "=== 4) Ensure .env.prod ==="
if [[ ! -f .env.prod ]] || grep -q 'REPLACE_WITH_\|change-me' .env.prod 2>/dev/null; then
  bash scripts/make-env-prod.sh
fi

echo "=== 5) Build & start stack ==="
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "=== 6) Status ==="
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod ps
echo ""
sleep 3
curl -sS http://127.0.0.1/api/health/ || true
echo ""
echo "Done. Open https://crm.trackbook.co"
echo "Demo logins: admin / manager / tl / bdm  password: password123"
echo "Then set RUN_SEED=0 in .env.prod"
