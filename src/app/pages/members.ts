import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';

type Row = (string | number | null)[];

/** Every customer's membership plans: what they bought, used, have left, payment and expiry. */
@Component({
  selector: 'app-members', imports: [FormsModule, RouterLink],
  template: `
  <div class="page-head"><div><h1>Members</h1><p>Customers and the membership plans they have opted for.</p></div></div>
  <div class="figs">
    <div class="fig teal"><span>Members</span><b>{{ members() }}</b><small>customers with a plan</small></div>
    <div class="fig blue"><span>Active plans</span><b>{{ active() }}</b><small>balance left, not expired</small></div>
    <div class="fig amber"><span>Payment pending</span><b>{{ pending() }}</b><small>plans not paid yet</small></div>
    <div class="fig red"><span>Expired / used up</span><b>{{ ended() }}</b><small>can be renewed</small></div>
  </div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div style="flex:2"><label>Search</label><input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Customer, plan…"></div>
      <div style="flex:0 0 200px"><label>Show</label><select [ngModel]="show()" (ngModelChange)="show.set($event)">
        <option value="all">All plans</option><option value="active">Active</option><option value="pending">Payment pending</option>
        <option value="ended">Expired / used up</option></select></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    <div class="wrap" style="margin-top:10px"><table>
      <tr><th>Customer</th><th>Membership</th><th class="num">Bought</th><th class="num">Used</th><th class="num">Left</th><th class="num">Price</th><th>Payment</th><th>Expires</th><th>Status</th></tr>
      @for (r of shown(); track $index) {
        <tr><td><b>{{ r[0] }}</b></td><td>{{ r[1] }}</td><td class="num">{{ unit(r, 3) }}</td><td class="num">{{ unit(r, 4) }}</td>
          <td class="num"><b>{{ unit(r, 5) }}</b></td><td class="num">₹{{ n(r[6]).toLocaleString('en-IN') }}</td>
          <td>@if (r[7] === 'Pending') { <span class="badge" style="background:var(--gold-soft);color:var(--gold)">Pending</span> }
            @else { <span class="badge" style="background:var(--ok-soft);color:var(--ok)">Paid · {{ src(r[7]) }}</span> }</td>
          <td>{{ r[8] || 'No expiry' }}</td>
          <td>@switch (state(r)) { @case ('active') { <span class="badge" style="background:var(--acc-soft);color:var(--acc)">Active</span> }
            @case ('expired') { <span class="badge" style="background:var(--bad-soft);color:var(--bad)">Expired</span> }
            @default { <span class="badge mute">Used up</span> } }</td></tr>
      } @empty { <tr><td colspan="9">No members match.</td></tr> }
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
  members = computed(() => new Set(this.rows().map((r) => r[0])).size);
  active = computed(() => this.rows().filter((r) => this.state(r) === 'active').length);
  pending = computed(() => this.rows().filter((r) => r[7] === 'Pending').length);
  ended = computed(() => this.rows().filter((r) => this.state(r) !== 'active').length);
  shown = computed(() => {
    const q = this.q().trim().toLowerCase(), f = this.show();
    return this.rows().filter((r) => (!q || `${r[0]} ${r[1]}`.toLowerCase().includes(q))
      && (f === 'all' || (f === 'pending' ? r[7] === 'Pending' : f === 'active' ? this.state(r) === 'active' : this.state(r) !== 'active')));
  });
  async ngOnInit() {
    try {
      const month = new Date().toISOString().slice(0, 7);
      this.rows.set((await this.api.get<{ rows: Row[] }>('/reports/insights/plans', { month })).rows);
    } catch (e) { this.err.set(errorText(e)); }
  }
}
