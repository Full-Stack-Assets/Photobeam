# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

PhotoBeam is a React + Capacitor iOS app: pick photos, beam them to a TV as a
slideshow over real AirPlay. The pitch is "AirPlay, minus the friction."

It is a runnable Vite project: `npm install && npm run build` produces `dist/`,
which Capacitor wraps into the iOS app. The product is shipped to TestFlight
entirely from CI (Codemagic on rented Macs) — no local Mac or Xcode is required
to build or release. See `codemagic.yaml` and `SETUP.md`.

There is no test suite or linter configured.

## Layout

- `src/App.jsx` — the entire UI (one file: tokens, shared components, sheets,
  the `Playing` slideshow, and the `App` state machine).
- `src/storage.js` — native persistence layer (Preferences + Filesystem).
- `src/native/` — the AirPlay plugin's JS side (`airplay.js` + `airplay-web.js`
  web fallback).
- `src/social/` — Instagram / Facebook / Google Photos import.
- `native/ios/` — the AirPlay **native Swift plugin** (`AirPlayPlugin.swift` +
  `.m`). Not part of the web build; added to the Xcode App target after
  `npx cap add ios` (see `SETUP.md` step 2b).
- `backend/` — zero-dependency Vercel serverless functions implementing the
  social import contract (`/auth/:provider` token exchange + `/media` image
  proxy). Deployed separately from the app.
- `capacitor.config.ts`, `codemagic.yaml` — Capacitor config and the CI/TestFlight workflow.
- `SETUP.md` (build → TestFlight), `SOCIAL.md` (social import backend + provisioning).

The generated `ios/` Xcode project is **not** in this repo and cannot be created
or built here (needs macOS). It's produced by `npx cap add ios` and committed so
Codemagic builds from it.

## Architecture

Single-screen mobile app, no router. `App()` in `src/App.jsx` is a state machine
driven by a few `useState` values:

- `screen` (`"home"` | `"playing"`) — top-level view switch. `"playing"` renders
  the `Playing` slideshow full-bleed; otherwise the library/albums shell renders.
- `tab` (`"library"` | `"albums"`) — which list shows in the home shell.
- `sheet` (`null` | `"import"` | `"beam"` | `"save"` | `{edit: album}`) —
  bottom-sheet overlays (`ImportSheet`, `BeamSheet`, `SaveSheet`, `EditSheet`).
  The `{edit}` object form carries the album being edited.
- `sel` — **ordered** array of selected photo ids. Tap order is meaningful: it
  becomes slideshow order and album order. The numbered tile badge is
  `sel.indexOf(id) + 1`.

**Photo model.** Every photo is a user import with a real image: `{ id, t, img,
file, grp }`, where `img` is a downscaled JPEG `data:` URL and `file` is its
on-disk path. There is no seed/demo content — a fresh install starts empty.
`Fill`, `Thumb`, and `Tile` still keep a gradient+emoji fallback branch for
records lacking `img`, but the real path is always `img`. `lookup(id)` resolves
over `imported`; photos are grouped in the library UI by their `grp` string
(e.g. "Your imports", "Instagram").

**Persistence split (the central design decision).** Image bytes never go in
key-value storage. Metadata (albums + photo records minus image data) lives in
Capacitor `Preferences` (key `photobeam-meta-v1`); the JPEG bytes live as files
in `Directory.Data` under `photos/<id>.jpg`. This keeps Preferences small and
avoids the "giant base64 blob" problem. On save, `saveMeta` strips the heavy
`img` field; on load, files are read back and rehydrated into the in-memory
`img` shape. Metadata saves are **debounced ~400ms** via a `useEffect` on
`[albums, imported, loading]`; image bytes are written eagerly at import time,
not on the debounce.

**Import pipeline.** Two sources, both funneling through the same downscale →
disk → state path:
- *Native library*: `Camera.pickImages` (PHPicker) → `urlToDataUrl` downscales
  to a ≤1200px JPEG `data:` URL → `saveImage` writes it → added to `imported`.
- *Social* (`importSocial` → `src/social`): OAuth → list media → download each
  image **through the backend proxy** → re-encoded via the same `urlToDataUrl`
  → `saveImage` → state. (See "Social import" below for why the proxy exists.)

**Real AirPlay output.** `BeamSheet` calls `AirPlay.presentRoutePicker()`
(`src/native/airplay.js` → native `AirPlayPlugin`), which opens the system
`AVRoutePickerView`. When a real external/AirPlay screen attaches, the native
plugin emits `screenConnected`; the sheet transitions to `Playing`. During
playback, `Playing` pushes the current photo to the TV via
`AirPlay.showPhoto({ image, title })` on each index change — the native plugin
renders it on a dedicated `UIWindow` bound to the external `UIScreen` (a clean
TV view, not phone mirroring). `stop()` calls `AirPlay.disconnect()`. The in-app
"TV" frame is a live preview of what's actually on the TV. AirPlay only works on
real hardware: `isAirPlaySupported()` is false on web/Simulator, and the web
fallback (`airplay-web.js`) reports it unavailable rather than faking a TV.

## Social import (`src/social/`)

Real OAuth import for Instagram (Meta Graph), Facebook, and Google Photos.
Disabled by default — each provider must be enabled in `src/social/config.js`,
and only enabled ones appear in `ImportSheet`. Two hard constraints shape the
design, both documented in `SOCIAL.md`:

1. **A backend is mandatory.** OAuth token exchange needs the client *secret*,
   which must never ship in the app. `src/social/oauth.js` posts the auth code
   to `POST {backendUrl}/auth/:provider` and gets back an access token.
2. **Image download is proxied.** Provider CDNs don't send CORS headers, so the
   webview can't read their bytes. `src/social/index.js` downloads every image
   through `GET {backendUrl}/media?url=...` instead of fetching the CDN directly.

`config.js` holds only public values (client IDs, redirect URI, backend URL) as
placeholders. The OAuth redirect is a custom URL scheme deep link caught by
`@capacitor/app`'s `appUrlOpen`; the scheme must be registered in `Info.plist`
(see `SOCIAL.md`).

## Styling conventions

- **No CSS framework classes for color/spacing of substance.** Tailwind utility
  classes handle layout, but all colors, gradients, and theming come from the
  inline `C` token object and inline `style={{...}}` props. Reuse `C.*`, `BEAM`
  (the signature amber→coral gradient), and `MONO` rather than new literals.
- Keyframe animations are injected as a raw `<style>{CSS}</style>` string in
  `App.jsx` (classes `kb`, `xf`, `ringA/B`, `rise`, `fade`, `spin`), all honoring
  `prefers-reduced-motion`.
- iOS safe areas use `env(safe-area-inset-*)` padding because
  `capacitor.config.ts` sets `contentInset: "never"` (web extends under the
  notch/home bar) and `index.html` sets `viewport-fit=cover`. Preserve these
  paddings when touching headers/footers.
- The app is locked to a phone-width column (`max-w-md` centered).

## Build / release flow

- `npm run dev` — browser dev. AirPlay and social login require a device build,
  so those report unavailable in the browser; native photo import is stubbed by
  Capacitor's web layer.
- `npm run build` — produces `dist/`.
- `npx cap sync ios` — copies `dist/` into the iOS shell.

**Release** is automatic: pushing to `main` triggers the `ios-testflight`
Codemagic workflow (build web → `cap sync` → `pod install` → bump build number
from latest TestFlight → sign via the `photobeam-asc-key` ASC API key → upload
IPA). The bundle ID must stay in sync across **three** places: `appId` in
`capacitor.config.ts`, and `BUNDLE_ID` + `ios_signing.bundle_identifier` in
`codemagic.yaml`.

## Gotchas

- `appId`/bundle IDs (`com.yourname.photobeam`) and `APP_APPLE_ID` are
  placeholders; CI signing fails until they're real and consistent. The same
  `appId` scheme is also the social OAuth redirect scheme (`SOCIAL_CONFIG.redirectUri`).
- The native AirPlay plugin (`native/ios/`) must be added to the Xcode App
  target after `npx cap add ios`, or the app builds but reports AirPlay
  unavailable. Editing the Swift can't be compiled/tested here (needs macOS).
- Deleting imports isn't wired into the UI. If you add it, also call
  `deleteImage(p.file)` (in `storage.js`) so the on-disk JPEG is removed, not
  just the metadata record.
- Empty albums are intentionally deleted on save in `EditSheet`/`updateAlbum`.
