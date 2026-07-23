# CURSOR AI — MASTER COMMAND: Amazon Merchant CRM v2.0

Paste this whole block into Cursor as your working instruction/system prompt for this repo.
Refer to `Amazon_Merchant_CRM_v2_Full_Spec.pdf` in the repo root for full feature detail — this file is the *execution rule set*.

---

## 0. NON-NEGOTIABLE RULE — EDIT, NEVER REWRITE

> **Whenever a change is needed, EDIT the existing file in place. Do NOT delete a file and recreate it from scratch, and do NOT rewrite a whole file when only a function/section changed.**
> - Use targeted diffs / in-place edits only.
> - Never regenerate `api.ts`, `ui.tsx`, `models.py`, `views.py`, etc. from zero — locate the relevant function/class and modify only that block.
> - If a file genuinely needs a new export, append it; don't restructure the whole file "for cleanliness."
> - Before editing, read the current file content first. Never guess file contents from memory.
> - If you (Cursor) are unsure whether an edit will break another file that imports from it, grep for usages first, then edit both together — still as edits, not rewrites.
> - Keep git diffs minimal and reviewable. A good diff touches only the lines that must change.
> - Do NOT run `git commit` unless the user explicitly asks for it.

---

## 1. Project Identity

- Folder names: `CRM_Backend` and `CRM_Frontend` (unchanged — do not rename).
- Philosophy: **Less Code, More Productivity. Less Files, More Productivity.**
- One file per concern. Do not fragment into many small files "for organization" — that violates the philosophy.
- Ports: Backend `8000`, Frontend `3000`.

## 2. Tech Stack (target state)

- Backend: Python 3.14, Django 5.2, DRF, SimpleJWT, **Django Channels (ASGI, Daphne)**, **channels-redis**, **Celery + Redis**, **PostgreSQL 16**, Pillow, openpyxl.
- Frontend: Next.js 14, React 18, TypeScript, Tailwind 3.4, React Query, Recharts, Lucide React, **Framer Motion** (new — for animation/live-update polish), clsx + tailwind-merge.
- Infra: Docker + docker-compose for Postgres/Redis locally. Kubernetes manifests only when the user asks to actually scale — don't add them speculatively.

## 3. Backend File Map (keep minimal — edit these, don't add new ones unless a feature genuinely needs a new concern)

```
CRM_Backend/
  api/models.py                # all models incl. Team, CustomForm, FormSubmission, BulkUploadJob
  api/serializers.py            # all serializers
  api/views.py                  # all views + viewsets
  api/urls.py                   # all routes
  api/consumers.py               # NEW — Channels WebSocket consumers (dashboard live push)
  api/routing.py                  # NEW — ws url routing
  api/tasks.py                     # NEW — Celery tasks (bulk upload processing, template generation)
  api/permissions.py               # NEW — role-based queryset/permission helpers (Admin/Manager/TL/BDM cascade)
  api/management/commands/seed.py # demo data seeder
  CRM_Backend/asgi.py             # updated to wrap ProtocolTypeRouter (http + websocket)
  CRM_Backend/settings.py         # add CHANNEL_LAYERS, CELERY_*, DATABASES (Postgres)
```

## 4. Frontend File Map (same discipline)

```
CRM_Frontend/
  components/ui.tsx           # all UI primitives — keep in 1 file
  components/shell.tsx         # sidebar + header + project switcher
  components/dashboard.tsx      # BDM/TL dashboard
  components/leads.tsx           # leads table + all CRM actions
  components/admin.tsx            # admin dashboard + project mgmt + manager grid + drill-down
  components/team.tsx              # NEW — Team CRUD + reporting
  components/form-builder.tsx       # NEW — drag-drop custom form canvas
  components/dynamic-form.tsx        # NEW — renders any CustomForm schema
  components/bulk-upload.tsx          # NEW — template download/upload/progress
  lib/api.ts                    # single API client — extend, don't fork
  lib/ws.ts                      # NEW — single WebSocket hook useLiveDashboard(scope)
  lib/utils.ts                    # cn() helper + status colors
```

## 5. Build Order (do these as sequential, reviewable edits — not one giant rewrite)

1. Switch DB from SQLite to PostgreSQL in `settings.py` + docker-compose service. Run migration. Verify seed still works.
2. Add `Team` model + endpoints + `components/team.tsx`. Wire into `/team` page for Manager role.
3. Add role-cascade permission helper in `api/permissions.py`; apply to existing querysets in `views.py` (edit existing viewsets' `get_queryset`, don't rewrite the file).
4. Add Admin → Manager grid + one-click drill-down: new `GET /api/admin/managers/` and `GET /api/admin/managers/{id}/dashboard/` in `views.py`; extend `components/admin.tsx` with the grid + drill-down view (reuse the existing dashboard component, don't duplicate it).
5. Add global admin filters (project/manager/team/date) as query params on the existing `/api/admin/dashboard/` endpoint — edit the existing view function.
6. Add Django Channels: `asgi.py`, `consumers.py`, `routing.py`, `CHANNEL_LAYERS` in settings, Redis service in docker-compose. Add `post_save` signals for Lead/Team/LeadDocument that push to the right group.
7. Add `lib/ws.ts` hook on frontend; wire into `dashboard.tsx`, `team.tsx`, `admin.tsx` for live patching of React Query cache.
8. Add `CustomForm` model + JSONB `custom_data` field on `Lead` + `FormSubmission` model. Add `GET/PUT /api/projects/{id}/custom-form/`.
9. Build `components/form-builder.tsx` (Admin) and `components/dynamic-form.tsx` (renders schema anywhere it's needed).
10. Add Celery (`tasks.py`, worker config, Redis broker) + `BulkUploadJob` model + `bulk-template`/`bulk-upload` endpoints + `components/bulk-upload.tsx` with live progress via the same WebSocket channel.
11. Polish pass: Framer Motion transitions, live-update pulse highlight, animated KPI count-up, skeleton loaders — apply to existing components in place.
12. Only if the user asks to scale: add Kubernetes manifests, pgbouncer, read replicas.

## 6. Design Rules

- Background `bg-slate-50`, cards white/rounded-2xl/shadow-sm, blue-600 primary, emerald/amber/rose for status.
- Font: Inter via `next/font/google`.
- Animate with Framer Motion: entrance transitions, live-update pulse, drag feedback in form builder, KPI count-up.
- Every core action must be reachable in **one click** from the page the user is already on.

## 7. Testing Checklist Before Marking a Phase Done

- [ ] Existing endpoints still return 200 for all 3 demo roles (manager/tl/bdm, password123).
- [ ] No orphaned imports left behind from an in-place edit.
- [ ] WebSocket reconnects gracefully on network drop.
- [ ] Bulk upload handles a row with a missing required custom-form field without crashing the whole job (logs it, keeps processing).
- [ ] Role cascade: a BDM cannot query another BDM's leads via the API directly (test with curl/Postman, not just UI).

## 8. Known Fixes (keep applying these as before)

- `Cannot find module 217.js` → delete `.next`, restart dev server.
- CSS 404 → clear `.next`, fix `globals.css`, add autoprefixer.
- `django-admin` not in PATH → use `python -m django`.
- PowerShell `&&` unsupported → use `;`.
- Migration stuck → delete broken migration, fresh `0001_initial`.
- WebSocket 403 → pass JWT as a query param on the ws URL (browsers can't set custom WS headers); confirm `AuthMiddlewareStack` reads it.
- Celery task not firing → confirm Redis broker URL matches docker-compose service name and a worker process is actually running alongside Daphne.
