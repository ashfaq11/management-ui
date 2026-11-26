import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api';
import { Me } from './models';

const KEY = 'spa.token';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  readonly token = signal<string | null>(this.read());
  readonly me = signal<Me | null>(null);
  readonly isAdmin = computed(() => this.me()?.role === 'admin');

  private read(): string | null {
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  }

  async login(username: string, password: string) {
    const r = await this.api.post<{ token: string }>('/auth/login', { username, password });
    this.token.set(r.token);
    try { sessionStorage.setItem(KEY, r.token); } catch { /* storage blocked: stay in memory */ }
    this.me.set(await this.api.get<Me>('/auth/me'));
  }

  /** Restore the user after a page reload. Returns false when the token is no longer valid. */
  async restore(): Promise<boolean> {
    if (this.me()) return true;
    if (!this.token()) return false;
    try { this.me.set(await this.api.get<Me>('/auth/me')); return true; } catch { this.clear(); return false; }
  }

  async logout() {
    try { if (this.token()) await this.api.post('/auth/logout', {}); } catch { /* already invalid */ }
    this.clear();
    await this.router.navigateByUrl('/login');
  }

  clear() {
    this.token.set(null); this.me.set(null);
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
