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

Then drop in the files from this folder:

- `src/App.jsx` → replaces the Vite starter App
- `src/storage.js` → new file
- `capacitor.config.ts` → project root (edit the `appId` first!)
- `codemagic.yaml` → project root

## 2. Pick your bundle ID and generate the iOS project

Choose a reverse-domain bundle ID, e.g. `com.jana.photobeam`, and put it in
**three places**: `capacitor.config.ts`, and twice in `codemagic.yaml`
(`BUNDLE_ID` var + `ios_signing.bundle_identifier`).

```bash
npm run build
npx cap add ios
```

This creates the `ios/` folder. **Commit it to git** — Codemagic builds from it.

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

## Known gaps to be aware of

- **TV discovery is simulated.** The Beam sheet shows fake TVs. Real
  AirPlay/Chromecast output needs a native plugin (e.g. a custom Capacitor
  plugin around AVRoutePickerView, or `capacitor-airplay` community
  plugins). Fine for a v1/demo, but App Review may flag it if the listing
  promises real TV casting — describe it accurately.
- **Guideline 4.2 (minimum functionality):** native photo import + offline
  albums help, but the more native the app feels, the safer the review.
- **Storage:** imported photos are downscaled to ~1200px JPEGs and stored in
  the app's Data directory, so dozens of imports are fine. Deleting imports
  isn't in the UI yet; if you add it, also call `deleteImage(p.file)` from
  `storage.js`.
