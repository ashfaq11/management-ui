import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Customer, IncentiveReport, Service, Summary, Therapist } from '../core/models';
import { thisMonth, today } from '../core/util';

@Component({
  selector: 'app-reports', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><div class="row">
    <div><label>Period</label>
      <select [ngModel]="mode" (ngModelChange)="mode = $event; load()">
        <option value="month">Month</option><option value="range">Date range</option></select></div>
    @if (mode === 'month') {
      <div><label>Month</label>
        <input type="month" [ngModel]="month" (ngModelChange)="month = $event; load()"></div>
    } @else {
      <div><label>From</label><input type="date" [max]="to" [ngModel]="from" (ngModelChange)="from = $event; load()"></div>
      <div><label>To</label><input type="date" [min]="from" [ngModel]="to" (ngModelChange)="to = $event; load()"></div>
    }
    <div><label>Therapist</label>
      <select [ngModel]="therapistId" (ngModelChange)="therapistId = $event; load()">
        <option [ngValue]="null">All therapists</option>
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
      </select></div>
    <div><label>Customer</label>
      <select [ngModel]="customerId" (ngModelChange)="customerId = $event; load()">
        <option [ngValue]="null">All customers</option>
        @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.name }} - {{ c.phone }}</option> }
      </select></div>
    <div><label>Service</label>
      <select [ngModel]="serviceId" (ngModelChange)="serviceId = $event; load()">
        <option [ngValue]="null">All services</option>
        @for (x of services(); track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }
      </select></div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="p" (click)="download('pdf')" [disabled]="busy()">{{ busy() ? 'Preparing...' : 'Download PDF' }}</button>
    <button class="p" (click)="download('csv')" [disabled]="busy()" style="background:var(--gold)">Export to Excel (CSV)</button>
    @if (filtered()) { <button class="s" style="margin-top:14px" (click)="clear()">Clear filters</button> }
  </div>
  @if (err()) { <div class="msg err">{{ err() }}</div> }
  @if (sum(); as s) {
    <h2>Revenue Rs {{ s.revenue | number: '1.2-2' }} &middot; {{ s.services_count }} services done
      @if (!filtered()) { &middot; {{ s.new_customers }} new customers }</h2>

    <h3>By service</h3>
    <div class="wrap"><table><tr><th>Service</th><th class="num">Done</th><th class="num">Revenue</th></tr>
    @for (x of s.by_service; track x.service) {
      <tr><td>{{ x.service }}</td><td class="num">{{ x.count }}</td><td class="num">{{ x.revenue | number: '1.2-2' }}</td></tr>
    } @empty { <tr><td colspan="3">No completed services this month</td></tr> }
    </table></div>

    <h3 style="margin-top:16px">By therapist</h3>
    <div class="wrap"><table><tr><th>Therapist / service</th><th class="num">Done</th><th class="num">Amount</th></tr>
    @for (t of s.by_therapist; track t.therapist_id) {
      <tr style="font-weight:700;background:var(--acc-soft)"><td>{{ t.therapist }}</td><td class="num">{{ t.count }}</td>
        <td class="num">{{ t.revenue | number: '1.2-2' }}</td></tr>
      @for (x of t.services; track x.service) {
        <tr><td style="padding-left:20px">{{ x.service }}</td><td class="num">{{ x.count }}</td>
          <td class="num">{{ x.revenue | number: '1.2-2' }}</td></tr>
      }
    } @empty { <tr><td colspan="3">No completed services this month</td></tr> }
    </table></div>

    <h3 style="margin-top:16px">All services done ({{ s.lines.length }})</h3>
    <div class="wrap"><table><tr><th>Date</th><th>Customer</th><th>Service</th><th>Therapist</th><th class="num">Price</th></tr>
    @for (x of s.lines; track x.id) {
      <tr><td>{{ when(x.start_at) }}</td><td>{{ x.customer }}</td><td>{{ x.service }}</td><td>{{ x.therapist }}</td>
        <td class="num">{{ x.price | number: '1.2-2' }}</td></tr>
    } @empty { <tr><td colspan="5">No completed services this month</td></tr> }
    @if (s.lines.length) {
      <tr><th colspan="4">Total</th><th class="num">{{ s.revenue | number: '1.2-2' }}</th></tr>
    }
    </table></div>
  }
  @if (mode === 'month' && inc(); as i) {
    <h2 style="margin-top:16px">Therapist incentives</h2>
    <div class="wrap"><table><tr><th>Therapist</th><th class="num">Services</th><th class="num">Revenue</th><th class="num">%</th><th class="num">Incentive</th><th class="num">Extra</th></tr>
    @for (x of incRows(i); track x.therapist_id) {
      <tr><td>{{ x.therapist }}</td><td class="num">{{ x.services_count }}</td><td class="num">{{ x.service_revenue | number: '1.2-2' }}</td>
        <td class="num">{{ x.incentive_percent }}</td><td class="num">{{ x.incentive | number: '1.2-2' }}</td><td class="num">{{ x.extra_incentive | number: '1.2-2' }}</td></tr>
    }
    @if (therapistId == null) {
      <tr><th colspan="5">Total incentive (incl. extra)</th><th class="num">{{ i.total_incentive | number: '1.2-2' }}</th></tr>
    }</table></div>
  }</div>`,
})
export class Reports implements OnInit {
  private api = inject(Api);
  mode: 'month' | 'range' = 'month'; from = thisMonth() + '-01'; to = today();
  month = thisMonth(); therapistId: number | null = null;
  therapists = signal<Therapist[]>([]); customers = signal<Customer[]>([]); services = signal<Service[]>([]);
  customerId: number | null = null; serviceId: number | null = null;
  busy = signal(false); sum = signal<Summary | null>(null); inc = signal<IncentiveReport | null>(null); err = signal('');

  async ngOnInit() {
    try {
      const [t, c, sv] = await Promise.all([this.api.get<Therapist[]>('/therapists'),
        this.api.get<Customer[]>('/customers'), this.api.get<Service[]>('/services')]);
      this.therapists.set(t); this.customers.set(c); this.services.set(sv);
    } catch { /* the filters just stay empty */ }
    return this.load();
  }

  async load() {
    if (this.mode === 'month' ? !this.month : !(this.from && this.to)) return;
    try {
      const [s, i] = await Promise.all([
        this.api.get<Summary>('/reports/summary', this.query()),
        this.api.get<IncentiveReport>('/reports/incentives', { month: this.month })]);
      this.sum.set(s); this.inc.set(i); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }

  /** The same report (period + filters) as a PDF, or every completed service as a CSV for Excel. */
  async download(kind: 'pdf' | 'csv') {
    this.busy.set(true);
    try {
      const q = Object.entries(this.query()).filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
      const blob = await this.api.blob(`/reports/summary/${kind}?${q}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report_${this.mode === 'month' ? this.month : this.from + '_to_' + this.to}.${kind}`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.err.set(errorText(e)); }
    this.busy.set(false);
  }

  query(): Record<string, string | number | undefined> {
    return { ...this.period(), therapist_id: this.therapistId ?? undefined,
      customer_id: this.customerId ?? undefined, service_id: this.serviceId ?? undefined };
  }
  filtered() { return this.therapistId != null || this.customerId != null || this.serviceId != null; }
  clear() { this.therapistId = this.customerId = this.serviceId = null; void this.load(); }

  /** Query for the chosen period: a month, or a from/to range (both days included). */
  period(): Record<string, string> {
    return this.mode === 'month' ? { month: this.month } : { from: this.from, to: this.to };
  }

  incRows(i: IncentiveReport) {
    return this.therapistId == null ? i.therapists : i.therapists.filter((t) => t.therapist_id === this.therapistId);
  }

  /** "2026-11-12T09:00" -> "12 Nov, 09:00" (already the spa's local time). */
  when(v: string): string {
    const d = new Date(v.slice(0, 16) + ':00');
    return isNaN(+d) ? v : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
