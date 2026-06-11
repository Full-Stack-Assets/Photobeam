// OAuth authorization-code flow for native (Capacitor) and web.
//
// 1. Open the provider's authorize URL in the system browser.
// 2. The provider redirects to our deep link (redirectUri) with ?code=...
//    On native that re-opens the app (appUrlOpen); on web it returns to the
//    redirect page which we read from the URL.
// 3. POST the code to the backend, which holds the client secret and exchanges
//    it for an access token (never done in-app).

import { Browser } from "@capacitor/browser";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SOCIAL_CONFIG } from "./config";
import { PROVIDERS } from "./providers";

const randomState = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Waits for the OAuth redirect deep link and resolves with the auth `code`.
function waitForRedirect(expectedState) {
  return new Promise((resolve, reject) => {
    let handle;
    const timeout = setTimeout(() => {
      handle?.remove();
      reject(new Error("Authorization timed out"));
    }, 180000);

    CapApp.addListener("appUrlOpen", ({ url }) => {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      const code = parsed.searchParams.get("code");
      const state = parsed.searchParams.get("state");
      if (!code) return; // not our redirect
      clearTimeout(timeout);
      handle?.remove();
      Browser.close().catch(() => {});
      if (state !== expectedState) reject(new Error("State mismatch — aborting"));
      else resolve(code);
    }).then((h) => {
      handle = h;
    });
  });
}

export async function authorize(providerKey) {
  const cfg = SOCIAL_CONFIG.providers[providerKey];
  const provider = PROVIDERS[providerKey];
  if (!cfg || !provider) throw new Error(`Unknown provider: ${providerKey}`);

  const state = randomState();
  const url = provider.authorizeUrl({
    clientId: cfg.clientId,
    redirectUri: SOCIAL_CONFIG.redirectUri,
    scope: cfg.scope,
    state,
  });

  let code;
  if (Capacitor.isNativePlatform()) {
    const redirectPromise = waitForRedirect(state);
    await Browser.open({ url });
    code = await redirectPromise;
  } else {
    // Browser dev: pop the consent screen; the redirect page must postMessage
    // or you paste the code. Kept minimal — real flow runs on device.
    window.open(url, "_blank");
    throw new Error("Social login runs on the iOS app; use a device build.");
  }

  // Exchange the code for an access token on the backend (holds the secret).
  const res = await fetch(`${SOCIAL_CONFIG.backendUrl}/auth/${providerKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri: SOCIAL_CONFIG.redirectUri }),
  });
  if (!res.ok) throw new Error("Token exchange failed");
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error("No access token returned");
  return accessToken;
}
