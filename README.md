# Spa Manager - web UI (Angular)

Angular 22 standalone-components app for the `spa-backend` API: sign in, appointments, new-customer onboarding,
customer history and editing, appointment rescheduling, therapists & services with edit (admin), user accounts and password reset (admin), change-own-password, monthly reports (admin), payroll with payslip PDF download (admin).

```bash
npm install
ng serve          # http://localhost:4200 - proxies /api to http://localhost:8080 (proxy.conf.json)
ng build          # dist/spa-ui
```

Run the backend first (set `SPA_CORS_ORIGINS` there if the UI is served from anything but `localhost:4200`).

## Configuration: `public/config.json`
Read at start-up, so the same build runs anywhere. `apiBase` is `/api` by default (same host, reverse-proxied) or the full
`https://...` URL of the API. When the API is on another origin, add this site's address to the API's `SPA_CORS_ORIGINS`.
Plain `http://` is only honoured for `localhost`, so a mistyped config can never send logins over the open internet.

## Deploy free on Cloudflare Pages
1. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> **Connect to Git** -> `management-ui`.
2. Build command `npm ci && npm run build`, output directory `dist/spa-ui/browser`, environment variable `NODE_VERSION` = `22`.
3. Put your API address in `public/config.json` (`{ "apiBase": "https://<your-api>/api" }`), commit and push; every push to `main` redeploys.
4. Add the resulting `https://<project>.pages.dev` address to the API's `SPA_CORS_ORIGINS`.

Pages serves `index.html` for unknown paths (so reloading `/payroll` works) and applies `public/_headers`: security headers, a
Content-Security-Policy (scripts and styles from this site only; API calls to `https:` hosts), no-cache for `index.html` and
`config.json`, immutable caching for hashed assets. Without Git: `npm run build && npx wrangler pages deploy dist/spa-ui/browser --project-name management-ui`
(needs a Cloudflare API token). Other static hosts work too (Netlify honours `_headers`; for GitHub Pages or S3 add an
`index.html` -> 404 fallback and set the headers at the host).

The bearer token is kept in `sessionStorage` (cleared when the tab closes); an expired token sends you back to the login page.

## Self-hosting behind your own proxy (e.g. Caddy)
Serve `dist/spa-ui/browser` and reverse-proxy `/api` to the backend; leave `apiBase` at `/api` (no CORS needed):

```
spa.example.com {
  handle /api/* { reverse_proxy localhost:8080 }
  handle { root * /srv/spa-ui ; try_files {path} /index.html ; file_server }
}
```
