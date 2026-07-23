#!/usr/bin/env bash
# Run once on a fresh Ubuntu EC2 as root/sudo:
#   sudo bash scripts/aws-ec2-bootstrap.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/aws-ec2-bootstrap.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssl

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

# Allow ubuntu (or current login) to use docker without sudo
if id ubuntu &>/dev/null; then
  usermod -aG docker ubuntu
fi
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  usermod -aG docker "${SUDO_USER}" || true
fi

docker --version
docker compose version

echo ""
echo "Docker ready. Next:"
echo "  1) git clone https://github.com/shailendra900589/crm.git && cd crm"
echo "  2) cp .env.prod.example .env.prod && nano .env.prod"
echo "  3) docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo "  See AWS_DEPLOY.md for full steps (domain: https://crm.trackbook.co)"
