// Social import configuration.
//
// Fill these in to enable Instagram / Facebook / Google Photos import.
// See SOCIAL.md for how to obtain each value and what your backend must do.
//
// SECURITY: client SECRETS never live in this file (or anywhere in the app
// bundle). The OAuth token exchange — and image downloads, which are blocked
// client-side by CORS — happen on YOUR backend. This file holds only public
// client IDs and URLs.

export const SOCIAL_CONFIG = {
  // Base URL of your backend (see SOCIAL.md for the required endpoints:
  // POST /auth/:provider  and  GET /media?url=...).
  backendUrl: "https://YOUR_BACKEND.example.com",

  // Deep link the OAuth redirect returns to. Must EXACTLY match:
  //   - the redirect URI registered with each provider, and
  //   - a CFBundleURLSchemes entry in ios/App/App/Info.plist.
  redirectUri: "com.yourname.photobeam://oauth",

  providers: {
    // Meta Instagram API with Instagram Login (Basic Display was retired 2024).
    instagram: {
      enabled: false,
      clientId: "YOUR_INSTAGRAM_APP_ID",
      scope: "instagram_business_basic",
    },
    // Facebook Login + Graph API.
    facebook: {
      enabled: false,
      clientId: "YOUR_FACEBOOK_APP_ID",
      scope: "public_profile,user_photos",
    },
    // Google Photos. NOTE: Google restricted broad library scopes in 2025; the
    // Photos Picker API is the current path for most apps (see SOCIAL.md).
    google: {
      enabled: false,
      clientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
      scope: "https://www.googleapis.com/auth/photoslibrary.readonly",
    },
  },
};

export const isProviderEnabled = (key) =>
  Boolean(SOCIAL_CONFIG.providers[key]?.enabled);
