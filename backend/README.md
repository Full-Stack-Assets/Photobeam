# PhotoBeam backend

The two endpoints the app's social import needs (see `../SOCIAL.md`):

- `POST /api/auth/:provider` — `{ code, redirectUri }` → `{ accessToken }`.
  Exchanges an OAuth code for a token using the provider's client secret.
- `GET /api/media?url=...` — proxies a provider image back with CORS headers
  (the webview can't read provider CDNs directly).

Zero npm dependencies — uses the Node 18+ global `fetch`. The handlers are plain
`(req, res)` functions and can be mounted by a Node-compatible serverless host,
Express adapter, or another runtime with a small request/response adapter.

## Deploy

Choose a Node-compatible deployment target and expose the `api/` handlers under
an `/api` prefix. Configure the secrets from `.env.example` in that runtime:
`INSTAGRAM_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`,
`GOOGLE_CLIENT_ID/SECRET`, and optionally `ALLOWED_ORIGIN`. You only need the
pairs for the providers you actually enable.

No production endpoint is hard-coded in this repository. Verify the selected
runtime's routing and environment-variable configuration before enabling social
import.

## Wire the app to it

Set `backendUrl` in `src/social/config.js` to the deployed API prefix, for
example `https://api.example.com/api`. The app then calls
`${backendUrl}/auth/:provider` and `${backendUrl}/media`.

If your runtime exposes different public paths, adapt its routing layer or use a
small Node/Express wrapper rather than changing the OAuth/media handler logic.

## Notes

- The media proxy only fetches from known provider CDNs
  (`cdninstagram.com`, `fbcdn.net`, `googleusercontent.com`) as an SSRF guard —
  add hosts in `api/media.js` if a provider serves images elsewhere.
- Tokens are returned to the app and not stored server-side. If you later want
  refresh-token handling or long-term storage, add it here.
