import { DecimalPipe } from '@angular/common';
import { DtPipe } from '../shared/dt.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { DashboardData } from '../core/models';
import { TodayBookings } from '../shared/today-bookings';

@Component({
  selector: 'app-dashboard',
  imports: [DtPipe, DecimalPipe, RouterLink, TodayBookings],
  styles: [`
    :host{display:block;--dash-radius:18px}
    .welcome{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:18px;
      padding:22px 24px;border-radius:20px;background:linear-gradient(115deg,var(--hdr1),var(--hdr2) 62%,var(--hdr3));color:#fff;margin-bottom:16px}
    .welcome:after{content:"";position:absolute;width:250px;height:250px;border:1px solid rgba(255,255,255,.12);border-radius:50%;right:8%;top:-155px;box-shadow:0 0 0 28px rgba(255,255,255,.035),0 0 0 58px rgba(255,255,255,.025)}
    .welcome-copy{position:relative;z-index:1}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.13em;font-weight:750;color:#a8dcd6}
    .welcome h1{font-size:25px;line-height:1.2;margin:5px 0 5px;letter-spacing:-.035em}.welcome p{margin:0;color:rgba(255,255,255,.72);font-size:13px}
    .welcome-actions{position:relative;z-index:1;display:flex;gap:8px;flex-wrap:wrap}
    .welcome button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;border-radius:10px;padding:9px 13px;font-weight:650}
    .welcome button.primary{background:#fff;color:#123a46;border-color:#fff}
    .welcome button:disabled{opacity:.6}
    .section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0 10px}
    .section-head h2{margin:0;font-size:15px;letter-spacing:-.01em}.section-head p{margin:2px 0 0;font-size:12px;color:var(--mut)}
    .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .metric{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 16px;box-shadow:var(--shadow);min-width:0}
    .metric:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--metric-color,var(--acc))}
    .metric-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .metric-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.055em;color:var(--mut)}
    .metric-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:var(--metric-soft,var(--acc-soft));color:var(--metric-color,var(--acc));font-size:15px}
    .metric strong{display:block;margin-top:9px;font-size:25px;line-height:1.1;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
    .metric small{display:block;margin-top:6px;font-size:11px;color:var(--mut);line-height:1.45}
    .metric.teal{--metric-color:var(--acc);--metric-soft:var(--acc-soft)}
    .metric.blue{--metric-color:var(--blue);--metric-soft:var(--blue-soft)}
    .metric.green{--metric-color:var(--ok);--metric-soft:var(--ok-soft)}
    .metric.amber{--metric-color:var(--gold);--metric-soft:var(--gold-soft)}
    .metric.red{--metric-color:var(--bad);--metric-soft:var(--bad-soft)}
    .metric.violet{--metric-color:var(--violet);--metric-soft:var(--violet-soft)}
    .main-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:14px;margin-top:14px}
    .panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:17px;box-shadow:var(--shadow);min-width:0}
    .panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .panel-head h2{font-size:15px;margin:0}.panel-head p{font-size:12px;color:var(--mut);margin:3px 0 0}
    .periods{display:flex;gap:4px;padding:3px;background:var(--bg);border:1px solid var(--line);border-radius:10px}
    .periods button{border:0;background:transparent;color:var(--mut);border-radius:7px;padding:5px 9px;font-size:11px;font-weight:700}
    .periods button.active{background:var(--card);color:var(--acc);box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .chart-summary{display:flex;align-items:baseline;gap:8px;margin:17px 0 4px}
    .chart-summary strong{font-size:24px;letter-spacing:-.03em}.chart-summary span{font-size:11px;color:var(--mut)}
    .chart{height:164px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;padding:8px 2px 0}
    .chart-col{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px;min-width:0}
    .chart-value{font-size:10px;color:var(--mut);font-variant-numeric:tabular-nums;white-space:nowrap}
    .chart-track{height:112px;width:min(100%,38px);display:flex;align-items:flex-end;background:var(--bg);border-radius:8px 8px 4px 4px;overflow:hidden}
    .chart-bar{width:100%;min-height:3px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,var(--acc-2),var(--acc));transition:height .35s ease}
    .chart-month{font-size:11px;font-weight:650;color:var(--mut)}
    .chart-foot{display:flex;align-items:center;gap:7px;margin-top:12px;color:var(--mut);font-size:11px}
    .chart-foot i{width:8px;height:8px;border-radius:3px;background:var(--acc);display:inline-block}
    .status-list{display:grid;gap:15px;margin-top:20px}
    .status-row{display:grid;grid-template-columns:92px 1fr 28px;align-items:center;gap:10px;font-size:12px}
    .status-name{color:var(--mut);font-weight:600}.status-count{text-align:right;font-weight:750;font-variant-numeric:tabular-nums}
    .status-track{height:8px;background:var(--bg);border-radius:99px;overflow:hidden}
    .status-fill{height:100%;border-radius:99px;min-width:0}
    .status-fill.booked{background:var(--blue)}.status-fill.completed{background:var(--ok)}
    .status-fill.cancelled{background:var(--gold)}.status-fill.no-show{background:var(--bad)}
    .shift-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px;margin-top:13px}
    .shift-card{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid var(--line);border-radius:12px;min-width:0}
    .avatar{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex:none;background:var(--acc-soft);color:var(--acc);font-weight:800}
    .shift-info{min-width:0;flex:1}.shift-info b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .shift-info small{display:block;font-size:11px;margin-top:2px}
    .duty{font-size:10px;font-weight:750;border-radius:99px;padding:4px 8px;background:var(--ok-soft);color:var(--ok);white-space:nowrap}
    .duty.off{background:var(--bg);color:var(--mut)}
    .appointments{display:grid;gap:0;margin-top:8px}
    .appt{display:grid;grid-template-columns:60px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
    .appt:last-child{border-bottom:0}.appt-time{font-size:12px;font-weight:800;color:var(--acc);font-variant-numeric:tabular-nums}
    .appt-main{min-width:0}.appt-main b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .appt-main small{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
    .payment-pill{font-size:10px;font-weight:750;padding:5px 8px;border-radius:99px;background:var(--ok-soft);color:var(--ok);white-space:nowrap}
    .payment-pill.due{background:var(--gold-soft);color:var(--gold)}
    .panel-link{display:inline-flex;align-items:center;gap:6px;margin-top:10px;text-decoration:none;font-size:12px;font-weight:750;color:var(--acc)}
    .panel-link:hover{text-decoration:underline}
    .quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}
    .quick-link{display:flex;align-items:center;gap:9px;min-height:54px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--card);text-decoration:none;color:var(--ink);font-size:12px;font-weight:700;transition:border-color .15s,background .15s,transform .15s}
    .quick-link:hover{border-color:var(--acc);background:var(--acc-soft);transform:translateY(-1px)}
    .quick-icon{width:30px;height:30px;border-radius:9px;background:var(--bg);display:grid;place-items:center;color:var(--acc);font-size:15px;flex:none}
    .empty{padding:22px 10px;text-align:center;color:var(--mut);font-size:12px}
    .empty b{display:block;color:var(--ink);font-size:13px;margin-bottom:3px}
    .error{padding:12px 14px;border:1px solid var(--bad);border-radius:12px;background:var(--bad-soft);color:var(--bad);font-size:13px;margin-bottom:12px}
    .skeleton{height:92px;border-radius:14px;background:linear-gradient(90deg,var(--bg),var(--line),var(--bg));background-size:200% 100%;animation:shimmer 1.3s infinite}
    @keyframes shimmer{to{background-position:-200% 0}}
    @media(max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.main-grid{grid-template-columns:1fr}}
    @media(max-width:560px){.welcome{align-items:flex-start;flex-direction:column;padding:18px}.welcome h1{font-size:22px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .metric{padding:12px}.metric strong{font-size:21px}.metric-label{font-size:10px}.metric-icon{width:27px;height:27px}
      .panel{padding:14px}.chart{gap:5px}.chart-value{font-size:9px}.appt{grid-template-columns:50px minmax(0,1fr)}.payment-pill{grid-column:2;justify-self:start}}
    @media(prefers-reduced-motion:reduce){.chart-bar,.quick-link{transition:none}.skeleton{animation:none}}
  `],
  template: `
    <section class="welcome">
      <div class="welcome-copy">
        <div class="eyebrow">StudioDesk · Business snapshot</div>
        <h1>Good to see you</h1>
        <p>Your spa at a glance. Here’s what’s happening today.</p>
      </div>
      <div class="welcome-actions">
        <button type="button" (click)="load()" [disabled]="loading()">{{ loading() ? 'Refreshing…' : '↻ Refresh' }}</button>
        <a routerLink="/appointments"><button type="button" class="primary">＋ Book appointment</button></a>
      </div>
    </section>

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }

    @if (data(); as d) {
      <div class="section-head">
        <div><h2>Today's performance</h2><p>{{ todayLabel() }} · Live business summary</p></div>
        <a class="panel-link" routerLink="/reports">View detailed reports ↗</a>
      </div>
      <section class="kpis" aria-label="Today's key performance indicators">
        <article class="metric teal"><div class="metric-top"><span class="metric-label">Appointments</span><span class="metric-icon">▦</span></div>
          <strong>{{ d.today.total }}</strong><small>{{ d.today.booked }} booked · {{ d.today.completed }} completed</small></article>
        <article class="metric green"><div class="metric-top"><span class="metric-label">Collections</span><span class="metric-icon">₹</span></div>
          <strong>₹{{ d.collections.net | number:'1.0-0' }}</strong><small>₹{{ d.collections.gross | number:'1.0-0' }} received · ₹{{ d.collections.refunds | number:'1.0-0' }} refunded</small></article>
        <article class="metric blue"><div class="metric-top"><span class="metric-label">Service value</span><span class="metric-icon">✦</span></div>
          <strong>₹{{ d.today.completed_value | number:'1.0-0' }}</strong><small>From {{ d.today.completed }} completed visits</small></article>
        <article class="metric violet"><div class="metric-top"><span class="metric-label">Customers</span><span class="metric-icon">♙</span></div>
          <strong>{{ d.total_customers }}</strong><small>{{ d.customers_today }} new customers today</small></article>
        <article class="metric amber"><div class="metric-top"><span class="metric-label">Team on shift</span><span class="metric-icon">◷</span></div>
          <strong>{{ d.therapists_on_shift }}</strong><small>Therapists scheduled on today's roster</small></article>
        <article class="metric red"><div class="metric-top"><span class="metric-label">Cancelled / no-show</span><span class="metric-icon">!</span></div>
          <strong>{{ d.today.cancelled + d.today.no_show }}</strong><small>{{ d.today.cancelled }} cancelled · {{ d.today.no_show }} no-show</small></article>
      </section>

      <div class="main-grid">
        <section class="panel">
          <div class="panel-head">
            <div><h2>Revenue & business activity</h2><p>Completed service value over time</p></div>
            <div class="periods" role="group" aria-label="Chart period">
              <button type="button" [class.active]="period() === 3" (click)="period.set(3)">3 months</button>
              <button type="button" [class.active]="period() === 6" (click)="period.set(6)">6 months</button>
            </div>
          </div>
          <div class="chart-summary"><strong>₹{{ periodRevenue() | number:'1.0-0' }}</strong><span>total service value · selected period</span></div>
          @if (visibleMonths().length) {
            <div class="chart" role="img" [attr.aria-label]="'Monthly completed service value: ' + chartDescription()">
              @for (m of visibleMonths(); track m.month) {
                <div class="chart-col">
                  <span class="chart-value">{{ compactCurrency(m.revenue) }}</span>
                  <div class="chart-track"><div class="chart-bar" [style.height.%]="barHeight(m.revenue)"></div></div>
                  <span class="chart-month">{{ monthName(m.month) }}</span>
                </div>
              }
            </div>
          } @else { <div class="empty">No monthly performance data available yet.</div> }
          <div class="chart-foot"><i></i> Completed service value <span>·</span> Visits and new customers shown in monthly detail</div>
          @if (visibleMonths().length) {
            <div class="wrap" style="margin-top:12px">
              <table>
                <thead><tr><th>Month</th><th class="num">Visits</th><th class="num">New customers</th><th class="num">Service value</th></tr></thead>
                <tbody>
                  @for (m of visibleMonths(); track m.month) {
                    <tr><td>{{ monthName(m.month) }}</td><td class="num">{{ m.completed }}</td><td class="num">{{ m.new_customers }}</td><td class="num">₹{{ m.revenue | number:'1.0-0' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel">
          <div class="panel-head"><div><h2>Appointment breakdown</h2><p>Today's booking status</p></div></div>
          <div class="status-list">
            <div class="status-row"><span class="status-name">Booked</span><div class="status-track"><div class="status-fill booked" [style.width.%]="statusWidth(d.today.booked,d.today.total)"></div></div><b class="status-count">{{ d.today.booked }}</b></div>
            <div class="status-row"><span class="status-name">Completed</span><div class="status-track"><div class="status-fill completed" [style.width.%]="statusWidth(d.today.completed,d.today.total)"></div></div><b class="status-count">{{ d.today.completed }}</b></div>
            <div class="status-row"><span class="status-name">Cancelled</span><div class="status-track"><div class="status-fill cancelled" [style.width.%]="statusWidth(d.today.cancelled,d.today.total)"></div></div><b class="status-count">{{ d.today.cancelled }}</b></div>
            <div class="status-row"><span class="status-name">No-show</span><div class="status-track"><div class="status-fill no-show" [style.width.%]="statusWidth(d.today.no_show,d.today.total)"></div></div><b class="status-count">{{ d.today.no_show }}</b></div>
          </div>
          <a class="panel-link" routerLink="/appointments">Manage appointments →</a>
        </section>
      </div>

      <section class="panel" style="margin-top:14px">
        <div class="panel-head"><div><h2>Today's team</h2><p>Shift roster and booking allocation</p></div><a class="panel-link" routerLink="/staff">Manage team →</a></div>
        @if (d.today_shifts?.length) {
          <div class="shift-grid">
            @for (x of d.today_shifts; track x.therapist_id) {
              <div class="shift-card">
                <span class="avatar">{{ x.therapist.charAt(0).toUpperCase() }}</span>
                <div class="shift-info"><b>{{ x.therapist }}</b><small>{{ x.shift }} · {{ x.start_time }}–{{ x.end_time }} · {{ x.bookings }} bookings</small></div>
                <span class="duty" [class.off]="!x.on_duty">{{ x.on_duty ? 'On duty' : 'Off now' }}</span>
              </div>
            }
          </div>
        } @else { <div class="empty"><b>No shifts assigned today</b>Set up your team roster under Shifts.</div> }
      </section>

      <app-today-bookings />

      <div class="main-grid">
        <section class="panel">
          <div class="panel-head"><div><h2>Upcoming appointments</h2><p>Remaining appointments scheduled for today</p></div></div>
          @if (d.upcoming.length) {
            <div class="appointments">
              @for (a of d.upcoming; track a.id) {
                <div class="appt">
                  <span class="appt-time">{{ a.start_at | dt: 't' }}</span>
                  <div class="appt-main"><b>{{ a.customer }}</b><small>{{ a.service }} · {{ a.therapist }} · {{ a.duration_min }} min</small></div>
                  <span class="payment-pill" [class.due]="(a.balance_due ?? 0) > 0">{{ (a.balance_due ?? 0) > 0 ? ('Due ₹' + (a.balance_due | number:'1.0-0')) : 'Settled' }}</span>
                </div>
              }
            </div>
          } @else { <div class="empty"><b>You're all caught up</b>No upcoming appointments for the rest of today.</div> }
          <a class="panel-link" routerLink="/appointments">Open appointment calendar →</a>
        </section>

        <section class="panel">
          <div class="panel-head"><div><h2>Quick actions</h2><p>Common tasks, one click away</p></div></div>
          <div class="quick-grid">
            <a class="quick-link" routerLink="/appointments"><span class="quick-icon">＋</span>Book visit</a>
            <a class="quick-link" routerLink="/onboarding"><span class="quick-icon">♙</span>New customer</a>
            <a class="quick-link" routerLink="/customers"><span class="quick-icon">⌕</span>Find customer</a>
            <a class="quick-link" routerLink="/payments"><span class="quick-icon">₹</span>Collect payment</a>
            @if (auth.isAdmin()) {
              <a class="quick-link" routerLink="/reports"><span class="quick-icon">▥</span>Business reports</a>
              <a class="quick-link" routerLink="/staff"><span class="quick-icon">♧</span>Team & shifts</a>
            }
          </div>
        </section>
      </div>
    } @else if (loading()) {
      <section class="kpis" aria-label="Loading dashboard">
        @for (i of [1,2,3,4,5,6]; track i) { <div class="skeleton"></div> }
      </section>
      <section class="panel" style="margin-top:14px"><div class="skeleton" style="height:220px"></div></section>
    } @else if (!error()) {
      <section class="panel"><div class="empty"><b>No dashboard data available</b>Refresh the dashboard or try again later.</div></section>
    }
  `,
})
export class Dashboard implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  data = signal<DashboardData | null>(null);
  loading = signal(false);
  error = signal('');
  period = signal<3 | 6>(6);

  visibleMonths = computed(() => (this.data()?.monthly ?? []).slice(-this.period()));
  periodRevenue = computed(() => this.visibleMonths().reduce((sum, month) => sum + Number(month.revenue || 0), 0));

  ngOnInit() { return this.load(); }

  todayLabel() {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  monthName(value: string) {
    return new Date(value + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
  barHeight(value: number) {
    const max = Math.max(1, ...this.visibleMonths().map(x => Number(x.revenue || 0)));
    return Math.max(2, Number(value || 0) / max * 100);
  }
  compactCurrency(value: number) {
    const amount = Number(value || 0);
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'k';
    return '₹' + amount.toFixed(0);
  }
  statusWidth(value: number, total: number) {
    return total > 0 ? Math.max(0, Math.min(100, Number(value || 0) / total * 100)) : 0;
  }
  chartDescription() {
    return this.visibleMonths().map(m => this.monthName(m.month) + ': ₹' + Number(m.revenue || 0).toFixed(0)).join(', ');
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
