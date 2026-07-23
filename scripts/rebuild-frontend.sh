#!/usr/bin/env bash
# Rebuild frontend so API calls go to https://crm.trackbook.co/api (not 127.0.0.1:8000)
# Paste:
#   cd ~/crm && git pull && bash scripts/rebuild-frontend.sh
set -euo pipefail
cd "${HOME}/crm" 2>/dev/null || cd "$(dirname "$0")/.."
git pull --ff-only || true

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
else
  DC=(docker-compose)
fi

echo "Rebuilding frontend with NEXT_PUBLIC_API_URL=same-origin ..."
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod build --no-cache frontend
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d frontend nginx

echo "Done. Hard-refresh browser (Ctrl+Shift+R) on https://crm.trackbook.co"
echo "Login should call /api/auth/login/ on the same domain — not 127.0.0.1:8000"
