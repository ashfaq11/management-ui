import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';

type Row = (string | number | null)[];

/** Every customer's membership plans: what they bought, used, have left, payment and expiry. */
@Component({
  selector: 'app-members', imports: [FormsModule, RouterLink],
  template: `
  <div class="page-head"><div><h1>Memberships Opted</h1><p>Customers and the membership plans they have opted for.</p></div></div>
  <div class="figs">
    <div class="fig teal"><span>Members</span><b>{{ members() }}</b><small>customers with a plan</small></div>
    <div class="fig blue"><span>Active plans</span><b>{{ active() }}</b><small>balance left, not expired</small></div>
    <div class="fig amber"><span>Payment pending</span><b>{{ pending() }}</b><small>plans not paid yet</small></div>
    <div class="fig red"><span>Expired / used up</span><b>{{ ended() }}</b><small>can be renewed</small></div>
    <div class="fig amber" style="cursor:pointer" (click)="show.set('low')"><span>Low balance</span><b>{{ low() }}</b><small>offer a top-up</small></div>
  </div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div style="flex:2"><label>Search</label><input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Customer, plan…"></div>
      <div style="flex:0 0 200px"><label>Show</label><select [ngModel]="show()" (ngModelChange)="show.set($event)">
        <option value="all">All plans</option><option value="active">Active</option><option value="pending">Payment pending</option>
        <option value="ended">Expired / used up</option><option value="low">Low balance</option></select></div>
      <div style="flex:0 0 auto;display:flex;gap:8px"><button class="p" style="margin:0" (click)="file('pdf')">Download PDF</button>
        <button class="p" style="margin:0;background:var(--gold)" (click)="file('xlsx')">Export to Excel</button></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    <div class="wrap" style="margin-top:10px"><table>
      <tr><th>Customer</th><th>Membership</th><th class="num">Bought</th><th class="num">Used</th><th class="num">Left</th><th class="num">Price</th><th>Payment</th><th>Expires</th><th>Status</th><th></th></tr>
      @for (r of shown(); track $index) {
        <tr><td><b>{{ r[0] }}</b></td><td>{{ r[1] }}</td><td class="num">{{ unit(r, 3) }}</td><td class="num">{{ unit(r, 4) }}</td>
          <td class="num"><b>{{ unit(r, 5) }}</b></td><td class="num">₹{{ n(r[6]).toLocaleString('en-IN') }}</td>
          <td>@if (r[7] === 'Pending') { <span class="badge" style="background:var(--gold-soft);color:var(--gold)">Pending</span> }
            @else { <span class="badge" style="background:var(--ok-soft);color:var(--ok)">Paid · {{ src(r[7]) }}</span> }</td>
          <td>{{ r[8] || 'No expiry' }}</td>
          <td>@switch (state(r)) { @case ('active') { <span class="badge" style="background:var(--acc-soft);color:var(--acc)">Active</span> }
            @case ('expired') { <span class="badge" style="background:var(--bad-soft);color:var(--bad)">Expired</span> }
            @default { <span class="badge mute">Used up</span> } }
            @if (isLow(r)) { <span class="badge" style="background:var(--gold-soft);color:var(--gold);margin-left:4px">Low</span> }</td>
          <td>@if (r[9] && (isLow(r) || state(r) !== 'active')) { <a [href]="offer(r)" target="_blank" rel="noopener"
            style="display:inline-block;padding:3px 9px;border-radius:99px;background:#25d366;color:#fff;font-size:12px;font-weight:600;text-decoration:none">WhatsApp offer</a> }</td></tr>
      } @empty { <tr><td colspan="10">No members match.</td></tr> }
    </table></div>
    <p class="hint">To add or top up a membership, open the customer from <a routerLink="/customers">Customers</a>.</p>
  </div>`,
})
export class Members implements OnInit {
  private api = inject(Api);
  rows = signal<Row[]>([]); err = signal(''); q = signal(''); show = signal('all');
  private today = new Date().toISOString().slice(0, 10);
  n(v: unknown) { return Number(v ?? 0); }
  unit(r: Row, i: number) { return r[2] === 'hours' ? `${this.n(r[i])} hrs` : `₹${this.n(r[i]).toLocaleString('en-IN')}`; }
  src(v: unknown) { return ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank', other: 'Other', paid: 'Paid' } as Record<string, string>)[String(v)] ?? v; }
  state(r: Row) { return r[8] && String(r[8]) < this.today ? 'expired' : this.n(r[5]) > 0 ? 'active' : 'used'; }
  /** Low = active and 2 hours or less left, or 20% or less of what was bought. */
  isLow(r: Row) {
    if (this.state(r) !== 'active') return false;
    const left = this.n(r[5]), bought = this.n(r[3]);
    return (r[2] === 'hours' && left <= 2) || (bought > 0 && left / bought <= 0.2);
  }
  low = computed(() => this.rows().filter((r) => this.isLow(r)).length);
  offer(r: Row) {
    const n = String(r[9] ?? '').replace(/\D/g, ''); const to = n.length === 10 ? '91' + n : n;
    const msg = this.state(r) === 'active'
      ? `Hi ${r[0]}, your ${r[1]} membership has only ${this.unit(r, 5)} left. Top up now and keep enjoying your sessions!`
      : `Hi ${r[0]}, your ${r[1]} membership has ended. Renew today and continue your sessions with us!`;
    return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
  }
  members = computed(() => new Set(this.rows().map((r) => r[0])).size);
  active = computed(() => this.rows().filter((r) => this.state(r) === 'active').length);
  pending = computed(() => this.rows().filter((r) => r[7] === 'Pending').length);
  ended = computed(() => this.rows().filter((r) => this.state(r) !== 'active').length);
  shown = computed(() => {
    const q = this.q().trim().toLowerCase(), f = this.show();
    return this.rows().filter((r) => (!q || `${r[0]} ${r[1]}`.toLowerCase().includes(q))
      && (f === 'all' || (f === 'low' ? this.isLow(r) : f === 'pending' ? r[7] === 'Pending' : f === 'active' ? this.state(r) === 'active' : this.state(r) !== 'active')));
  });
  async file(ext: 'pdf' | 'xlsx') {
    try {
      const res = await this.api.download(`/reports/insights/plans/${ext}?month=${new Date().toISOString().slice(0, 7)}`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = res.name || `members.${ext}`; a.click();
    } catch (e) { this.err.set(errorText(e)); }
  }
  async ngOnInit() {
    try {
      const month = new Date().toISOString().slice(0, 7);
      this.rows.set((await this.api.get<{ rows: Row[] }>('/reports/insights/plans', { month })).rows);
    } catch (e) { this.err.set(errorText(e)); }
  }
}
