#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.prod ]]; then
  cp .env.prod.example .env.prod
  echo "Created .env.prod — edit secrets, then re-run."
  exit 1
fi

if [[ "${1:-}" == "down" ]]; then
  docker compose -f docker-compose.prod.yml --env-file .env.prod down
  exit 0
fi

echo "Building and starting production stack..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "Waiting for /api/health/ ..."
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1/api/health/" >/dev/null 2>&1; then
    echo "CRM is up: http://127.0.0.1/"
    exit 0
  fi
  sleep 3
done

echo "Health check timed out. Try: docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=80"
exit 1
