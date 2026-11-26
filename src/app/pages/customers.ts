import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Customer } from '../core/models';
import { today } from '../core/util';

type Edit = { name: string; phone: string; email: string; gender: string; dob: string; address: string; notes: string };

@Component({
  selector: 'app-customers', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><label>Search name or phone</label>
    <input [ngModel]="q" (ngModelChange)="q = $event; load()">
    <div class="wrap"><table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Since</th><th></th></tr>
    @for (c of list(); track c.id) {
      <tr><td>{{ c.name }}</td><td>{{ c.phone }}</td><td>{{ c.email }}</td><td>{{ c.created_at.slice(0, 10) }}</td>
        <td><button class="s" (click)="open(c.id)">History</button></td></tr>
    }</table></div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
  </div>
  @if (sel(); as c) {
    <div class="card">@if (form) {
        <h2>Edit customer</h2>
        <div class="grid">
          <div><label>Name *</label><input [(ngModel)]="form.name"></div>
          <div><label>Phone *</label><input [(ngModel)]="form.phone"></div>
          <div><label>Email</label><input [(ngModel)]="form.email"></div>
          <div><label>Gender</label><select [(ngModel)]="form.gender"><option value="">-</option><option>Female</option><option>Male</option><option>Other</option></select></div>
          <div><label>Date of birth</label><input type="date" [(ngModel)]="form.dob"></div>
          <div><label>Address</label><input [(ngModel)]="form.address"></div>
        </div>
        <label>Notes</label><textarea rows="2" [(ngModel)]="form.notes"></textarea>
        <button class="p" (click)="save(c.id)">Save changes</button>
        <button class="s" style="margin-left:8px" (click)="form = null">Cancel</button>
        @if (formErr()) { <div class="msg err">{{ formErr() }}</div> }
      } @else {
        <h2>{{ c.name }} <button class="s" style="margin-left:8px" (click)="startEdit(c)">Edit</button></h2>
        <p>{{ c.phone }} {{ c.email }}<br>{{ c.notes }}</p>
      }
      <h3>Available prepaid balances</h3>
      <div class="grid" style="margin-bottom:12px">
        <div><label>Hours available</label><h2>{{ availableBalance(c, 'hours') | number: '1.2-2' }} hrs</h2></div>
        <div><label>Rupees available</label><h2>Rs {{ availableBalance(c, 'rupees') | number: '1.2-2' }}</h2></div>
      </div>
      <h3>Prepaid plans</h3>
      <div class="wrap"><table><tr><th>Plan</th><th>Unit</th><th>Purchased</th><th>Used</th><th>Balance</th><th>Expires</th><th>Status</th></tr>
        @for (p of (c.plans ?? []); track p.id) {
          <tr><td>{{ p.name }}</td><td>{{ p.plan_type === 'hours' ? 'Hours' : 'Rupees' }}</td>
            <td>{{ p.purchased_amount | number: '1.2-2' }}</td>
            <td>{{ p.used_amount | number: '1.2-2' }}</td>
            <td><strong>{{ p.balance | number: '1.2-2' }}</strong></td><td>{{ p.expires_on || 'Never' }}</td>
            <td>{{ planStatus(p) }}</td></tr>
        } @empty { <tr><td colspan="7">No prepaid plans yet.</td></tr> }
      </table></div>
      @if (auth.isAdmin()) {
      <h4>Add plan / package</h4>
      <div class="grid">
        <div><label>Plan name *</label><input [(ngModel)]="planForm.name" placeholder="e.g. 10 hour package"></div>
        <div><label>Balance type</label><select [(ngModel)]="planForm.plan_type">
          <option value="hours">Hours</option><option value="rupees">Rupees (INR)</option></select></div>
        <div><label>{{ planForm.plan_type === 'hours' ? 'Hours purchased' : 'Rupees purchased' }} *</label>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="planForm.amount"></div>
        <div><label>Expiry date (optional)</label><input type="date" [(ngModel)]="planForm.expires_on"></div>
      </div>
      <label>Plan notes</label><input [(ngModel)]="planForm.notes" placeholder="Optional package details">
      <button class="p" style="margin-top:8px" (click)="addPlan(c.id)">Add customer plan</button>
      @if (planMsg()) { <div class="msg" [class.err]="planErr()">{{ planMsg() }}</div> }
      } @else {
        <small>Only admins can add prepaid plans. Staff can view balances and redeem them when completing appointments.</small>
      }
      <h3>History</h3>
      <div class="grid">
        <div><label>From</label><input type="date" [(ngModel)]="hf.from"></div>
        <div><label>To</label><input type="date" [(ngModel)]="hf.to"></div>
        <div><label>Therapist</label><select [(ngModel)]="hf.therapist">
          <option value="">All</option>
          @for (t of distinct(c, 'therapist'); track t) { <option [value]="t">{{ t }}</option> }</select></div>
        <div><label>Service</label><select [(ngModel)]="hf.service">
          <option value="">All</option>
          @for (x of distinct(c, 'service'); track x) { <option [value]="x">{{ x }}</option> }</select></div>
        <div><label>Status</label><select [(ngModel)]="hf.status">
          <option value="">All</option>
          @for (x of distinct(c, 'status'); track x) { <option [value]="x">{{ x }}</option> }</select></div>
      </div>
      @if (hf.from || hf.to || hf.therapist || hf.service || hf.status) {
        <button class="s" style="margin:10px 0" (click)="clearHist()">Clear filters</button>
      }
      @let rows = history(c);
      <p style="margin:8px 0;color:var(--mut)">{{ rows.length }} visit(s) &middot; completed total Rs {{ spent(rows) | number: '1.2-2' }}</p>
      <div class="wrap"><table><tr><th>When</th><th>Service</th><th>Therapist</th><th class="num">Price</th><th>Status</th><th>Plan deduction</th></tr>
      @for (a of rows; track a.id) {
        <tr><td>{{ a.start_at.replace('T', ' ') }}</td><td>{{ a.service }}</td><td>{{ a.therapist }}</td>
          <td class="num">{{ a.price | number: '1.2-2' }}</td><td><span class="badge">{{ a.status }}</span></td>
          <td>@if (a.plan_deducted != null && a.plan_unit) {
            {{ a.plan_name }} · {{ a.plan_unit === 'hours' ? (a.plan_deducted | number: '1.2-2') + ' hrs' : ('Rs ' + (a.plan_deducted | number: '1.2-2')) }}
            @if (a.plan_reversed_at) { <br><small>Reversed {{ when(a.plan_reversed_at) }}</small> }
          } @else { — }</td></tr>
      } @empty { <tr><td colspan="6">No visits match.</td></tr> }
      </table></div>
    </div>
  }`,
})
export class Customers implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  form: Edit | null = null; formErr = signal('');
  planForm = { name: '', plan_type: 'hours' as 'hours' | 'rupees', amount: 0, expires_on: '', notes: '' };
  planMsg = signal(''); planErr = signal(false);
  q = ''; list = signal<Customer[]>([]); sel = signal<Customer | null>(null); err = signal('');
  hf = { from: '', to: '', therapist: '', service: '', status: '' };
  ngOnInit() { return this.load(); }
  /** The customer's visits, narrowed by the history filters (dates are the spa's local days, both included). */
  history(c: Customer) {
    const f = this.hf;
    return (c.appointments ?? []).filter((a) => {
      const day = a.start_at.slice(0, 10);
      return (!f.from || day >= f.from) && (!f.to || day <= f.to) && (!f.therapist || a.therapist === f.therapist)
        && (!f.service || a.service === f.service) && (!f.status || a.status === f.status);
    });
  }
  distinct(c: Customer, k: 'therapist' | 'service' | 'status') {
    return [...new Set((c.appointments ?? []).map((a) => String(a[k] ?? '')).filter(Boolean))].sort();
  }
  spent(rows: { status: string; price: number }[]) {
    return rows.filter((a) => a.status === 'completed').reduce((s, a) => s + Number(a.price), 0);
  }
  when(v: string): string {
    const d = new Date(v);
    return isNaN(+d) ? v : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  availableBalance(c: Customer, type: 'hours' | 'rupees') {
    const today = today();
    return (c.plans ?? []).filter((p) => p.plan_type === type && Number(p.balance) > 0
      && (!p.expires_on || p.expires_on >= today)).reduce((sum, p) => sum + Number(p.balance), 0);
  }
  planStatus(p: { balance: number; expires_on?: string | null }) {
    if (p.expires_on && p.expires_on < today()) return 'Expired';
    return Number(p.balance) > 0 ? 'Available' : 'Used up';
  }
  clearHist() { this.hf = { from: '', to: '', therapist: '', service: '', status: '' }; }
  async load() {
    try { this.list.set(await this.api.get<Customer[]>('/customers', { q: this.q })); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async open(id: number) {
    this.form = null; this.clearHist();
    try { this.sel.set(await this.api.get<Customer>(`/customers/${id}`)); } catch (e) { this.err.set(errorText(e)); }
  }
  async addPlan(id: number) {
    const p = this.planForm;
    if (!p.name.trim() || !(Number(p.amount) > 0)) {
      this.planErr.set(true); this.planMsg.set('Enter a plan name and an amount greater than zero.'); return;
    }
    try {
      await this.api.post('/customers/' + id + '/plans', {
        name: p.name.trim(), plan_type: p.plan_type, amount: Number(p.amount),
        expires_on: p.expires_on || null, notes: p.notes.trim() || null,
      });
      this.planErr.set(false); this.planMsg.set('Plan added.');
      this.planForm = { name: '', plan_type: 'hours', amount: 0, expires_on: '', notes: '' };
      await this.open(id);
    } catch (e) { this.planErr.set(true); this.planMsg.set(errorText(e)); }
  }
  startEdit(c: Customer) {
    this.formErr.set('');
    this.form = { name: c.name, phone: c.phone, email: c.email ?? '', gender: c.gender ?? '', dob: c.dob ?? '',
      address: c.address ?? '', notes: c.notes ?? '' };
  }
  async save(id: number) {
    if (!this.form) return;
    const f = this.form;
    try {
      await this.api.put(`/customers/${id}`, { name: f.name.trim(), phone: f.phone.trim(), email: f.email || null,
        gender: f.gender || null, dob: f.dob || null, address: f.address || null, notes: f.notes || null });
      await this.open(id); await this.load();
    } catch (e) { this.formErr.set(errorText(e)); }
  }
}
