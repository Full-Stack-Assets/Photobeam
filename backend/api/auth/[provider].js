// POST /api/auth/:provider
//   body: { code, redirectUri }
//   ->   { accessToken }
//
// Exchanges an OAuth authorization code for an access token using the provider's
// client secret (kept in env vars here, never in the app). Mirrors the contract
// in SOCIAL.md and src/social/oauth.js.

import { env, setCors } from "../../lib/util.js";

const EXCHANGES = {
  instagram: async ({ code, redirectUri }) => {
    // Short-lived token from the Instagram API (with Instagram Login).
    const body = new URLSearchParams({
      client_id: env("INSTAGRAM_CLIENT_ID"),
      client_secret: env("INSTAGRAM_CLIENT_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const r = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_message || "Instagram token exchange failed");

    // Best-effort upgrade to a long-lived (60-day) token.
    let token = j.access_token;
    try {
      const u = new URL("https://graph.instagram.com/access_token");
      u.searchParams.set("grant_type", "ig_exchange_token");
      u.searchParams.set("client_secret", env("INSTAGRAM_CLIENT_SECRET"));
      u.searchParams.set("access_token", token);
      const lr = await fetch(u);
      const lj = await lr.json();
      if (lr.ok && lj.access_token) token = lj.access_token;
    } catch {
      /* keep the short-lived token */
    }
    return token;
  },

  facebook: async ({ code, redirectUri }) => {
    const u = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    u.searchParams.set("client_id", env("FACEBOOK_CLIENT_ID"));
    u.searchParams.set("client_secret", env("FACEBOOK_CLIENT_SECRET"));
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("code", code);
    const r = await fetch(u);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || "Facebook token exchange failed");
    return j.access_token;
  },

  google: async ({ code, redirectUri }) => {
    const body = new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || "Google token exchange failed");
    return j.access_token;
  },
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const exchange = EXCHANGES[req.query.provider];
  if (!exchange) return res.status(404).json({ error: "Unknown provider" });

  const { code, redirectUri } = req.body || {};
  if (!code || !redirectUri) return res.status(400).json({ error: "Missing code or redirectUri" });

  try {
    const accessToken = await exchange({ code, redirectUri });
    if (!accessToken) throw new Error("No access token returned");
    return res.status(200).json({ accessToken });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
