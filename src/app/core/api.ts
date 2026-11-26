import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { config } from './config';

/** Backend base URL comes from config.json (default /api; in dev `ng serve` proxies it to :8080, see proxy.conf.json). */

export function errorText(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    const d = e.error?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)}: ${x.msg}`).join('; ');
    if (e.status === 0) return 'Cannot reach the server: the network, a CORS rule or the HTTPS certificate is blocking the call';
    if ([502, 503, 504].includes(e.status)) {
      return `The API is not responding (${e.status}). If it was idle it may be waking up, so retry in a minute; otherwise the server or its database is down.`;
    }
    // an HTML page came back instead of JSON: the request never reached the API
    if (e.status === 404 || e.status === 200) return `The API was not found at ${config.apiBase}. Check apiBase in config.json or the /api rewrite in vercel.json.`;
    return `Error ${e.status}`;
  }
  return e instanceof Error ? e.message : String(e);
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(config.apiBase + path, { params: p }));
  }
  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(config.apiBase + path, body));
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(config.apiBase + path, body));
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(config.apiBase + path, body));
  }
  blob(path: string): Promise<Blob> {
    return firstValueFrom(this.http.get(config.apiBase + path, { responseType: 'blob' }));
  }
}
