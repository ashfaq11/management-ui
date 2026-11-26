import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { IncentiveReport, Summary, Therapist } from '../core/models';
import { thisMonth } from '../core/util';

@Component({
  selector: 'app-reports', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><div class="row">
    <div><label>Month</label>
      <input type="month" [ngModel]="month" (ngModelChange)="month = $event; load()"></div>
    <div><label>Therapist</label>
      <select [ngModel]="therapistId" (ngModelChange)="therapistId = $event; load()">
        <option [ngValue]="null">All therapists</option>
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
      </select></div>
    <div style="flex:0"><button class="p" (click)="pdf()" [disabled]="busy()">{{ busy() ? 'Preparing...' : 'Download PDF' }}</button></div>
  </div>
  @if (err()) { <div class="msg err">{{ err() }}</div> }
  @if (sum(); as s) {
    <h2>Revenue Rs {{ s.revenue | number: '1.2-2' }} &middot; {{ s.services_count }} services done
      @if (s.therapist_id == null) { &middot; {{ s.new_customers }} new customers }</h2>

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
  @if (inc(); as i) {
    <h2 style="margin-top:16px">Therapist incentives</h2>
    <div class="wrap"><table><tr><th>Therapist</th><th class="num">Services</th><th class="num">Revenue</th><th class="num">%</th><th class="num">Incentive</th></tr>
    @for (x of incRows(i); track x.therapist_id) {
      <tr><td>{{ x.therapist }}</td><td class="num">{{ x.services_count }}</td><td class="num">{{ x.service_revenue | number: '1.2-2' }}</td>
        <td class="num">{{ x.incentive_percent }}</td><td class="num">{{ x.incentive | number: '1.2-2' }}</td></tr>
    }
    @if (therapistId == null) {
      <tr><th colspan="4">Total incentive</th><th class="num">{{ i.total_incentive | number: '1.2-2' }}</th></tr>
    }</table></div>
  }</div>`,
})
export class Reports implements OnInit {
  private api = inject(Api);
  month = thisMonth(); therapistId: number | null = null;
  therapists = signal<Therapist[]>([]);
  busy = signal(false); sum = signal<Summary | null>(null); inc = signal<IncentiveReport | null>(null); err = signal('');

  async ngOnInit() {
    try { this.therapists.set(await this.api.get<Therapist[]>('/therapists')); } catch { /* the filter just stays empty */ }
    return this.load();
  }

  async load() {
    if (!this.month) return;
    try {
      const [s, i] = await Promise.all([
        this.api.get<Summary>('/reports/summary', { month: this.month, therapist_id: this.therapistId ?? undefined }),
        this.api.get<IncentiveReport>('/reports/incentives', { month: this.month })]);
      this.sum.set(s); this.inc.set(i); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }

  /** The same report (month + therapist filter) as a PDF. */
  async pdf() {
    this.busy.set(true);
    try {
      const q = this.therapistId == null ? '' : `&therapist_id=${this.therapistId}`;
      const blob = await this.api.blob(`/reports/summary/pdf?month=${this.month}${q}`);
      const who = this.therapistId == null ? 'all-therapists'
        : (this.therapists().find((t) => t.id === this.therapistId)?.name ?? 'therapist').replace(/[^A-Za-z0-9_-]/g, '_');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `report_${this.month}_${who}.pdf`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.err.set(errorText(e)); }
    this.busy.set(false);
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
