import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Deductions } from './deductions';
import { Api, errorText } from '../core/api';
import { IncentiveReport } from '../core/models';
import { thisMonth } from '../core/util';

@Component({
  selector: 'app-payroll', imports: [Deductions, FormsModule, DecimalPipe],
  template: `
  <div class="card"><div class="row"><div><label>Month</label>
    <input type="month" [ngModel]="month" (ngModelChange)="month = $event; load()"></div></div>
  <div class="wrap">
  @if (rep(); as i) {
    <table><tr><th>Therapist</th><th class="num">Fixed</th><th class="num">Incentive</th><th class="num">Extra</th><th class="num">Deductions</th><th class="num">Net pay</th><th></th></tr>
    @for (x of i.therapists; track x.therapist_id) {
      <tr><td>{{ x.therapist }}</td><td class="num">{{ x.fixed_salary | number: '1.2-2' }}</td><td class="num">{{ x.incentive | number: '1.2-2' }}</td>
        <td class="num">{{ x.extra_incentive | number: '1.2-2' }}</td>
        <td class="num">{{ x.deductions_total ? '- ' + (x.deductions_total | number: '1.2-2') : '—' }}</td>
        <td class="num"><b>{{ x.net_pay | number: '1.2-2' }}</b></td>
        <td><button class="s" (click)="pdf(x.therapist_id, x.therapist)">Payslip PDF</button></td></tr>
    }
    <tr><th colspan="5">Total payroll</th><th class="num">{{ i.total_payroll | number: '1.2-2' }}</th><th></th></tr></table>
  }</div>
  @if (err()) { <div class="msg err">{{ err() }}</div> }</div>
  @if (rep(); as i) { <app-deductions [month]="month" [therapists]="i.therapists" (changed)="load()" /> }`,
})
export class Payroll implements OnInit {
  private api = inject(Api);
  month = thisMonth(); rep = signal<IncentiveReport | null>(null); err = signal('');
  ngOnInit() { return this.load(); }

  async load() {
    if (!this.month) return;
    try { this.rep.set(await this.api.get<IncentiveReport>('/reports/incentives', { month: this.month })); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }

  async pdf(id: number, name: string) {
    try {
      const res = await this.api.download(`/payroll/${id}/${this.month}/pdf`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.blob);
      a.download = res.name || `payslip_${name.replace(/[^A-Za-z0-9_-]/g, '_')}_${this.month}.pdf`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.err.set(errorText(e)); }
  }
}
