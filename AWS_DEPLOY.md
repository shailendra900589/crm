# AWS deploy — https://crm.trackbook.co

## Frontend + Backend: same domain (recommended)

| URL | Served by |
|-----|-----------|
| `https://crm.trackbook.co/` | Next.js frontend |
| `https://crm.trackbook.co/api/...` | Django API |
| `https://crm.trackbook.co/ws/...` | WebSockets |
| `https://crm.trackbook.co/admin/` | Django admin |
| `https://crm.trackbook.co/media/...` | Uploads |

**Do not** host frontend and backend on different domains unless you must. Same domain = no CORS pain, simpler cookies/JWT usage, one SSL cert, one DNS record.

```
Internet → Cloudflare (HTTPS) → AWS EC2 :80 (nginx)
                                    ├─ /        → frontend :3000
                                    ├─ /api /ws → backend  :8000
                                    └─ /media   → volume
              Postgres + Redis run as Docker containers on the same EC2
```

---

## Important: database is PostgreSQL (not MongoDB)

This CRM is a **Django** app. Models, migrations, reports, and joins all use **PostgreSQL**.

| What you might expect | What this project uses |
|----------------------|-------------------------|
| MongoDB | **Not used** |
| PostgreSQL | **Yes** (required for production) |
| Redis | Yes (WebSockets + Celery) |

Switching to MongoDB would mean rewriting the backend — **do not do that for go-live**. On AWS use:

- **Simple:** Postgres container on the same EC2 (this guide)
- **Scale later:** Amazon RDS for PostgreSQL

---

## Fastest AWS path (one EC2)

### 1) Create EC2

- AMI: **Ubuntu 22.04 LTS**
- Type: **t3.medium** (2 vCPU / 4 GB) minimum; t3.small only for tiny demos
- Storage: **30 GB** gp3
- Security group inbound:
  - **22** — your IP only (SSH)
  - **80** — `0.0.0.0/0` (HTTP; Cloudflare → origin)
  - **443** — optional if you terminate TLS on the instance
- Elastic IP: allocate and associate (stable DNS)

### 2) DNS (Cloudflare)

- A record: `crm.trackbook.co` → Elastic IP
- Proxy: **ON** (orange cloud)
- SSL/TLS mode: **Full** (not Flexible if origin is HTTP-only behind Cloudflare Full is OK with HTTP origin on port 80)

### 3) SSH, clone, install Docker + Compose plugin

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

git clone https://github.com/shailendra900589/crm.git
cd crm
sudo bash scripts/aws-ec2-bootstrap.sh
# log out/in once, or: newgrp docker

docker compose version   # must print v2.x — NOT "unknown shorthand flag: f"
```

If you see `unknown shorthand flag: 'f'`, Compose plugin is missing:

```bash
sudo apt-get update && sudo apt-get install -y docker-compose-plugin
# or: cd ~/crm && sudo bash scripts/aws-ec2-bootstrap.sh
docker compose version
```

### 4) Configure env

```bash
cd ~/crm
bash scripts/make-env-prod.sh
# or: cp .env.prod.example .env.prod && nano .env.prod
```

Set at least (if editing manually):

```env
SECRET_KEY=<long-random-string>
POSTGRES_PASSWORD=<strong-password>

ALLOWED_HOSTS=crm.trackbook.co,www.crm.trackbook.co
CORS_ALLOWED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
CSRF_TRUSTED_ORIGINS=https://crm.trackbook.co,https://www.crm.trackbook.co
FRONTEND_URL=https://crm.trackbook.co
USE_HTTPS=1
DEBUG=False
RUN_SEED=1
HTTP_PORT=80
```

Generate a secret:

```bash
openssl rand -hex 32
```

### 5) Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Wait ~2–5 minutes for the first build, then:

```bash
curl -s http://127.0.0.1/api/health/
# open https://crm.trackbook.co
```

Demo logins (if `RUN_SEED=1`): `admin` / `manager` / `tl` / `bdm` — password `password123`

Then set `RUN_SEED=0` in `.env.prod` and change all passwords.

### 6) Useful commands

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend nginx
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py createsuperuser
```

### 7) Updates (after git push)

```bash
cd ~/crm   # or your clone path
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## Optional: Amazon RDS (PostgreSQL) later

When traffic grows, move DB off the EC2:

1. Create **RDS PostgreSQL 16** (same VPC as EC2, private subnet preferred)
2. Security group: allow **5432** from EC2 security group only
3. In `.env.prod`:

```env
POSTGRES_HOST=your-rds.xxxxx.ap-south-1.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=crm_db
POSTGRES_USER=crm
POSTGRES_PASSWORD=<rds-password>
```

4. Start stack **without** the local Postgres container:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.aws.yml --env-file .env.prod up -d --build
```

`docker-compose.aws.yml` disables the bundled Postgres service and points the app at RDS.

---

## Optional: S3 for uploads

Uncomment in `.env.prod`:

```env
USE_S3=1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=your-crm-media
AWS_S3_REGION_NAME=ap-south-1
```

Attach an IAM role to EC2 instead of access keys when possible.

---

## What NOT to do

- Separate domains like `app.trackbook.co` + `api.trackbook.co` for v1 — unnecessary with our nginx setup
- MongoDB Atlas / DocumentDB — **not compatible** with this codebase
- Exposing Postgres/Redis ports publicly on the security group

---

## Checklist

- [ ] EC2 + Elastic IP + Docker installed
- [ ] DNS `crm.trackbook.co` → Elastic IP (Cloudflare proxied)
- [ ] `.env.prod` secrets + domain + `USE_HTTPS=1`
- [ ] `docker compose ... up -d --build` healthy
- [ ] `https://crm.trackbook.co/api/health/` → `"status":"ok"`
- [ ] Login works; dashboard live pulse works
- [ ] `RUN_SEED=0` and passwords changed
