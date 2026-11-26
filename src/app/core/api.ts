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
    return e.status === 0 ? 'Cannot reach the server' : `Error ${e.status}`;
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
