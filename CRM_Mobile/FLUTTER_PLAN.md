# Trackbook CRM Flutter — complete plan

## Goal

Ship a lightweight field CRM for employees (BDM+) that mirrors web capabilities that matter on the road: login, project context, dashboard KPIs, leads, **dynamic Form Builder forms that auto-update**, Fresh Direct onboarding, file upload, polish (Lottie + charts + motion).

## Design system

- Brand: ocean `#0B3D4A` + coral `#E85D4C` + sand `#F6F3EE` (aligned with marketing site)
- Type: Syne (display) + DM Sans (body) via Google Fonts
- Motion: flutter_animate on login, KPIs, lists; Lottie for empty/success/login/profile
- Charts: fl_chart pie on Home (small, no heavy chart libs)

## Architecture

```
CRM_Mobile/lib
  main.dart → ProviderScope → CrmApp
  router/   go_router + StatefulShell (Home | Leads | Form | Profile)
  core/     config, theme, Dio+JWT, secure storage, widgets
  models/   User, Project, CustomForm, Lead, Dashboard
  providers auth, active project, form sync (45s poll), leads, dashboard
  features  screens above
```

## Form Builder live sync (critical)

| Step | Detail |
|------|--------|
| Source | `GET /api/projects/{id}/custom-form/` |
| Detect change | Compare `updated_at` |
| When | Every 45s, project change, pull-to-refresh, Form sync icon |
| Submit | Create lead if Fresh Direct → `POST /api/leads/{id}/form_submission/` |
| Files | `POST /api/leads/{id}/upload-form-file/` multipart |

Admin saves form on web → employees’ phones pick it up without app store update.

## MVP screens (v1 — shipped in this folder)

1. **Login** — JWT, Lottie hero, branded gradient  
2. **Home** — project dropdown, form-live badge, KPI cards, pie chart, CTA to Form  
3. **Leads** — list + open form with `?lead=`  
4. **Form** — steps, conditionals, Fresh Direct identity, upload, submit success Lottie  
5. **Profile** — user/org, API base, force sync, logout  

## Phase 2 (next)

- Visits calendar / check-in GPS  
- Offline draft answers (Hive / Isar)  
- Push when form schema changes (or WS `custom_form.updated`)  
- Deep links for lead detail  
- Store builds (Play / App Store) + flavors (dev/prod)  

## Phase 3

- Manager TL dashboards  
- In-app notifications for verification  
- Biometric unlock  

## Run / ship

```bash
cd CRM_Mobile
flutter pub get
flutter run --dart-define=API_BASE=https://crm.trackbook.co
```

APK: `flutter build apk --release --dart-define=API_BASE=https://crm.trackbook.co`
