import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';

interface Closing {
  title: string; period: string; rows: (string | number)[][]; counts: { done: number; open: number; cancelled: number; no_show: number; total: number };
  by_method: { method: string; services: number; plans: number }[]; revenue: number; collected: number | null; expenses: number;
  profit: number | null; new_customers: number; memberships_sold: number; plan_sales: number; paid_by_plan: number; payroll: number | null;
}
const M: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other' };

/** Daily or monthly closing: money in by source, bookings, memberships, expenses and (monthly) profit. */
@Component({
  selector: 'app-closing', imports: [FormsModule],
  template: `
  <div class="card">
    <div class="row" style="align-items:flex-end">
      @if (mode === 'daily') { <div style="flex:0 0 180px"><label>Day</label><input type="date" [(ngModel)]="day" (change)="load()"></div> }
      @else { <div style="flex:0 0 180px"><label>Month</label><input type="month" [(ngModel)]="month" (change)="load()"></div> }
      <div style="flex:0 0 auto;display:flex;gap:8px"><button class="p" style="margin:0" (click)="file('pdf')">Download PDF</button>
        <button class="p" style="margin:0;background:var(--gold)" (click)="file('xlsx')">Export to Excel</button></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    @if (d(); as d) {
      <h2 style="margin-top:12px">{{ d.title }} · {{ d.period }}</h2>
      <div class="figs">
        <div class="fig green"><span>Money received</span><b>{{ inr(received(d)) }}</b><small>cash, UPI, card…</small></div>
        <div class="fig blue"><span>Services done</span><b>{{ d.counts.done }}</b><small>{{ inr(d.revenue) }} service value</small></div>
        <div class="fig amber"><span>No-shows / cancelled</span><b>{{ d.counts.no_show }} / {{ d.counts.cancelled }}</b><small>{{ d.counts.open }} still booked</small></div>
        <div class="fig red"><span>Expenses</span><b>{{ inr(d.expenses) }}</b><small>&nbsp;</small></div>
        @if (d.profit !== null) { <div class="fig" [class.green]="d.profit >= 0" [class.red]="d.profit < 0"><span>Net profit</span><b>{{ inr(d.profit) }}</b><small>after payroll and expenses</small></div> }
      </div>
      <div class="breakup">@for (m of d.by_method; track m.method) { <span><em>{{ label(m.method) }}</em> {{ inr(m.services + m.plans) }}</span> }
        <span class="tot"><em>Total</em> {{ inr(received(d)) }}</span></div>
      <div class="wrap"><table>
        @for (r of d.rows; track $index) {
          @if (r[1] === '') { <tr><th colspan="2" style="background:var(--bg);color:var(--ink)">{{ r[0] }}</th></tr> }
          @else { <tr><td>{{ r[0] }}</td><td class="num">{{ fmt(r[0], r[1]) }}</td></tr> }
        }
      </table></div>
    }
  </div>`,
})
export class ClosingSummary implements OnChanges {
  @Input() mode: 'daily' | 'monthly' = 'daily';
  private api = inject(Api);
  d = signal<Closing | null>(null); err = signal('');
  day = new Date().toISOString().slice(0, 10); month = new Date().toISOString().slice(0, 7);
  ngOnChanges() { void this.load(); }
  private q() { return this.mode === 'daily' ? { day: this.day } : { month: this.month }; }
  label(m: string) { return M[m] ?? m; }
  received(d: Closing) { return d.by_method.reduce((a, m) => a + m.services + m.plans, 0); }
  inr(v: number | null | undefined) { const n = Number(v ?? 0); return (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  fmt(k: unknown, v: unknown) {
    const key = String(k);
    if (typeof v !== 'number') return v;
    return /Completed|booked|Cancelled|No-shows|New customers|Memberships sold|hours/.test(key) ? v.toLocaleString('en-IN') : this.inr(v);
  }
  async load() {
    try { this.d.set(await this.api.get<Closing>('/reports/closing', this.q())); this.err.set(''); } catch (e) { this.err.set(errorText(e)); }
  }
  async file(ext: 'pdf' | 'xlsx') {
    try {
      const qs = this.mode === 'daily' ? `day=${this.day}` : `month=${this.month}`;
      const res = await this.api.download(`/reports/closing/${ext}?${qs}`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = res.name || `closing.${ext}`; a.click();
    } catch (e) { this.err.set(errorText(e)); }
  }
}
