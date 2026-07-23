# Deploy Amazon Merchant CRM (production Docker stack)

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
#    http://YOUR_HOST/
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

Point DNS `crm.trackbook.co` → your server IP. Put TLS in front (Cloudflare, Caddy, or host nginx) and terminate HTTPS there. Containers stay on HTTP internally; `USE_HTTPS=1` trusts `X-Forwarded-Proto`.

---

## Useful commands

```bash
# Status
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Logs
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend nginx

# Health
curl http://127.0.0.1/api/health/

# Django shell / manage
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py createsuperuser

# Stop
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Stop + wipe DB volumes (destructive)
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v
```

---

## Local development (unchanged)

Infra only (Postgres + Redis), run Django/Next on the host:

```powershell
.\scripts\docker-dev.ps1
```

Backend + Celery in Docker (no nginx/frontend):

```powershell
.\scripts\docker-dev.ps1 -FullStack
```

---

## Email / S3 (optional)

Uncomment SMTP and/or `USE_S3=1` blocks in `.env.prod`. Without SMTP, digests print to Celery logs. Without S3, uploads stay in the `media_data` Docker volume.

---

## Checklist before go-live

- [ ] Strong `SECRET_KEY` and `POSTGRES_PASSWORD`
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` match your public URL
- [ ] `RUN_SEED=0` after first seed (or create real users)
- [ ] Change demo passwords if seed was used
- [ ] `/api/health/` returns healthy DB + Redis
- [ ] Login works; WebSocket pulse updates on dashboard
- [ ] TLS enabled for production traffic
