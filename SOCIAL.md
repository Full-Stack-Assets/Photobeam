# Social photo import — setup

PhotoBeam can import photos from **Instagram**, **Facebook**, and **Google
Photos**. The client-side flow is fully implemented (`src/social/`); to turn it
on you must provision developer apps and a small backend, then fill in
`src/social/config.js`.

## Why a backend is required

Two things cannot be done safely or at all from inside the app:

1. **Token exchange.** OAuth requires a client *secret* to swap the auth `code`
   for an access token. Secrets must never ship in an app bundle, so the
   exchange runs on your server.
2. **Image download.** Provider image CDNs don't send CORS headers, so the
   webview cannot read their bytes (canvas/`fetch` are blocked). The backend
   proxies the download and returns the image with permissive CORS.

The app talks to the backend through two endpoints.

### `POST /auth/:provider`

Body: `{ "code": "<oauth code>", "redirectUri": "<the app redirect URI>" }`
`:provider` is `instagram` | `facebook` | `google`.

The backend exchanges the code with the provider (using the client secret) and
responds: `{ "accessToken": "<token>" }`.

### `GET /media?url=<encoded image url>`

Fetches the given provider image server-side and streams it back with
`Access-Control-Allow-Origin: *` (or your app origin). Returns the raw image
bytes (`Content-Type: image/*`).

## Provider setup

| Provider      | Create app at                              | Notes |
| ------------- | ------------------------------------------ | ----- |
| Instagram     | developers.facebook.com → *Instagram API with Instagram Login* | Basic Display was retired in Dec 2024; use the Graph-based API. Needs app review for production. |
| Facebook      | developers.facebook.com → *Facebook Login* | Request the `user_photos` permission (App Review). |
| Google Photos | console.cloud.google.com → OAuth client    | Google restricted broad library scopes in 2025; for most apps the **Photos Picker API** is the supported path. Adjust `fetchMedia` in `src/social/providers.js` accordingly. |

For each provider, register the redirect URI **exactly** as
`SOCIAL_CONFIG.redirectUri` (default `com.yourname.photobeam://oauth`).

## App configuration

1. Edit `src/social/config.js`: set `backendUrl`, `redirectUri`, and each
   provider's `clientId`, then flip `enabled: true`. Only enabled providers
   appear in the import sheet.
2. Register the redirect's custom URL scheme in iOS. In
   `ios/App/App/Info.plist`, add (matching the scheme in `redirectUri`):

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>com.yourname.photobeam</string></array>
     </dict>
   </array>
   ```

The redirect deep link is caught by `@capacitor/app`'s `appUrlOpen` event in
`src/social/oauth.js`, which closes the in-app browser and continues the flow.
