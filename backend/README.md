# PhotoBeam backend

The two endpoints the app's social import needs (see `../SOCIAL.md`):

- `POST /api/auth/:provider` — `{ code, redirectUri }` → `{ accessToken }`.
  Exchanges an OAuth code for a token using the provider's client secret.
- `GET /api/media?url=...` — proxies a provider image back with CORS headers
  (the webview can't read provider CDNs directly).

Zero npm dependencies — uses the Node 18+ global `fetch`. Written for Vercel
serverless functions (the `api/` directory maps to routes), but the handlers are
plain `(req, res)` and port easily to Netlify/Cloudflare/Express.

## Deploy to Vercel

```bash
cd backend
npx vercel            # first run links/creates the project
npx vercel --prod     # deploy to production
```

Then set the secrets (Vercel dashboard → Project → Settings → Environment
Variables, or `npx vercel env add`), using `.env.example` as the list:
`INSTAGRAM_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`,
`GOOGLE_CLIENT_ID/SECRET`, and optionally `ALLOWED_ORIGIN`. You only need the
pairs for the providers you actually enable.

## Wire the app to it

Set `backendUrl` in `src/social/config.js` to your deployment's base URL, e.g.
`https://photobeam-backend.vercel.app`. The app then calls
`${backendUrl}/auth/:provider` and `${backendUrl}/media`.

> `vercel.json` rewrites `/auth/:provider` → `/api/auth/:provider` and `/media`
> → `/api/media`, so the app's clean paths work directly against the base URL —
> no `/api` prefix needed in `backendUrl`.

## Notes

- The media proxy only fetches from known provider CDNs
  (`cdninstagram.com`, `fbcdn.net`, `googleusercontent.com`) as an SSRF guard —
  add hosts in `api/media.js` if a provider serves images elsewhere.
- Tokens are returned to the app and not stored server-side. If you later want
  refresh-token handling or long-term storage, add it here.
