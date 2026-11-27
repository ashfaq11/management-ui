import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../core/api';

export const WA_KEYS = ['reminder', 'receipt', 'topup', 'renew', 'hello'] as const;
export type WaKey = typeof WA_KEYS[number];
export const WA_LABELS: Record<WaKey, string> = {
  reminder: 'Appointment reminder', receipt: 'Visit receipt (after completing)', topup: 'Low balance · top up',
  renew: 'Membership ended · renew', hello: 'General message (customer list)',
};
export const WA_DEFAULTS: Record<WaKey, string> = {
  reminder: 'Hi {name}, a reminder of your {service} at {spa} on {when} with {therapist}. See you soon!',
  receipt: 'Hi {name}, thank you for visiting {spa}! {service} done.{used}{due}',
  topup: 'Hi {name}, your {plan} membership has only {left} left. Top up now and keep enjoying your sessions!',
  renew: 'Hi {name}, your {plan} membership has ended. Renew today and continue your sessions with us!',
  hello: 'Hi {name}, ',
};

/** The spa's WhatsApp texts (Settings page), with {placeholders} filled in. */
@Injectable({ providedIn: 'root' })
export class Wa {
  private api = inject(Api);
  saved = signal<Partial<Record<WaKey, string>>>({});
  private loaded = false;
  load(force = false) {
    if (this.loaded && !force) return;
    this.loaded = true;
    this.api.get<Partial<Record<WaKey, string>>>('/spa/templates').then((t) => this.saved.set(t ?? {})).catch(() => (this.loaded = false));
  }
  text(key: WaKey, vars: Record<string, string | number | null | undefined>) {
    this.load();
    const t = this.saved()[key] || WA_DEFAULTS[key];
    return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }
  link(phone: string | null | undefined, key: WaKey, vars: Record<string, string | number | null | undefined>) {
    const n = (phone ?? '').replace(/\D/g, '');
    if (!n) return '';
    return `https://wa.me/${n.length === 10 ? '91' + n : n}?text=${encodeURIComponent(this.text(key, vars))}`;
  }
}
