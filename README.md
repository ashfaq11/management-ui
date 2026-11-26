# Spa Manager - web UI (Angular)

Angular 22 standalone-components app for the `spa-backend` API: sign in, appointments, new-customer onboarding,
customer history, therapists & services (admin), monthly reports (admin), payroll with payslip PDF download (admin).

```bash
npm install
ng serve          # http://localhost:4200 - proxies /api to http://localhost:8080 (proxy.conf.json)
ng build          # dist/spa-ui
```

Run the backend first (set `SPA_CORS_ORIGINS` there if the UI is served from anything but `localhost:4200`).

## Production
The UI calls the relative path `/api` (`API_BASE` in `src/app/core/api.ts`). Serve `dist/spa-ui/browser` from the same
host as the API and reverse-proxy `/api` to the backend, e.g. with Caddy:

```
spa.example.com {
  handle /api/* { reverse_proxy localhost:8080 }
  handle { root * /srv/spa-ui ; try_files {path} /index.html ; file_server }
}
```
To host the API on a different origin instead, change `API_BASE` to its full URL and add the UI origin to the backend's `SPA_CORS_ORIGINS`.

The bearer token is kept in `sessionStorage` (cleared when the tab closes); an expired token sends you back to the login page.
