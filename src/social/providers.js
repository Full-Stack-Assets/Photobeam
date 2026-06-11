// Per-provider OAuth authorize URLs and media listing.
//
// Each provider returns a normalized media list: [{ id, url, title }], where
// `url` points at the original image. Those URLs are downloaded through the
// backend proxy (see fetchImageDataUrl in ./index.js) because cross-origin
// canvas/fetch reads are blocked in the webview.

export const PROVIDERS = {
  instagram: {
    label: "Instagram",
    authorizeUrl: ({ clientId, redirectUri, scope, state }) =>
      `https://www.instagram.com/oauth/authorize?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code&state=${state}`,
    fetchMedia: async (accessToken) => {
      const res = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url&access_token=${accessToken}`
      );
      if (!res.ok) throw new Error("Instagram media request failed");
      const json = await res.json();
      return (json.data || [])
        .filter((m) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM")
        .map((m) => ({ id: m.id, url: m.media_url, title: m.caption || "Instagram" }));
    },
  },

  facebook: {
    label: "Facebook",
    authorizeUrl: ({ clientId, redirectUri, scope, state }) =>
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code&state=${state}`,
    fetchMedia: async (accessToken) => {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/me/photos?type=uploaded&fields=id,name,images&access_token=${accessToken}`
      );
      if (!res.ok) throw new Error("Facebook photos request failed");
      const json = await res.json();
      return (json.data || []).map((p) => ({
        id: p.id,
        // images[] is ordered largest-first.
        url: p.images?.[0]?.source,
        title: p.name || "Facebook",
      }));
    },
  },

  google: {
    label: "Google Photos",
    authorizeUrl: ({ clientId, redirectUri, scope, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code&access_type=offline&state=${state}`,
    fetchMedia: async (accessToken) => {
      const res = await fetch(
        "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error("Google Photos request failed");
      const json = await res.json();
      return (json.mediaItems || [])
        .filter((m) => m.mimeType?.startsWith("image/"))
        // "=d" returns the original bytes for download.
        .map((m) => ({ id: m.id, url: `${m.baseUrl}=d`, title: m.filename || "Google Photos" }));
    },
  },
};
