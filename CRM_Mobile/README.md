# Trackbook CRM — Flutter mobile

Field CRM for BDMs: live Form Builder sync, Fresh Direct onboarding, Lottie UI, lightweight charts.

## Stack

- Flutter 3.x + Riverpod + go_router + Dio
- Lottie (network LottieFiles), fl_chart, flutter_animate, Google Fonts (Syne / DM Sans)
- Secure token storage + JWT refresh

## Run

```bash
cd CRM_Mobile
flutter pub get
flutter run --dart-define=API_BASE=https://crm.trackbook.co
```

Local backend (Android emulator → host):

```bash
flutter run --dart-define=API_BASE=http://10.0.2.2:8000
```

Windows / Chrome:

```bash
flutter run -d chrome --dart-define=API_BASE=https://crm.trackbook.co
```

Demo logins (server seeds): `bdm` / `password123` (also `admin`, `manager`, `tl`).

## App map

| Tab | Purpose |
|-----|---------|
| Home | Project picker, KPIs, pie snapshot, form sync badge, FU/Visits shortcuts |
| Leads | My leads → lead detail (status, product, log call, activity, form) |
| Form | Dynamic schema from Admin Form Builder + Fresh Direct + product + duplicate check |
| Visits | Assigned visits → complete / open lead |
| More | Follow-ups, Alerts, form refresh, sign out |

## Who can use the app

**Manager · TL · BDM · Ops · Admin** (same CRM APIs as web).  
Team leads see team leads/workdesk; BDM sees own leads.

## Release APK (small / split ABI)

```bash
flutter build apk --release --split-per-abi --target-platform android-arm,android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define=API_BASE=https://crm.trackbook.co
```

Install on modern phones (recommended):

`releases/trackbook-crm-arm64.apk` (~17 MB)

Older 32-bit phones:

`releases/trackbook-crm-arm32.apk` (~15 MB)

Heavy packages removed (Lottie / charts / Google Fonts) + R8 minify + ABI split.

## Form Builder auto-update

1. Admin saves form in web Form Builder (`CustomForm.updated_at` changes).
2. App polls `GET /api/projects/{id}/custom-form/` every **45s** and on project change / pull-to-refresh / sync icon.
3. Employees always fill the latest schema; submit uses `POST /api/leads/{id}/form_submission/`.

## Project layout

```
lib/
  main.dart / app.dart
  router/app_router.dart
  core/{config,theme,network,storage,widgets}/
  models/ models.dart
  providers/{auth,project,form}_provider.dart
  features/{auth,shell,home,leads,form,profile}/
```
