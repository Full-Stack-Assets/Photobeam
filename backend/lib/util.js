// Shared helpers for the serverless functions.

// Reads a required environment variable; throws a clear error if unset so a
// misconfigured deploy fails loudly instead of silently returning bad tokens.
export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

// CORS for the app's webview. Default "*" is fine here (no cookies are used);
// set ALLOWED_ORIGIN to lock it down to your app origin if you prefer.
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
