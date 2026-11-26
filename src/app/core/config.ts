/**
 * Settings read at start-up from /config.json (a static file next to index.html), so ONE build can be
 * deployed anywhere: edit the file on the host, no rebuild.
 *   {"apiBase": "/api"}                              same host, reverse-proxied (default)
 *   {"apiBase": "https://api.example.com/api"}       API on another origin (add this site to the API's SPA_CORS_ORIGINS)
 */
export const config = { apiBase: '/api' };

export async function loadConfig(): Promise<void> {
  try {
    const r = await fetch('config.json', { cache: 'no-store' });
    if (!r.ok) return;
    const base = String((await r.json()).apiBase ?? '').trim().replace(/\/+$/, '');
    // a relative path, https, or plain http only for local development - never send logins over http to a remote host
    if (/^(\/|https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)/.test(base + '/')) config.apiBase = base;
  } catch {
    /* missing or invalid file (a SPA host may answer index.html): keep the default */
  }
}
