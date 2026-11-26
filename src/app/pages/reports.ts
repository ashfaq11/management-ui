import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { IncentiveReport, Summary } from '../core/models';
import { thisMonth } from '../core/util';

@Component({
  selector: 'app-reports', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><div class="row"><div><label>Month</label>
    <input type="month" [ngModel]="month" (ngModelChange)="month = $event; load()"></div></div>
  @if (err()) { <div class="msg err">{{ err() }}</div> }
  @if (sum(); as s) {
    <h2>Revenue Rs {{ s.revenue | number: '1.2-2' }} &middot; {{ s.new_customers }} new customers</h2>
    <div class="wrap"><table><tr><th>Service</th><th class="num">Count</th><th class="num">Revenue</th></tr>
    @for (x of s.by_service; track x.service) {
      <tr><td>{{ x.service }}</td><td class="num">{{ x.count }}</td><td class="num">{{ x.revenue | number: '1.2-2' }}</td></tr>
    }</table></div>
  }
  @if (inc(); as i) {
    <h2 style="margin-top:16px">Therapist incentives</h2>
    <div class="wrap"><table><tr><th>Therapist</th><th class="num">Services</th><th class="num">Revenue</th><th class="num">%</th><th class="num">Incentive</th></tr>
    @for (x of i.therapists; track x.therapist_id) {
      <tr><td>{{ x.therapist }}</td><td class="num">{{ x.services_count }}</td><td class="num">{{ x.service_revenue | number: '1.2-2' }}</td>
        <td class="num">{{ x.incentive_percent }}</td><td class="num">{{ x.incentive | number: '1.2-2' }}</td></tr>
    }
    <tr><th colspan="4">Total incentive</th><th class="num">{{ i.total_incentive | number: '1.2-2' }}</th></tr></table></div>
  }</div>`,
})
export class Reports implements OnInit {
  private api = inject(Api);
  month = thisMonth(); sum = signal<Summary | null>(null); inc = signal<IncentiveReport | null>(null); err = signal('');
  ngOnInit() { return this.load(); }
  async load() {
    if (!this.month) return;
    try {
      const [s, i] = await Promise.all([this.api.get<Summary>('/reports/summary', { month: this.month }),
        this.api.get<IncentiveReport>('/reports/incentives', { month: this.month })]);
      this.sum.set(s); this.inc.set(i); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }
}
