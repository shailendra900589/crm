#!/usr/bin/env bash
# Create .env.prod with secrets. CRM uses port 9080 (HRMS keeps :80).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.prod ]]; then
  cp .env.prod ".env.prod.bak.$(date +%s)"
  echo "Backed up existing .env.prod"
fi

SECRET="$(openssl rand -hex 32)"
DBPASS="$(openssl rand -hex 16)"

cat > .env.prod <<EOF
# Auto-generated for https://crm.trackbook.co — $(date -u +%Y-%m-%dT%H:%MZ)
# Separate from HRMS (https://hrms.trackbook.co)

SECRET_KEY=${SECRET}
POSTGRES_PASSWORD=${DBPASS}

POSTGRES_DB=crm_db
POSTGRES_USER=crm
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

ALLOWED_HOSTS=crm.trackbook.co,www.crm.trackbook.co,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
CSRF_TRUSTED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
FRONTEND_URL=https://crm.trackbook.co

DEBUG=False
DIGEST_ENABLED=1
LOG_LEVEL=INFO
RUN_SEED=1
USE_HTTPS=1
HTTP_PORT=9080
EOF

chmod 600 .env.prod
echo "Created .env.prod (HTTP_PORT=9080 — does not touch HRMS on :80)"
echo "Next: bash scripts/ec2-fix-and-deploy.sh"
