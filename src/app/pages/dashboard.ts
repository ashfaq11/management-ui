import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { DashboardData } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, RouterLink],
  styles: [`
    .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
    .metric{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow)}
    .metric span{display:block;color:var(--mut);font-size:12px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}
    .metric strong{display:block;font-size:25px;line-height:1.25;margin-top:8px;font-variant-numeric:tabular-nums}
    .metric small{display:block;margin-top:5px}
    .dash-columns{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(250px,1fr);gap:14px}
    .quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .quick a{display:flex;align-items:center;justify-content:center;min-height:48px;padding:10px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-weight:600;background:var(--card)}
    .quick a:hover{border-color:var(--acc);background:var(--acc-soft)}
    .appt{display:grid;grid-template-columns:74px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .appt:last-child{border-bottom:0}.time{font-weight:750;color:var(--acc);font-variant-numeric:tabular-nums}
    .trend{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;margin-top:12px}
    .trend-item{text-align:center;min-width:0}.bar-track{height:112px;background:var(--bg);border-radius:8px 8px 3px 3px;display:flex;align-items:end;overflow:hidden}
    .bar{width:100%;background:linear-gradient(180deg,var(--acc-2),var(--acc));border-radius:7px 7px 0 0;min-height:2px}
    .trend-item b{display:block;font-size:12px;margin-top:6px}.trend-item small{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .appt small{display:block}.pill{font-size:11px;border-radius:99px;padding:3px 8px;background:var(--acc-soft);color:var(--acc);font-weight:650}
    @media(max-width:760px){.dash-columns{grid-template-columns:1fr}.appt{grid-template-columns:62px 1fr}.appt .pill{grid-column:2;justify-self:start}}
  `],
  template: `
  <div class="page-head">
    <div><h1>Business overview</h1><p>Today's activity and what needs attention.</p></div>
    <button class="s" (click)="load()" [disabled]="loading()">{{ loading() ? 'Refreshing...' : 'Refresh' }}</button>
  </div>
  @if (error()) { <div class="msg err">{{ error() }}</div> }
  @if (data(); as d) {
    <div class="dash-grid">
      <div class="metric"><span>Today's bookings</span><strong>{{ d.today.total }}</strong><small>{{ d.today.booked }} booked · {{ d.today.completed }} completed</small></div>
      <div class="metric"><span>Completed service value</span><strong>₹{{ d.today.completed_value | number:'1.0-0' }}</strong><small>{{ d.today.completed }} completed visits</small></div>
      <div class="metric"><span>Collections today</span><strong>₹{{ d.collections.net | number:'1.0-0' }}</strong><small>₹{{ d.collections.gross | number:'1.0-0' }} received · ₹{{ d.collections.refunds | number:'1.0-0' }} refunded</small></div>
      <div class="metric"><span>Customers</span><strong>{{ d.total_customers }}</strong><small>{{ d.customers_today }} new today</small></div>
      <div class="metric"><span>Therapists on shift now</span><strong>{{ d.therapists_on_shift }}</strong><small>Based on today's active roster</small></div>
      <div class="metric"><span>Cancelled / no-show</span><strong>{{ d.today.cancelled + d.today.no_show }}</strong><small>{{ d.today.cancelled }} cancelled · {{ d.today.no_show }} no-show</small></div>
    </div>
    <section class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>Six-month performance</h2><small>Completed service value and new customers</small></div>
      <div class="trend">
        @for (m of d.monthly; track m.month) {
          <div class="trend-item"><div class="bar-track"><div class="bar" [style.height.%]="barHeight(m.revenue,d.monthly)"></div></div>
            <b>₹{{ m.revenue | number:'1.0-0' }}</b><small>{{ monthName(m.month) }}</small>
            <small>{{ m.completed }} visits · {{ m.new_customers }} new</small></div>
        }
      </div>
    </section>
    <div class="dash-columns">
      <section class="card">
        <h2>Upcoming today</h2>
        @for (a of d.upcoming; track a.id) {
          <div class="appt">
            <div class="time">{{ a.start_at.slice(11,16) }}</div>
            <div><strong>{{ a.customer }}</strong><small>{{ a.service }} · {{ a.therapist }} · {{ a.duration_min }} min</small></div>
            <span class="pill">{{ (a.balance_due ?? 0) > 0 ? ('Due ₹' + (a.balance_due | number:'1.0-0')) : 'Settled' }}</span>
          </div>
        } @empty { <p class="hint">No upcoming appointments for the rest of today.</p> }
        <a routerLink="/appointments">Open appointment calendar →</a>
      </section>
      <section class="card">
        <h2>Quick actions</h2>
        <div class="quick">
          <a routerLink="/appointments">＋ Book visit</a>
          <a routerLink="/onboarding">＋ New customer</a>
          <a routerLink="/customers">Find customer</a>
          <a routerLink="/payments">Collect payment</a>
          @if (auth.isAdmin()) { <a routerLink="/reports">Business reports</a><a routerLink="/staff">Team &amp; shifts</a> }
        </div>
      </section>
    </div>
  } @else if (!loading() && !error()) { <div class="card"><p class="hint">No dashboard data available.</p></div> }
  `,
})
export class Dashboard implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  data = signal<DashboardData | null>(null);
  loading = signal(false);
  error = signal('');

  ngOnInit() { return this.load(); }

  monthName(value:string) { return new Date(value+'-01T12:00:00').toLocaleDateString('en-IN',{month:'short'}); }
  barHeight(value:number, rows:DashboardData['monthly']) {
    const max=Math.max(1,...rows.map(x=>Number(x.revenue)));
    return Math.max(2,Number(value)/max*100);
  }

  async load() {
    this.loading.set(true);
    try {
      this.data.set(await this.api.get<DashboardData>('/dashboard'));
      this.error.set('');
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }
}
