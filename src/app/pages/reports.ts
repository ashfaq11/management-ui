import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DurationPipe } from '../shared/duration.pipe';
import { Insights } from './insights';
import { ClosingSummary } from './closing';
import { Api, errorText } from '../core/api';
import { Customer, IncentiveReport, Service, Summary, Therapist } from '../core/models';
import { thisMonth, today } from '../core/util';

interface PrepaidPlan {
  id: number; customer_id: number; customer: string; phone: string; name: string; plan_type: 'hours' | 'rupees';
  purchased_amount: number; balance: number; used_amount: number; expires_on: string | null; created_at: string;
}
interface PlanRedemption {
  id: number; appointment_id: number; amount: number; unit: 'hours' | 'rupees'; deducted_at: string;
  reversed_at: string | null; plan_id: number; plan_name: string; customer_id: number; customer: string; phone: string;
  start_at: string; duration_min: number; price: number; service: string; therapist: string;
}
interface PlanReport {
  from: string; to: string;
  summary: {
    plans_added: number; topups: number; topped_up_hours: number; topped_up_rupees: number; sold_hours: number; sold_rupees: number; available_hours: number; available_rupees: number;
    deducted_hours: number; deducted_rupees: number; reversed_hours: number; reversed_rupees: number; redemptions: number;
  };
  plans: PrepaidPlan[];
  redemptions: PlanRedemption[];
}

interface ShiftReport {
  from: string; to: string;
  summary: {
    shift_templates: number; assigned_therapists: number; shift_assignments: number;
    appointments: number; completed: number; completed_minutes: number; completed_revenue: number;
  };
  shifts: { id: number; name: string; start_time: string; end_time: string; is_active: boolean }[];
  assignments: {
    shift_id: number; shift_name: string; start_time: string; end_time: string; shift_is_active: boolean;
    day_of_week: number; day_name: string; therapist_id: number; therapist: string;
    appointment_count: number; completed_count: number; completed_minutes: number; completed_revenue: number;
  }[];
}

@Component({
  selector: 'app-reports', imports: [DurationPipe, FormsModule, DecimalPipe, Insights, ClosingSummary],
  template: `
  <nav class="rtabs">@for (g of groups; track g.name) { <button [class.on]="group().name === g.name" (click)="tab = g.tabs[0][0]">{{ g.name }}</button> }</nav>
  <nav class="rsub">@for (t of group().tabs; track t[0]) { <button [class.on]="tab === t[0]" (click)="tab = t[0]">{{ t[1] }}</button> }</nav>
  @if (tab === 'daily' || tab === 'monthly') { <app-closing [mode]="tab" /> }
  @else if (!isLocal()) { <app-insights [kind]="tab" /> } @else {
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
  </div>
  <details class="sec" [open]="filtered()" style="margin:0 0 12px"><summary>More filters <small>therapist, customer, service, payment type</small></summary><div class="row body">
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
    <div><label>Payment type</label>
      <select [ngModel]="method" (ngModelChange)="method = $event; load()">
        <option [ngValue]="null">All payment types</option>
        <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
        <option value="bank_transfer">Bank transfer</option><option value="other">Other</option>
        <option value="plan">Paid from plan</option><option value="unpaid">Unpaid</option>
      </select></div>
  </div></details>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="p" (click)="download('pdf')" [disabled]="busy()">{{ busy() ? 'Preparing...' : 'Download PDF' }}</button>
    <button class="p" (click)="download('xlsx')" [disabled]="busy()" style="background:var(--gold)">Export to Excel</button>
    @if (filtered()) { <button class="s" style="margin-top:14px" (click)="clear()">Clear filters</button> }
  </div>
  @if (err()) { <div class="msg err">{{ err() }}</div> }
  @if (tab === 'revenue' && sum(); as s) {
    <div class="figs">
      <div class="fig teal"><i class="ic">&#8377;</i><span>Service revenue</span><b>{{ inr(s.revenue) }}</b>
        <small>completed services</small></div>
      <div class="fig blue"><i class="ic">&#10003;</i><span>Services done</span><b>{{ s.services_count }}</b>
        <small>{{ s.services_count ? inr(s.revenue / s.services_count) + ' avg' : '&nbsp;' }}</small></div>
      <div class="fig violet"><i class="ic">&#9719;</i><span>Service time</span><b>{{ hrs(s.minutes) }}</b>
        <small>{{ s.services_count ? hrs(s.minutes / s.services_count) + ' per service' : '&nbsp;' }}</small></div>
      @if (!filtered()) { <div class="fig amber"><i class="ic">&#9733;</i><span>New customers</span><b>{{ s.new_customers }}</b>
        <small>joined this period</small></div> }
    </div>

    @if (s.by_method?.length) {
      <div class="breakup">@for (m of s.by_method; track m.method) {
        <span><em>{{ methodLabel(m.method) }}</em> {{ inr(m.services + m.plans) }}</span> }
        <span class="tot"><em>Total</em> {{ inr(sumIn(s.by_method)) }}</span>
        @if (s.paid_by_plan) { <span class="mute"><em>From plans</em> {{ inr(s.paid_by_plan) }}</span> }
      </div>
    }
    @if (s.collected != null && !filtered()) {
      <div class="flow">
        <h4>Money this period</h4>
        <div class="steps">
          <div class="step"><span>Service revenue</span><b>{{ inr(s.revenue) }}</b></div>
          <div class="step minus"><span>&minus; Paid from plans</span><b>{{ inr(-(s.paid_by_plan ?? 0)) }}</b></div>
          <div class="step plus"><span>+ Plan sales</span><b>{{ inr(s.plan_sales ?? 0) }}</b>
            @if (s.plan_dues) { <small style="color:var(--gold)">{{ inr(s.plan_dues) }} pending ({{ s.plan_dues_count }})</small> }</div>
          <div class="step sum"><span>= Money collected</span><b>{{ inr(s.collected) }}</b></div>
          @if (s.profit != null) { <div class="step minus"><span>&minus; Payroll</span><b>{{ inr(-(s.payroll ?? 0)) }}</b></div> }
          <div class="step minus"><span>&minus; Expenses</span><b>{{ inr(-(s.expenses ?? 0)) }}</b></div>
        </div>
        @if (s.profit != null) {
          <div class="net" [class.neg]="s.profit < 0"><span>Net profit</span><b>{{ inr(s.profit) }}</b>
            <small>{{ s.collected ? (s.profit / s.collected * 100 | number: '1.0-0') + '% of money collected' : '' }}</small></div>
          @if (s.collected > 0) {
            <div class="bar">
              <i [style.width.%]="pct(s.payroll ?? 0, s.collected)" style="background:var(--violet)"></i>
              <i [style.width.%]="pct(s.expenses ?? 0, s.collected)" style="background:var(--gold)"></i>
              <i [style.width.%]="pct(s.profit > 0 ? s.profit : 0, s.collected)" style="background:var(--ok)"></i>
            </div>
            <div class="legend"><span><em style="background:var(--violet)"></em>Payroll</span>
              <span><em style="background:var(--gold)"></em>Expenses</span><span><em style="background:var(--ok)"></em>Profit</span></div>
          }
        } @else { <p class="hint" style="margin:10px 0 0">Pick a whole month without filters to see payroll and net profit.</p> }
      </div>
    }
    @if (s.by_method?.length) {
      <h3>Money by payment source</h3>
      <div class="wrap"><table><tr><th>Source</th><th class="num">Services</th><th class="num">Plan sales</th><th class="num">Expenses</th><th class="num">Net</th></tr>
        @for (m of s.by_method; track m.method) {
          <tr><td><b>{{ methodLabel(m.method) }}</b></td><td class="num">{{ inr(m.services) }}</td><td class="num">{{ inr(m.plans) }}</td>
            <td class="num">{{ m.expenses ? inr(-m.expenses) : '—' }}</td><td class="num"><b>{{ inr(m.net) }}</b></td></tr>
        }
        @if (s.paid_by_plan) { <tr><td>Membership plan (no new money)</td><td class="num">{{ inr(s.paid_by_plan) }}</td><td></td><td></td><td class="num">—</td></tr> }
      </table></div>
    }
    @if (s.plan_lines?.length) {
      <h3>Plan sales ({{ s.plan_lines!.length }})</h3>
      <div class="wrap"><table><tr><th>Date</th><th>Customer</th><th>Plan</th><th>Kind</th><th class="num">Amount</th><th class="num">Paid</th></tr>
      @for (x of s.plan_lines; track $index) {
        <tr><td>{{ when(x.at) }}</td><td>{{ x.customer }}</td><td>{{ x.plan }}</td><td>{{ x.kind === 'topup' ? 'Top-up' : 'New' }}</td>
          <td class="num">{{ x.amount | number: '1.0-2' }} {{ x.plan_type === 'hours' ? 'hrs' : 'Rs' }}</td><td class="num">{{ x.price_paid | number: '1.2-2' }}</td></tr>
      }
      <tr><th colspan="5">Total</th><th class="num">{{ s.plan_sales | number: '1.2-2' }}</th></tr></table></div>
      <p class="hint">Money collected = service revenue &minus; services paid from plans + plan sales. Net profit = money collected &minus; payroll &minus; expenses.</p>
    }

    <h3>By service</h3>
    <div class="wrap"><table><tr><th>Service</th><th class="num">Done</th><th class="num">Time</th><th class="num">Revenue</th></tr>
    @for (x of s.by_service; track x.service) {
      <tr><td>{{ x.service }}</td><td class="num">{{ x.count }}</td><td class="num">{{ hrs(x.minutes) }}</td><td class="num">{{ x.revenue | number: '1.2-2' }}</td></tr>
    } @empty { <tr><td colspan="4">No completed services this month</td></tr> }
    </table></div>

    <details class="sec"><summary>By therapist <small>services and amount per therapist</small></summary><div class="body">
    <div class="wrap"><table><tr><th>Therapist / service</th><th class="num">Done</th><th class="num">Time</th><th class="num">Amount</th></tr>
    @for (t of s.by_therapist; track t.therapist_id) {
      <tr style="font-weight:700;background:var(--acc-soft)"><td>{{ t.therapist }}</td><td class="num">{{ t.count }}</td><td class="num">{{ hrs(t.minutes) }}</td>
        <td class="num">{{ t.revenue | number: '1.2-2' }}</td></tr>
      @for (x of t.services; track x.service) {
        <tr><td style="padding-left:20px">{{ x.service }}</td><td class="num">{{ x.count }}</td><td class="num">{{ hrs(x.minutes) }}</td>
          <td class="num">{{ x.revenue | number: '1.2-2' }}</td></tr>
      }
    } @empty { <tr><td colspan="4">No completed services this month</td></tr> }
    </table></div>

    </div></details>
    <details class="sec"><summary>All services done ({{ s.lines.length }}) <small>every visit with customer and therapist</small></summary><div class="body">
    <div class="wrap"><table><tr><th>Date</th><th>Customer</th><th>Service</th><th>Therapist</th><th>Duration</th><th>Paid via</th><th class="num">Price</th></tr>
    @for (x of s.lines; track x.id) {
      <tr><td>{{ when(x.start_at) }}</td><td>{{ x.customer }}</td><td>{{ x.service }}</td><td>{{ x.therapist }}</td><td>{{ x.duration_min | dur }}</td><td>{{ via(x.paid_via) }}</td>
        <td class="num">{{ x.price | number: '1.2-2' }}</td></tr>
    } @empty { <tr><td colspan="7">No completed services this month</td></tr> }
    @if (s.lines.length) {
      <tr><th colspan="4">Total</th><th>{{ s.minutes | dur }}</th><th></th><th class="num">{{ s.revenue | number: '1.2-2' }}</th></tr>
    }
    </table></div></div></details>
  }
  @if (tab === 'musage' && planReport(); as p) {
    <h2 style="margin-top:22px">Membership reporting</h2>
    <p style="color:var(--mut)">Plan sales are for the selected period. Available balances show current, non-expired customer wallets.</p>
    <div class="grid">
      <div><label>Hours sold in period</label><h2>{{ p.summary.sold_hours | number: '1.2-2' }} hrs</h2></div>
      <div><label>Rupees sold in period</label><h2>Rs {{ p.summary.sold_rupees | number: '1.2-2' }}</h2></div>
      <div><label>Hours available now</label><h2>{{ p.summary.available_hours | number: '1.2-2' }} hrs</h2></div>
      <div><label>Rupees available now</label><h2>Rs {{ p.summary.available_rupees | number: '1.2-2' }}</h2></div>
      <div><label>Hours deducted in period</label><h2>{{ p.summary.deducted_hours | number: '1.2-2' }} hrs</h2>
        <small>Reversed: {{ p.summary.reversed_hours | number: '1.2-2' }} hrs</small></div>
      <div><label>Rupees deducted in period</label><h2>Rs {{ p.summary.deducted_rupees | number: '1.2-2' }}</h2>
        <small>Reversed: Rs {{ p.summary.reversed_rupees | number: '1.2-2' }}</small></div>
      <div><label>Memberships sold</label><h2>{{ p.summary.plans_added }}</h2>
        <small>Top-ups: {{ p.summary.topups }} · {{ p.summary.topped_up_hours | number: '1.0-2' }} hrs · Rs {{ p.summary.topped_up_rupees | number: '1.0-2' }}</small></div>
      <div><label>Redemption records</label><h2>{{ p.summary.redemptions }}</h2></div>
    </div>

    <h3>Memberships sold in period</h3>
    <div class="wrap"><table><tr><th>Customer</th><th>Plan</th><th>Type</th><th class="num">Purchased</th><th class="num">Used</th><th class="num">Current balance</th><th>Expiry</th></tr>
      @for (x of p.plans; track x.id) {
        <tr><td>{{ x.customer }}<br><small>{{ x.phone }}</small></td><td>{{ x.name }}</td>
          <td>{{ x.plan_type === 'hours' ? 'Hours' : 'Rupees' }}</td>
          <td class="num">{{ x.plan_type === 'hours' ? (x.purchased_amount | number: '1.2-2') + ' hrs' : ('Rs ' + (x.purchased_amount | number: '1.2-2')) }}</td>
          <td class="num">{{ x.plan_type === 'hours' ? (x.used_amount | number: '1.2-2') + ' hrs' : ('Rs ' + (x.used_amount | number: '1.2-2')) }}</td>
          <td class="num"><strong>{{ x.plan_type === 'hours' ? (x.balance | number: '1.2-2') + ' hrs' : ('Rs ' + (x.balance | number: '1.2-2')) }}</strong></td>
          <td>{{ x.expires_on || 'Never' }}</td></tr>
      } @empty { <tr><td colspan="7">No plans were added in this period.</td></tr> }
    </table></div>

    <h3 style="margin-top:16px">Plan deductions and reversals</h3>
    <div class="wrap"><table><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Therapist</th><th>Plan</th><th class="num">Amount</th><th>Deducted at</th><th>Reversed at</th></tr>
      @for (x of p.redemptions; track x.id) {
        <tr><td>#{{ x.appointment_id }}<br><small>{{ when(x.start_at) }}</small></td>
          <td>{{ x.customer }}<br><small>{{ x.phone }}</small></td><td>{{ x.service }}</td><td>{{ x.therapist }}</td><td>{{ x.plan_name }}</td>
          <td class="num">{{ x.unit === 'hours' ? (x.amount | number: '1.2-2') + ' hrs' : ('Rs ' + (x.amount | number: '1.2-2')) }}</td>
          <td>{{ when(x.deducted_at) }}</td><td>{{ x.reversed_at ? when(x.reversed_at) : '—' }}</td></tr>
      } @empty { <tr><td colspan="8">No plan deductions or reversals in this period.</td></tr> }
    </table></div>
  }

  @if (shiftErr()) { <div class="msg">{{ shiftErr() }}</div> }
  @if (tab === 'shifts' && shiftReport(); as sh) {
    <h2 style="margin-top:24px">Therapist shift reporting</h2>
    <p style="color:var(--mut)">Weekly roster and service activity for {{ sh.from }} to {{ sh.to }}. Shift hours are configured under Therapists &amp; services.</p>
    <div class="grid">
      <div class="kpi"><span>Shift templates</span><b>{{ sh.summary.shift_templates }}</b></div>
      <div class="kpi"><span>Therapists assigned</span><b>{{ sh.summary.assigned_therapists }}</b></div>
      <div class="kpi"><span>Weekly assignments</span><b>{{ sh.summary.shift_assignments }}</b></div>
      <div class="kpi"><span>Appointments in shifts</span><b>{{ sh.summary.appointments }}</b></div>
      <div class="kpi"><span>Completed appointments</span><b>{{ sh.summary.completed }}</b></div>
      <div class="kpi"><span>Completed time</span><b>{{ hrs(sh.summary.completed_minutes) }}</b></div>
      <div class="kpi"><span>Completed service value</span><b>Rs {{ sh.summary.completed_revenue | number: '1.2-2' }}</b></div>
    </div>

    <h3>Shift templates</h3>
    <div class="wrap"><table><tr><th>Shift</th><th>Working hours</th><th>Status</th></tr>
      @for (x of sh.shifts; track x.id) {
        <tr><td><strong>{{ x.name }}</strong></td><td>{{ x.start_time.slice(0,5) }} – {{ x.end_time.slice(0,5) }}</td>
          <td>{{ x.is_active ? 'Active' : 'Inactive' }}</td></tr>
      } @empty { <tr><td colspan="3">No shift templates created yet.</td></tr> }
    </table></div>

    <h3 style="margin-top:16px">Weekly roster and shift performance</h3>
    <div class="wrap"><table><tr><th>Day</th><th>Therapist</th><th>Shift</th><th>Hours</th><th class="num">Appointments</th><th class="num">Completed</th><th class="num">Time delivered</th><th class="num">Value</th></tr>
      @for (x of sh.assignments; track x.shift_id + '-' + x.therapist_id + '-' + x.day_of_week) {
        <tr><td><strong>{{ x.day_name }}</strong></td><td>{{ x.therapist }}</td><td>{{ x.shift_name }}</td>
          <td>{{ x.start_time.slice(0,5) }}–{{ x.end_time.slice(0,5) }}</td>
          <td class="num">{{ x.appointment_count }}</td><td class="num">{{ x.completed_count }}</td>
          <td class="num">{{ hrs(x.completed_minutes) }}</td><td class="num">Rs {{ x.completed_revenue | number: '1.2-2' }}</td></tr>
      } @empty { <tr><td colspan="8">No weekly therapist shifts assigned.</td></tr> }
    </table></div>
  }

  @if (tab === 'incentives' && mode === 'month' && inc(); as i) {
    <h2 style="margin-top:16px">Therapist incentives</h2>
    <div class="wrap"><table><tr><th>Therapist</th><th class="num">Services</th><th class="num">Revenue</th><th class="num">%</th><th class="num">Incentive</th><th class="num">Extra</th></tr>
    @for (x of incRows(i); track x.therapist_id) {
      <tr><td>{{ x.therapist }}</td><td class="num">{{ x.services_count }}</td><td class="num">{{ x.service_revenue | number: '1.2-2' }}</td>
        <td class="num">{{ x.incentive_percent }}</td><td class="num">{{ x.incentive | number: '1.2-2' }}</td><td class="num">{{ x.extra_incentive | number: '1.2-2' }}</td></tr>
    }
    @if (therapistId == null) {
      <tr><th colspan="5">Total incentive (incl. extra)</th><th class="num">{{ i.total_incentive | number: '1.2-2' }}</th></tr>
    }</table></div>
  }</div>
  }`,
})
export class Reports implements OnInit {
  tab = 'revenue';
  groups: { name: string; tabs: [string, string][] }[] = [
    { name: 'Overview', tabs: [['revenue', 'Summary'], ['daily', 'Daily closing'], ['monthly', 'Monthly closing']] },
    { name: 'Sales', tabs: [['payments', 'Payments'], ['dues', 'Pending dues'], ['busy', 'Busy hours']] },
    { name: 'Staff', tabs: [['therapists', 'Performance'], ['utilisation', 'Utilisation'], ['shifts', 'Shifts'], ['incentives', 'Incentives']] },
    { name: 'Clients', tabs: [['customers', 'Top customers'], ['repeat', 'Repeat customers'], ['lapsed', 'Not seen lately'], ['cancellations', 'Cancellations']] },
    { name: 'Memberships', tabs: [['plans', 'All memberships'], ['musage', 'Sold & used'], ['expiring', 'Expiring soon']] },
    { name: 'Expenses', tabs: [['expenses', 'By type']] },
  ];
  isLocal() { return ['revenue', 'musage', 'shifts', 'incentives'].includes(this.tab); }
  group() { return this.groups.find((g) => g.tabs.some((t) => t[0] === this.tab)) ?? this.groups[0]; }
  private api = inject(Api);
  mode: 'month' | 'range' = 'month'; from = thisMonth() + '-01'; to = today();
  month = thisMonth(); therapistId: number | null = null;
  therapists = signal<Therapist[]>([]); customers = signal<Customer[]>([]); services = signal<Service[]>([]);
  customerId: number | null = null; serviceId: number | null = null;
  busy = signal(false); sum = signal<Summary | null>(null); inc = signal<IncentiveReport | null>(null);
  planReport = signal<PlanReport | null>(null); shiftReport = signal<ShiftReport | null>(null);
  shiftErr = signal(''); err = signal('');

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
      const [s, i, p] = await Promise.all([
        this.api.get<Summary>('/reports/summary', this.query()),
        this.api.get<IncentiveReport>('/reports/incentives', { month: this.month }),
        this.api.get<PlanReport>('/reports/plans', { ...this.period(), customer_id: this.customerId ?? undefined })]);
      this.sum.set(s); this.inc.set(i); this.planReport.set(p); this.err.set('');
      try {
        const sh = await this.api.get<ShiftReport>('/reports/shifts', { ...this.period(), therapist_id: this.therapistId ?? undefined });
        this.shiftReport.set(sh); this.shiftErr.set('');
      } catch (e) {
        this.shiftReport.set(null);
        this.shiftErr.set('Shift reporting is unavailable until the backend shift update is deployed. Other reports are still available.');
      }
    } catch (e) { this.err.set(errorText(e)); }
  }

  /** The same report (period + filters) as a PDF, or every completed service as a CSV for Excel. */
  async download(kind: 'pdf' | 'xlsx') {
    this.busy.set(true);
    try {
      const q = Object.entries(this.query()).filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
      const res = await this.api.download(`/reports/summary/${kind}?${q}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.blob);
      a.download = res.name || `report.${kind}`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.err.set(errorText(e)); }
    this.busy.set(false);
  }

  query(): Record<string, string | number | undefined> {
    return { ...this.period(), therapist_id: this.therapistId ?? undefined,
      customer_id: this.customerId ?? undefined, service_id: this.serviceId ?? undefined, method: this.method ?? undefined };
  }
  method: string | null = null;
  filtered() { return this.therapistId != null || this.customerId != null || this.serviceId != null || this.method != null; }
  clear() { this.therapistId = this.customerId = this.serviceId = null; this.method = null; void this.load(); }
  sumIn(rows: { services: number; plans: number }[]) { return rows.reduce((a, m) => a + m.services + m.plans, 0); }
  via(v?: string | null) {
    if (!v) return '—'; if (v === 'plan') return 'Plan'; if (v === 'unpaid') return 'Unpaid';
    return v.split(',').map((m) => this.methodLabel(m)).join(', ');
  }

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
  /** 90 -> '1 h 30 min' */
  hrs(m?: number) { m = Math.round(+(m ?? 0)); const h = Math.floor(m / 60); return (h ? h + ' h ' : '') + (m % 60 || !h ? (m % 60) + ' min' : '').trim(); }
  /** -5900 -> '−₹5,900' (Indian grouping, sign before the symbol). */
  inr(v: number | null | undefined) {
    const n = Number(v ?? 0);
    return (n < 0 ? '\u2212' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: n % 1 ? 2 : 0 });
  }
  pct(part: number, whole: number) { return whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0; }
  methodLabel(m: string) { return ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other' } as Record<string, string>)[m] ?? m; }
  inGroup(keys: string[]) { return keys.includes(this.tab); }
}
