import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Appointment, CustomerPlan } from '../core/models';
import { DurationPipe } from './duration.pipe';

const STATUS: Record<string, [string, string]> = {
  booked: ['Booked', 'acc'], completed: ['Completed', 'ok'], cancelled: ['Cancelled', 'bad'], no_show: ['No-show', 'bad'],
};
const PAY: Record<string, [string, string]> = {
  paid: ['Paid', 'ok'], partial: ['Part paid', 'gold'], pending: ['Unpaid', 'gold'], prepaid: ['Membership', 'acc'],
};

/** Dashboard: today's bookings as a table; a row opens a detail popup with the customer, money and quick actions. */
@Component({
  selector: 'app-today-bookings', imports: [RouterLink, DurationPipe],
  styles: [`
    tr.trow{cursor:pointer}tr.trow:hover td{background:var(--acc-soft)}
    tr.now td{box-shadow:inset 3px 0 0 var(--ok)}
    .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:600}
    .acc{background:var(--acc-soft);color:var(--acc)}.ok{background:var(--ok-soft);color:var(--ok)}
    .bad{background:var(--bad-soft);color:var(--bad)}.gold{background:var(--gold-soft);color:var(--gold)}
    .sum{display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 10px}
    .scrim{position:fixed;inset:0;z-index:50;background:rgba(10,17,26,.5);display:grid;place-items:center;padding:16px}
    .pop{background:var(--card);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:18px 20px;
      box-shadow:0 20px 60px rgba(0,0,0,.3);animation:rise .18s ease-out}
    .pop header{display:flex;align-items:flex-start;gap:10px}.pop header h3{margin:0;font-size:18px;flex:1}
    .x{background:none;border:0;font-size:22px;color:var(--mut);cursor:pointer;min-height:auto;padding:0 4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:14px 0}
    .grid span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:600}
    .grid b{font-weight:600}
    .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.acts a{text-decoration:none}`],
  template: `
  <section class="card">
    <div class="row" style="justify-content:space-between;align-items:center;margin:0"><h2>Today's bookings</h2>
      <a routerLink="/appointments" class="hint">Open appointments →</a></div>
    <div class="sum">
      <span class="pill acc">{{ counts().booked }} booked</span><span class="pill ok">{{ counts().completed }} done</span>
      <span class="pill bad">{{ counts().missed }} cancelled / no-show</span><span class="pill gold">₹{{ due().toLocaleString('en-IN') }} due</span>
    </div>
    <div class="wrap"><table>
      <tr><th>Time</th><th>Customer</th><th>Service</th><th>Duration</th><th>Therapist</th><th>Status</th><th>Payment</th><th class="num">Due</th><th></th></tr>
      @for (a of rows(); track a.id) {
        <tr class="trow" [class.now]="isNow(a)" (click)="open(a)">
          <td><b>{{ a.start_at.slice(11, 16) }}</b></td><td>{{ a.customer }}</td><td>{{ a.service }}</td>
          <td>{{ a.duration_min | dur }}</td><td>{{ a.therapist }}</td>
          <td><span class="pill" [class]="'pill ' + st(a)[1]">{{ st(a)[0] }}</span></td>
          <td><span class="pill" [class]="'pill ' + py(a)[1]">{{ py(a)[0] }}</span></td>
          <td class="num">{{ a.balance_due ? '₹' + (+a.balance_due).toLocaleString('en-IN') : '—' }}</td>
          <td>@if (a.phone && a.status === 'booked') { <a [href]="wa(a)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" title="Send WhatsApp reminder"
            style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:#25d366;color:#fff;font-size:12px;font-weight:600;text-decoration:none">WhatsApp</a> }</td></tr>
      } @empty { <tr><td colspan="9">No bookings today.</td></tr> }
    </table></div>
  </section>

  @if (sel(); as a) {
    <div class="scrim" (click)="sel.set(null)">
      <div class="pop" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <header><h3>{{ a.customer }}<small style="display:block;font-size:13px;color:var(--mut);font-weight:500">{{ a.phone }}</small></h3>
          <span class="pill" [class]="'pill ' + st(a)[1]">{{ st(a)[0] }}</span>
          <button class="x" aria-label="Close" (click)="sel.set(null)">&times;</button></header>
        <div class="grid">
          <div><span>Service</span><b>{{ a.service }}</b></div>
          <div><span>Therapist</span><b>{{ a.therapist }}</b></div>
          <div><span>Time</span><b>{{ a.start_at.slice(11, 16) }} – {{ endTime(a) }}</b></div>
          <div><span>Duration</span><b>{{ a.duration_min | dur }}</b></div>
          <div><span>Price</span><b>₹{{ (+a.price).toLocaleString('en-IN') }}</b></div>
          <div><span>Paid / due</span><b>₹{{ (+(a.paid_amount || 0)).toLocaleString('en-IN') }} / ₹{{ (+(a.balance_due || 0)).toLocaleString('en-IN') }}</b></div>
          <div><span>Payment</span><b>{{ py(a)[0] }}{{ a.plan_name ? ' · ' + a.plan_name + ' (' + a.plan_deducted + ' ' + a.plan_unit + ')' : '' }}</b></div>
          <div><span>Prefers to pay</span><b>{{ a.preferred_payment_method || '—' }}</b></div>
          <div><span>Membership balance</span><b>{{ balance() }}</b></div>
          <div><span>Visits so far</span><b>{{ visits() ?? '…' }}</b></div>
          @if (a.notes) { <div style="grid-column:1/-1"><span>Notes</span><b>{{ a.notes }}</b></div> }
        </div>
        <div class="acts">
          @if (a.phone) { <a class="s" [href]="'tel:' + a.phone"><button class="s">Call</button></a>
            <a [href]="wa(a)" target="_blank" rel="noopener"><button class="s">WhatsApp reminder</button></a> }
          <a routerLink="/appointments" (click)="sel.set(null)"><button class="p" style="margin:0">Open in appointments</button></a>
          <a [routerLink]="'/customers'" [queryParams]="{ id: a.customer_id }" (click)="sel.set(null)"><button class="s">Customer history</button></a>
        </div>
      </div>
    </div>
  }`,
})
export class TodayBookings implements OnInit {
  private api = inject(Api);
  rows = signal<Appointment[]>([]); sel = signal<Appointment | null>(null);
  plans = signal<CustomerPlan[]>([]); visits = signal<number | null>(null);
  counts = computed(() => {
    const r = this.rows();
    return { booked: r.filter((a) => a.status === 'booked').length, completed: r.filter((a) => a.status === 'completed').length,
      missed: r.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length };
  });
  due = computed(() => this.rows().filter((a) => a.status === 'completed').reduce((t, a) => t + Number(a.balance_due || 0), 0));
  balance = computed(() => {
    const live = this.plans().filter((p) => Number(p.balance) > 0 && (!p.expires_on || p.expires_on >= this.today));
    if (!live.length) return 'No active membership';
    return live.map((p) => p.plan_type === 'hours' ? `${+p.balance} hrs` : `₹${(+p.balance).toLocaleString('en-IN')}`).join(' + ');
  });
  private today = new Date().toISOString().slice(0, 10);
  st(a: Appointment) { return STATUS[a.status] ?? [a.status, 'acc']; }
  py(a: Appointment) { return a.status === 'cancelled' || a.status === 'no_show' ? ['—', 'acc'] : PAY[a.payment_status ?? 'pending'] ?? ['—', 'acc']; }
  isNow(a: Appointment) {
    const now = new Date(); const s = new Date(a.start_at.slice(0, 16)); const e = new Date(s.getTime() + Number(a.duration_min) * 60000);
    return a.status === 'booked' && s <= now && now < e;
  }
  endTime(a: Appointment) { const s = new Date(a.start_at.slice(0, 16)); return new Date(s.getTime() + Number(a.duration_min) * 60000).toTimeString().slice(0, 5); }
  wa(a: Appointment) {
    const n = (a.phone ?? '').replace(/\D/g, ''); const to = n.length === 10 ? '91' + n : n;
    const msg = `Hi ${a.customer}, a reminder of your ${a.service} today at ${a.start_at.slice(11, 16)} with ${a.therapist}. See you soon!`;
    return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
  }
  async ngOnInit() {
    try { this.rows.set(await this.api.get<Appointment[]>('/appointments', { from: this.today, to: this.today })); } catch { /* dashboard still loads */ }
  }
  async open(a: Appointment) {
    this.sel.set(a); this.plans.set([]); this.visits.set(null);
    try {
      const c = await this.api.get<{ plans?: CustomerPlan[]; appointments?: { status: string }[] }>('/customers/' + a.customer_id);
      this.plans.set(c.plans ?? []); this.visits.set((c.appointments ?? []).filter((x) => x.status === 'completed').length);
    } catch { this.visits.set(0); }
  }
}
