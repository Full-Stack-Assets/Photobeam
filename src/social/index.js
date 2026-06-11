// Public entry point for social photo import.
//
// importFromProvider(key) runs the full flow: OAuth -> list media -> download
// each image through the backend proxy as a data URL ready for storage.

import { authorize } from "./oauth";
import { PROVIDERS } from "./providers";
import { SOCIAL_CONFIG } from "./config";

export { PROVIDERS } from "./providers";
export { isProviderEnabled } from "./config";

// Cross-origin image bytes can't be read directly in the webview (CORS taints
// canvas / blocks fetch reads), so we route downloads through the backend
// proxy, which returns the image with permissive CORS headers.
async function fetchImageDataUrl(srcUrl) {
  const proxied = `${SOCIAL_CONFIG.backendUrl}/media?url=${encodeURIComponent(srcUrl)}`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error("Image download failed");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Returns [{ id, title, dataUrl }] for the user's photos on `providerKey`.
// `limit` caps how many are pulled in one import.
export async function importFromProvider(providerKey, limit = 24) {
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`Unknown provider: ${providerKey}`);

  const accessToken = await authorize(providerKey);
  const media = (await provider.fetchMedia(accessToken)).filter((m) => m.url).slice(0, limit);

  const out = [];
  for (const m of media) {
    try {
      const dataUrl = await fetchImageDataUrl(m.url);
      out.push({ id: m.id, title: m.title, dataUrl });
    } catch {
      // Skip individual failures; one bad image shouldn't abort the import.
    }
  }
  return out;
}
