// GET /api/media?url=<encoded provider image url>
//
// Downloads a provider image server-side and streams it back with CORS headers,
// because provider CDNs don't send CORS and the webview can't read their bytes
// directly. Mirrors fetchImageDataUrl in src/social/index.js.

import { setCors } from "../lib/util.js";

// SSRF guard: only proxy images from known provider CDNs. Extend if a provider
// serves media from another host.
const ALLOWED_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "googleusercontent.com",
];

const hostAllowed = (hostname) =>
  ALLOWED_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith("." + s));

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const target = req.query.url;
  if (!target) return res.status(400).json({ error: "Missing url" });

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }
  if (parsed.protocol !== "https:" || !hostAllowed(parsed.hostname)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) return res.status(502).json({ error: "Upstream returned " + upstream.status });
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(buf);
  } catch {
    return res.status(502).json({ error: "Image fetch failed" });
  }
}
