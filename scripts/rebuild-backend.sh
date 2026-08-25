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
# Ensure Gmail SMTP is present in .env.prod (idempotent)
if [[ -f .env.prod ]] && ! grep -q '^EMAIL_HOST_USER=' .env.prod 2>/dev/null; then
  cat >> .env.prod <<'EOF'

# --- Email (Gmail SMTP — Trackbook CRM) ---
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=hrms.p.lko@gmail.com
EMAIL_HOST_PASSWORD=lgtt ifsx febn nytu
EMAIL_USE_TLS=1
DEFAULT_FROM_EMAIL=Trackbook CRM <hrms.p.lko@gmail.com>
EOF
  echo "Appended EMAIL_* to .env.prod"
fi
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod build --no-cache backend celery-worker celery-beat
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d backend celery-worker celery-beat nginx

echo "Cleaning legacy seed form junk (GST4000/Retail)..."
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod exec -T backend python manage.py clean_seed_form_data || true
sudo "${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod exec -T backend python manage.py backfill_form_submissions || true

echo "Done. Login: Rahul / India@1432 on https://crm.trackbook.co"
