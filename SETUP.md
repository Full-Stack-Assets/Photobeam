# PhotoBeam → iOS, without a Mac

Step-by-step from these files to a TestFlight build on your iPhone.

## 1. Create the project (Windows/Linux, any machine)

```bash
npm create vite@latest photobeam -- --template react
cd photobeam
npm install lucide-react @capacitor/core @capacitor/ios @capacitor/preferences @capacitor/filesystem @capacitor/camera
npm install -D @capacitor/cli tailwindcss @tailwindcss/vite
```

Set up Tailwind (v4, Vite plugin): add `tailwindcss()` to `vite.config.js`
plugins and `@import "tailwindcss";` to `src/index.css`.

This repo already contains the assembled project (`package.json`, `index.html`,
`vite.config.js`, `src/`). If you're starting from these files, just run
`npm install` instead of the scaffold above. The pieces are:

- `src/App.jsx`, `src/main.jsx`, `src/index.css` → the app
- `src/storage.js` → native storage layer
- `src/native/` → AirPlay plugin (JS side)
- `src/social/` → Instagram / Facebook / Google Photos import
- `native/ios/` → the AirPlay native Swift plugin (added to Xcode in step 2b)
- `capacitor.config.ts`, `codemagic.yaml` → project root (edit the `appId`/IDs)

## 2. Pick your bundle ID and generate the iOS project

Choose a reverse-domain bundle ID, e.g. `com.jana.photobeam`, and put it in
**three places**: `capacitor.config.ts`, and twice in `codemagic.yaml`
(`BUNDLE_ID` var + `ios_signing.bundle_identifier`).

```bash
npm run build
npx cap add ios
```

This creates the `ios/` folder. **Commit it to git** — Codemagic builds from it.

### 2b. Add the native AirPlay plugin

Real AirPlay output is a native Swift plugin. After `npx cap add ios`, add both
files from `native/ios/` to the **App** target in Xcode (drag them into the
`App/App` group, or copy them into `ios/App/App/` and add to the target):

- `native/ios/AirPlayPlugin.swift`
- `native/ios/AirPlayPlugin.m`

Capacitor auto-registers the plugin via the `CAP_PLUGIN` macro — no JS change
needed. Without these files the app still builds, but the Beam sheet will report
that AirPlay is unavailable.

## 3. Add the photo-library permission string

Apple rejects builds that access photos without an explanation. Open
`ios/App/App/Info.plist` in any text editor and add inside the top-level
`<dict>`:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>PhotoBeam needs access to your photo library so you can pick photos to show on your TV.</string>
```

## 4. App Store Connect (one-time, in the browser)

1. **Register the bundle ID**: developer.apple.com → Certificates, IDs &
   Profiles → Identifiers → + → App ID → enter your bundle ID.
2. **Create the app**: appstoreconnect.apple.com → My Apps → + → New App →
   pick the bundle ID, name it PhotoBeam.
3. Note the numeric **Apple ID** on the app's App Information page → put it
   in `codemagic.yaml` as `APP_APPLE_ID`.
4. **Create an API key**: Users and Access → Integrations → App Store
   Connect API → Team Keys → + . Role: App Manager. Download the `.p8`
   (you only get one shot) and note the Key ID + Issuer ID.

## 5. Codemagic (one-time)

1. Sign up at codemagic.io with your GitHub account, add the repo.
2. Teams → your team → Integrations → **App Store Connect** → add the `.p8`,
   Key ID, and Issuer ID. Name the key `photobeam-asc-key` (or edit the
   `integrations:` line in `codemagic.yaml` to match your name).
3. Push to `main`. The workflow in `codemagic.yaml` triggers automatically:
   it builds the web app, syncs Capacitor, lets Codemagic create the signing
   certificate + provisioning profile from your API key, builds the IPA, and
   uploads it to TestFlight.

## 6. Test on your iPhone

Install **TestFlight** from the App Store, accept your own internal-tester
invite (App Store Connect → TestFlight → Internal Testing → add yourself),
and the build appears after ~10–15 min of processing. Every push to `main`
ships a new build automatically.

## 7. When you're ready to release

In App Store Connect: add screenshots (take them on your phone), a
description, the privacy "nutrition label" (declare Photos access, data not
collected), select the build, and Submit for Review.

## Social import (optional)

Importing from Instagram / Facebook / Google Photos requires developer apps, a
small backend, and config — see **SOCIAL.md**. Until configured, those sources
are hidden and the native Photo Library import works on its own.

## Notes

- **AirPlay is real** (native plugin, step 2b): the Beam sheet opens the system
  AirPlay picker, and when an Apple TV / AirPlay display connects the slideshow
  renders on it as a dedicated TV view. It only works on physical hardware —
  the Simulator and browser report AirPlay as unavailable.
- **Storage:** imported photos are downscaled to ~1200px JPEGs and stored in
  the app's Data directory, so dozens of imports are fine. Deleting imports
  isn't in the UI yet; if you add it, also call `deleteImage(p.file)` from
  `storage.js`.
