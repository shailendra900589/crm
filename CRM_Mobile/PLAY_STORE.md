# Trackbook CRM — Google Play Store launch checklist

**App ID:** `co.trackbook.crm_mobile`  
**Operator:** Newish Technology  
**Office:** D-1012/13, Indira Nagar, Lucknow, Uttar Pradesh, 226016  
**Privacy email:** privacy@trackbook.co  

## Files ready for you

| File | Path |
|------|------|
| **Android App Bundle (upload this)** | `CRM_Mobile/releases/trackbook-crm.aab` |
| APK (testing only) | `CRM_Mobile/releases/trackbook-crm-arm64.apk` |
| Privacy Policy (live URL) | https://crm.trackbook.co/privacy |
| Terms | https://crm.trackbook.co/terms |
| Store listing text | `CRM_Mobile/PLAY_STORE_LISTING.txt` |
| This checklist | `CRM_Mobile/PLAY_STORE.md` |

## Already done in the app

- [x] App logo / launcher icon  
- [x] Privacy Policy linked on **Login** + **More → Privacy Policy** + **Account**  
- [x] Terms + Disclaimer links  
- [x] **In-app account deletion** (More → Account & Privacy → Delete my account)  
- [x] Web deletion instructions: https://crm.trackbook.co/privacy#account-deletion  
- [x] HTTPS only (no cleartext)  
- [x] Version `1.0.2` (versionCode `3`)  

## What YOU must add / do in Play Console

### 1) Create Play Console app
1. Go to [Google Play Console](https://play.google.com/console)  
2. Create app → name **Trackbook CRM**  
3. App / Game → App  
4. Free  
5. Declarations: accept policies  

### 2) Upload AAB
1. **Release → Testing → Internal testing** (recommended first)  
2. Create release → upload `trackbook-crm.aab`  
3. After testing → promote to **Closed** / **Production**  

### 3) Store listing (copy from PLAY_STORE_LISTING.txt)
You must upload:
- **App icon** 512×512 PNG (use `Trackbookcrm.png` / `public/icon-512.png`)  
- **Feature graphic** 1024×500 PNG (design separately — brand blue + logo + “Trackbook CRM”)  
- **Phone screenshots** min 2 (login, home, form, leads) — take from a real device/emulator  
- Short description (80 chars)  
- Full description  

### 4) Privacy & Data safety (required)
| Field | Value to enter |
|--------|----------------|
| Privacy policy URL | `https://crm.trackbook.co/privacy` |
| Account deletion URL | `https://crm.trackbook.co/privacy#account-deletion` |
| Data collected | Account info, CRM business data users enter, photos/files users upload, device IDs / app activity for security |
| Location | Only if you later enable GPS — currently declare **no** background location; app policy says foreground-only when enabled |
| Ads | **No** |
| Sell data | **No** |
| Encryption in transit | **Yes** (HTTPS/TLS) |

### 5) App content / ratings
- Content rating questionnaire → Business app  
- Target audience → 18+ / workforce  
- News / COVID / Ads → No  

### 6) Signing (important)
Current AAB may be **debug-signed** for local builds. For production Play upload you need an **upload keystore**:

```bash
keytool -genkey -v -keystore trackbook-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias trackbook
```

Then in `android/key.properties` (do **not** commit this file):

```
storePassword=****
keyPassword=****
keyAlias=trackbook
storeFile=../trackbook-upload.jks
```

Wire signing in `android/app/build.gradle.kts` and rebuild:

```bash
flutter build appbundle --release --dart-define=API_BASE=https://crm.trackbook.co
```

### 7) Server deploy (so Privacy + delete API work)
On EC2:

```bash
cd ~/crm
git pull --ff-only
bash scripts/rebuild-backend.sh
bash scripts/rebuild-frontend.sh
```

Confirm:
- https://crm.trackbook.co/privacy shows Lucknow address  
- Login works  
- Delete account API: `POST /api/me/delete-account/`  

### 8) After publish
- Keep Privacy Policy updated  
- Every new Play upload: bump `version:` in `pubspec.yaml` (e.g. `1.0.3+4`)  
- Reply to Play policy emails within deadline  

## Package summary for reviewers

**Trackbook CRM** is a B2B field sales CRM for Manager / TL / BDM / Ops. Accounts are created by company Admins (not public self-signup in the mobile app). Users can delete/deactivate their own login in-app. Camera/photos are used only for CRM document upload. No ads. Operator: Newish Technology, Lucknow.
