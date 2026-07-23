#!/usr/bin/env bash
# Run once on Ubuntu EC2 (from repo OR standalone after installing Docker):
#   cd ~/crm && sudo bash scripts/aws-ec2-bootstrap.sh
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

# Compose V2 plugin is REQUIRED (docker compose -f ...). Without it you get: unknown shorthand flag: 'f'
apt-get install -y docker-compose-plugin || true

# Fallback: install compose plugin from Docker's apt repo if still missing
if ! docker compose version >/dev/null 2>&1; then
  echo "Installing docker-compose-plugin via Docker apt repo..."
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-compose-plugin
fi

# Allow ubuntu (or current login) to use docker without sudo
if id ubuntu &>/dev/null; then
  usermod -aG docker ubuntu
fi
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  usermod -aG docker "${SUDO_USER}" || true
fi

echo ""
docker --version
docker compose version
echo ""
echo "OK — Docker Compose plugin installed."
echo "If 'permission denied' on docker, log out/in (or: newgrp docker)."
echo ""
echo "Next (from ~/crm):"
echo "  bash scripts/make-env-prod.sh"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo "  See AWS_DEPLOY.md"
