# Deploy Amazon Merchant CRM (production Docker stack)

> **AWS + domain `crm.trackbook.co`:** follow **[AWS_DEPLOY.md](AWS_DEPLOY.md)** (recommended).

## Same domain (frontend + backend)

Use **one domain**: `https://crm.trackbook.co`

- UI → `/`
- API → `/api/`
- WebSockets → `/ws/`

Do **not** split into separate frontend/API domains for v1.

## Database

Production uses **PostgreSQL** (and Redis). **MongoDB is not used** by this codebase.

## What you get

One-command stack on a single VM:

| Service | Role |
|---------|------|
| **nginx** `:80` | Public entry — UI, `/api`, `/ws`, `/media`, `/admin` |
| **frontend** | Next.js (standalone) |
| **backend** | Django + Daphne (HTTP + WebSockets) |
| **celery-worker / celery-beat** | Bulk jobs + daily digest |
| **postgres** | Database |
| **redis** | Channels + Celery broker |

Demo users (when `RUN_SEED=1`): `admin` / `manager` / `tl` / `bdm` — password `password123`

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Open TCP port `80` (or set `HTTP_PORT` in `.env.prod`)
- ~2 GB RAM recommended

---

## Deploy (first time)

```bash
# 1. Clone / copy the project onto the server
cd /path/to/crm

# 2. Create production env
cp .env.prod.example .env.prod
# Edit secrets: SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_HOSTS, CORS_*, FRONTEND_URL

# 3. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Wait for healthy backend, then open
#    https://crm.trackbook.co
```

Windows (PowerShell):

```powershell
Copy-Item .env.prod.example .env.prod
# edit .env.prod
.\scripts\deploy-prod.ps1
```

### After first successful boot

Set `RUN_SEED=0` in `.env.prod` so demo data is not re-seeded on every restart, then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Production domain

Configured for **https://crm.trackbook.co** (see `.env.prod.example`).

In `.env.prod`:

```env
ALLOWED_HOSTS=crm.trackbook.co,www.crm.trackbook.co
CORS_ALLOWED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
CSRF_TRUSTED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
FRONTEND_URL=https://crm.trackbook.co
USE_HTTPS=1
HTTP_PORT=80
```

Point DNS `crm.trackbook.co` → your EC2 Elastic IP. Prefer Cloudflare SSL in front of nginx `:80`. See **AWS_DEPLOY.md**.

---

## Useful commands

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend nginx
curl http://127.0.0.1/api/health/
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml --env-file .env.prod down
```

---

## Local development

```powershell
.\scripts\docker-dev.ps1
# or full backend stack:
.\scripts\docker-dev.ps1 -FullStack
```

---

## Checklist before go-live

- [ ] Strong `SECRET_KEY` and `POSTGRES_PASSWORD`
- [ ] `DEBUG=False`
- [ ] Domain + CORS match `https://crm.trackbook.co`
- [ ] `RUN_SEED=0` after first seed; change demo passwords
- [ ] `/api/health/` ok; login + WebSocket pulse work
- [ ] TLS via Cloudflare (or ALB)
