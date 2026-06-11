# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

PhotoBeam is a React + Capacitor iOS app: pick photos, "beam" them to a TV as a
slideshow. The pitch is "AirPlay, minus the friction."

**This repo holds only the hand-authored source files, not a runnable project.**
There is no `package.json`, no `src/`, no `ios/`, no committed build tooling. The
files here are meant to be dropped into a freshly scaffolded Vite project, as
described in `SETUP.md`. Treat that file as the source of truth for how the
pieces assemble into a buildable app. Do not assume `npm install`/`npm run`
work from a clean checkout of this repo — they won't until the Vite project is
created around these files.

The product is shipped to TestFlight entirely from CI (Codemagic on rented
Macs); no local Mac or Xcode is required to build or release. See
`codemagic.yaml` and `SETUP.md`.

## Two parallel app implementations

There are **two complete, independent implementations of the same app**. They
do not import each other. Know which one you're editing before making changes:

- **`App.jsx` + `storage.js`** — the pair `SETUP.md` installs (as `src/App.jsx`
  and `src/storage.js`). The component imports persistence helpers from
  `storage.js`. Storage key is `photobeam-meta-v1`. Rehydrates images as
  base64 `data:` URLs on load.
- **`PhotoBeam.jsx`** — a self-contained, single-file "Capacitor-native build"
  with all storage logic inlined (no `storage.js`). Storage key is
  `photobeam-v3`, with one-time migration from a legacy `photobeam-v2`. It is
  the more advanced variant: resolves file paths to displayable URLs via
  `Capacitor.convertFileSrc` on native and a `Filesystem.readFile` data-URL
  fallback on web, and includes a hidden `<input type="file">` fallback so the
  importer works in a browser during development.

Both share the same design tokens (`C`), seed data (`SEED_PHOTOS`, `TVS`),
component structure, and UX. If you change behavior, decide deliberately
whether the change belongs in one variant or must be mirrored across both —
they drift otherwise.

## Architecture (applies to both variants)

Single-screen mobile app, no router. `App()` is a state machine driven by a few
`useState` values:

- `screen` (`"home"` | `"playing"`) — top-level view switch. `"playing"`
  renders the `Playing` slideshow component full-bleed; otherwise the
  library/albums shell renders.
- `tab` (`"library"` | `"albums"`) — which list shows in the home shell.
- `sheet` (`null` | `"beam"` | `"save"` | `{edit: album}`) — bottom-sheet
  overlays (`BeamSheet`, `SaveSheet`, `EditSheet`). The `{edit}` object form
  carries the album being edited.
- `sel` — **ordered** array of selected photo ids. Tap order is meaningful: it
  becomes slideshow order and album order. The numbered badge on a tile is
  `sel.indexOf(id) + 1`.

**Photo model.** A photo is either a *seed* (gradient + emoji placeholder, has
`g`/`e`, no real image) or an *imported* user photo (has `img`/`file`). The
`Fill`, `Thumb`, and `Tile` components branch on `p.img` to render either a real
`<img>` or the gradient+emoji. Seeds are demo content so the UI looks populated
without any imports. `lookup(id)` resolves across `[...imported, ...SEED_PHOTOS]`.
Photos are grouped in the library UI by their `grp` string.

**Persistence split (the central design decision).** Image bytes never go in
key-value storage. Metadata (albums + photo records minus image data) lives in
Capacitor `Preferences`; the JPEG bytes live as files in `Directory.Data` under
`photos/<id>.jpg`. This keeps Preferences small and avoids the "giant base64
blob" problem. On save, the heavy `img` field is stripped before writing
metadata (`saveMeta` in `storage.js`; inline equivalent in `PhotoBeam.jsx`). On
load, files are read back and rehydrated into the in-memory `img` shape the
components expect. Metadata saves are **debounced ~400ms** in `App.jsx` via a
`useEffect` on `[albums, imported, loading]`; image bytes are written eagerly at
import time, not on the debounce.

**Import pipeline.** Native picker (`Camera.pickImages`, PHPicker) → every image
is downscaled to a ≤1200px JPEG `data:` URL via the canvas helper
(`urlToDataUrl` in `App.jsx`) → written to disk (`saveImage`) → added to
`imported` state. Downscaling keeps dozens of imports cheap.

**TV discovery is simulated.** `BeamSheet` fakes a scan: it reveals hardcoded
`TVS` on staggered timers, then runs a fake proximity handshake through the
`STEPS` list before calling `onConnected`. There is no real AirPlay/Chromecast
output — that needs a native Capacitor plugin and is a known gap (see
`SETUP.md`). Do not describe casting as real in any user-facing copy or store
listing.

## Styling conventions

- **No CSS framework classes for color/spacing of substance.** Tailwind utility
  classes are used for layout, but all colors, gradients, and theming come from
  the inline `C` token object and inline `style={{...}}` props. Reuse `C.*`,
  `BEAM` (the signature amber→coral gradient), and `MONO` rather than
  introducing new literals.
- Keyframe animations are injected as a raw `<style>{CSS}</style>` string in
  `App.jsx` (classes like `kb`, `xf`, `ringA/B`, `rise`, `fade`, `spin`), and
  all honor `prefers-reduced-motion`.
- iOS safe areas are handled with `env(safe-area-inset-*)` padding because
  `capacitor.config.ts` sets `contentInset: "never"` (web content extends under
  the notch/home bar). Preserve these paddings when touching headers/footers.
- The app is locked to a phone-width column (`max-w-md` centered).

## Build / release flow

There is nothing to run from this repo directly. To get a working project, follow
`SETUP.md`:

1. Scaffold Vite React, install deps:
   `npm install lucide-react @capacitor/core @capacitor/ios @capacitor/preferences @capacitor/filesystem @capacitor/camera`
   and dev deps `@capacitor/cli tailwindcss @tailwindcss/vite`.
2. Wire Tailwind v4 via the Vite plugin and `@import "tailwindcss";` in
   `src/index.css`.
3. Copy files in: `App.jsx`→`src/App.jsx`, `storage.js`→`src/storage.js`,
   `capacitor.config.ts` and `codemagic.yaml`→ project root.
4. `npm run build` then `npx cap add ios` (commit the generated `ios/` folder —
   Codemagic builds from it).
5. Add `NSPhotoLibraryUsageDescription` to `ios/App/App/Info.plist`.

Once set up, the common commands are the Vite/Capacitor defaults: `npm run dev`
(browser dev — only `PhotoBeam.jsx`'s web fallbacks make the importer work
there), `npm run build`, `npx cap sync ios`. There is no test suite or linter
configured in this repo.

**Release** is automatic: pushing to `main` triggers the `ios-testflight`
Codemagic workflow, which builds the web app, `npx cap sync ios`, `pod install`,
bumps the build number from the latest TestFlight build, signs via the App Store
Connect API key integration (`photobeam-asc-key`), and uploads the IPA to
TestFlight. The bundle ID must be kept in sync in **three** places:
`capacitor.config.ts` (`appId`) and `codemagic.yaml` (`BUNDLE_ID` var and
`ios_signing.bundle_identifier`).

## Gotchas

- `appId` in `capacitor.config.ts` and the bundle IDs / `APP_APPLE_ID` in
  `codemagic.yaml` are placeholders (`com.yourname.photobeam`, `1234567890`).
  They must be real and consistent for CI to sign and upload.
- Deleting imports is not wired into the UI. If you add it, also call
  `deleteImage(p.file)` (in `storage.js`) so the on-disk JPEG is removed, not
  just the metadata record.
- Empty albums are intentionally deleted on save in `EditSheet`/`updateAlbum`.
