#!/usr/bin/env bash
# Rebuild backend image (code is baked into Docker — restart alone will NOT pick up git pull).
# Paste:
#   cd ~/crm && git pull && bash scripts/rebuild-backend.sh
set -euo pipefail
cd "${HOME}/crm" 2>/dev/null || cd "$(dirname "$0")/.."
git pull --ff-only || true

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
else
  DC=(docker-compose)
fi

echo "Rebuilding backend (+ celery) so Super Admin login code is live..."
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod build --no-cache backend celery-worker celery-beat
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d backend celery-worker celery-beat nginx

echo "Cleaning legacy seed form junk (GST4000/Retail)..."
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod exec -T backend python manage.py clean_seed_form_data || true
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod exec -T backend python manage.py backfill_form_submissions || true

echo "Done. Login: Rahul / India@1432 on https://crm.trackbook.co"
