import { Component, OnInit, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Auth } from '../core/auth';

interface Contact { renewal_name: string | null; renewal_phone: string | null; renewal_email: string | null; renewal_message: string | null; }

/** Shown to an expired spa's users: when it ended and whom to contact. */
@Component({
  selector: 'app-renew',
  template: `
  <div class="card" style="max-width:460px;margin:10vh auto;text-align:center">
    <div style="font-size:40px">&#9203;</div>
    <h2>{{ auth.me()?.is_trial ? 'Your free trial has ended' : 'Your subscription has ended' }}</h2>
    <p class="hint">{{ auth.me()?.spa_name }}{{ auth.me()?.plan_end ? ' · ended on ' + auth.me()?.plan_end : '' }}.
      Your data is safe — renew to continue using it.</p>
    @if (c(); as c) {
      @if (c.renewal_message) { <p>{{ c.renewal_message }}</p> }
      <div style="background:var(--bg);border-radius:12px;padding:14px;margin:14px 0;text-align:left">
        @if (c.renewal_name) { <div><b>{{ c.renewal_name }}</b></div> }
        @if (c.renewal_phone) { <div>Phone / WhatsApp: <a [href]="'tel:' + c.renewal_phone">{{ c.renewal_phone }}</a>
          · <a [href]="'https://wa.me/' + digits(c.renewal_phone)" target="_blank" rel="noopener">WhatsApp</a></div> }
        @if (c.renewal_email) { <div>Email: <a [href]="'mailto:' + c.renewal_email">{{ c.renewal_email }}</a></div> }
        @if (!c.renewal_phone && !c.renewal_email) { <div class="hint">Contact the person who set up your account.</div> }
      </div>
    }
    <button class="s" (click)="auth.logout()">Sign out</button>
  </div>`,
})
export class Renew implements OnInit {
  auth = inject(Auth); private api = inject(Api);
  c = signal<Contact | null>(null);
  digits(v: string) { return v.replace(/\D/g, ''); }
  async ngOnInit() { await this.auth.restore(); try { this.c.set(await this.api.get<Contact>('/platform/contact')); } catch { /* ignore */ } }
}
