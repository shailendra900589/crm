# Coexistence: HRMS + CRM on one EC2

## Problem you hit

`crm.trackbook.co` was routed to **HRMS** (`/var/www/hrms`) → Django `DisallowedHost`.

## Fixed architecture

| App | Domain | Public port | App port |
|-----|--------|-------------|----------|
| **HRMS** | https://hrms.trackbook.co | host nginx `:80` / `:443` | existing (unchanged) |
| **CRM** | https://crm.trackbook.co | host nginx `:80` / `:443` | Docker **`127.0.0.1:9080` only** |

```
Internet
   ├─ hrms.trackbook.co → host nginx → /var/www/hrms (as today)
   └─ crm.trackbook.co  → host nginx → 127.0.0.1:9080 → CRM Docker
                                          (own Postgres + Redis, no shared DB)
```

CRM never binds host `:80`. Postgres/Redis are not published on the host.

## Deploy / fix on the server (paste only these lines)

```bash
cd ~/crm
git pull
bash scripts/ec2-fix-and-deploy.sh
```

That script:

1. Keeps host nginx **running** (HRMS stays up)
2. Starts CRM on **9080**
3. Installs `/etc/nginx/sites-enabled/crm.trackbook.co` → proxy to 9080
4. Reloads nginx

## If CRM still opens HRMS

Another nginx site may catch `crm.trackbook.co`. Check:

```bash
sudo grep -R "crm.trackbook.co\|server_name" /etc/nginx/sites-enabled/
```

Remove `crm.trackbook.co` from the HRMS (or default) server block. Only our file should own that name:

```bash
ls -la /etc/nginx/sites-enabled/crm.trackbook.co
sudo nginx -t && sudo systemctl reload nginx
```

## Verify

```bash
curl -sS -H "Host: crm.trackbook.co" http://127.0.0.1:9080/api/health/
curl -sS -H "Host: crm.trackbook.co" http://127.0.0.1/api/health/
# HRMS still works:
curl -sI -H "Host: hrms.trackbook.co" http://127.0.0.1/ | head -5
```

Then open https://crm.trackbook.co and https://hrms.trackbook.co
