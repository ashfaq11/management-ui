import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DurationPipe } from '../shared/duration.pipe';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Customer, CustomerPage, Payment, PaymentMethod, PlanPackage } from '../core/models';
import { today } from '../core/util';

type Edit = { name: string; phone: string; email: string; gender: string; dob: string; address: string; notes: string; preferred_payment_method: PaymentMethod | '' };

@Component({
  selector: 'app-customers', imports: [DurationPipe, FormsModule, DecimalPipe],
  styles: [`
    .customer-list{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
    .customer-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;flex-wrap:wrap}
    .profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
    .profile-fact{background:var(--bg);border-radius:10px;padding:12px}
    .profile-fact span{display:block;color:var(--mut);font-size:11px;text-transform:uppercase;font-weight:650}
    .profile-fact strong{display:block;margin-top:4px;word-break:break-word}
  `],
  template: `
  <div class="card"><div class="page-head"><div><h1>Customers</h1><p>Customer records, visit history and prepaid wallets.</p></div>
      <span class="badge">{{ total() }} customers</span></div>
    <div class="customer-list"><div><label>Search name or phone</label>
      <input [ngModel]="q" (ngModelChange)="search($event)" placeholder="Type a name or phone number"></div>
      <button class="s" style="margin-top:22px" (click)="clearSearch()">Clear</button></div>
    <div class="wrap"><table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Since</th><th></th></tr>
    @for (c of list(); track c.id) {
      <tr><td>{{ c.name }}</td><td>{{ c.phone }}</td><td>{{ c.email }}</td><td>{{ c.created_at.slice(0, 10) }}</td>
        <td><button class="s" (click)="open(c.id)">History</button></td></tr>
    } @empty { <tr><td colspan="5">No customers found. Try another name or phone number.</td></tr> }</table></div>
    <div class="customer-pager"><small>Showing {{ list().length ? (page()-1)*pageSize()+1 : 0 }}–{{ (page()-1)*pageSize()+list().length }} of {{ total() }}</small>
      <div style="display:flex;gap:8px"><button class="s" [disabled]="page()<=1" (click)="changePage(-1)">Previous</button>
        <button class="s" [disabled]="page()*pageSize()>=total()" (click)="changePage(1)">Next</button></div></div>
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
          <div><label>Preferred payment method (optional)</label><select [(ngModel)]="form.preferred_payment_method">
            <option value="">No preference</option><option value="cash">Cash</option><option value="upi">UPI</option>
            <option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
        </div>
        <label>Notes</label><textarea rows="2" [(ngModel)]="form.notes"></textarea>
        <button class="p" (click)="save(c.id)">Save changes</button>
        <button class="s" style="margin-left:8px" (click)="form = null">Cancel</button>
        @if (formErr()) { <div class="msg err">{{ formErr() }}</div> }
      } @else {
        <h2>{{ c.name }} <button class="s" style="margin-left:8px" (click)="startEdit(c)">Edit</button></h2>
        <div class="profile-grid">
          <div class="profile-fact"><span>Phone</span><strong>{{ c.phone }}</strong></div>
          <div class="profile-fact"><span>Email</span><strong>{{ c.email || '—' }}</strong></div>
          <div class="profile-fact"><span>Preferred payment</span><strong>{{ methodName(c.preferred_payment_method) }}</strong></div>
          <div class="profile-fact"><span>Customer since</span><strong>{{ c.created_at.slice(0,10) }}</strong></div>
        </div>
        @if (c.notes) { <p>{{ c.notes }}</p> }
      }
      <h3>Available prepaid balances</h3>
      <div class="grid" style="margin-bottom:12px">
        <div><label>Hours available</label><h2>{{ availableBalance(c, 'hours') | number: '1.2-2' }} hrs</h2></div>
        <div><label>Rupees available</label><h2>Rs {{ availableBalance(c, 'rupees') | number: '1.2-2' }}</h2></div>
      </div>
      <h3>Membership plans</h3>
      <div class="wrap"><table><tr><th>Plan</th><th>Unit</th><th>Purchased</th><th>Used</th><th>Balance</th><th>Expires</th><th>Status</th><th>Payment</th>@if (auth.isAdmin()) {<th></th>}</tr>
        @for (p of (c.plans ?? []); track p.id) {
          <tr><td>{{ p.name }}</td><td>{{ p.plan_type === 'hours' ? 'Hours' : 'Rupees' }}</td>
            <td>{{ p.purchased_amount | number: '1.2-2' }}</td>
            <td>{{ p.used_amount | number: '1.2-2' }}</td>
            <td><strong>{{ p.balance | number: '1.2-2' }}</strong></td><td>{{ p.expires_on || 'Never' }}</td>
            <td>{{ planStatus(p) }}</td>
            <td>@if (p.paid_at) { <span class="badge" style="background:var(--ok-soft);color:var(--ok)">Paid</span> }
              @else { <span class="badge" style="background:var(--gold-soft);color:var(--gold)">Pending{{ p.price_paid ? ' · ₹' + (+p.price_paid).toLocaleString('en-IN') : '' }}</span>
                @if (true) { <select style="width:auto;min-height:30px;padding:2px 26px 2px 8px;margin-left:6px" [(ngModel)]="markVia"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank</option><option value="other">Other</option></select><button class="s" style="margin-left:6px" (click)="markPaid(c.id, p.id)">Mark paid</button> } }
              @for (x of p.pending_topups ?? []; track x.id) {
                <div style="margin-top:4px"><span class="badge" style="background:var(--gold-soft);color:var(--gold)">Top-up pending{{ x.price_paid ? ' · ₹' + (+x.price_paid).toLocaleString('en-IN') : '' }}</span>
                @if (true) { <select style="width:auto;min-height:30px;padding:2px 26px 2px 8px;margin-left:6px" [(ngModel)]="markVia"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank</option><option value="other">Other</option></select><button class="s" style="margin-left:6px" (click)="markTopupPaid(c.id, x.id)">Mark paid</button> }</div> }</td>
            @if (auth.isAdmin()) { <td style="white-space:nowrap"><button class="s" (click)="startPlan(p, 'topup')">Top up</button>
              <button class="s" (click)="startPlan(p, 'edit')">Edit</button></td> }</tr>
          @if (planEdit?.id === p.id) {
            <tr class="detail"><td colspan="8">
              @if (planEdit!.mode === 'topup') {
                <div class="row">
                  <div><label>Add {{ p.plan_type === 'hours' ? 'hours' : 'rupees' }} to "{{ p.name }}"</label>
                    <input type="number" min="0.01" step="0.01" [(ngModel)]="planEdit!.amount"></div>
                  <div><label>Cost (Rs, optional)</label>
                    <input type="number" min="0" step="0.01" [(ngModel)]="planEdit!.price_paid" [placeholder]="p.plan_type === 'rupees' ? 'same as amount' : ''"></div>
                  <div style="flex:0 0 auto"><label>Payment</label><select [(ngModel)]="planEdit!.paid"><option value="cash">Paid · Cash</option><option value="upi">Paid · UPI</option><option value="card">Paid · Card</option><option value="bank_transfer">Paid · Bank transfer</option><option value="other">Paid · Other</option><option value="pending">Pending (pay later)</option></select></div>
                  <div><label>Note (optional)</label><input [(ngModel)]="planEdit!.note" placeholder="e.g. paid by UPI"></div>
                </div>
                <small>New balance: {{ (+p.balance + +(planEdit!.amount || 0)) | number: '1.2-2' }}</small>
              } @else {
                <div class="row">
                  <div><label>Plan name</label><input [(ngModel)]="planEdit!.name"></div>
                  <div><label>Expiry date (blank = never)</label><input type="date" [(ngModel)]="planEdit!.expires_on"></div>
                  <div><label>Notes</label><input [(ngModel)]="planEdit!.notes"></div>
                </div>
              }
              <button class="p" (click)="savePlan(c.id)">{{ planEdit!.mode === 'topup' ? 'Add top-up' : 'Save plan' }}</button>
              <button class="s" style="margin-left:8px" (click)="planEdit = null">Cancel</button>
            </td></tr>
          }
        } @empty { <tr><td colspan="8">No membership plans yet.</td></tr> }
      </table></div>
      <h4>Assign a membership</h4>
      @if (packages().length) {
        <div class="row" style="align-items:flex-end">
          <div style="flex:2"><label>Membership plan</label><select [(ngModel)]="assign.package_id">
            <option [ngValue]="null">Choose a membership…</option>
            @for (k of packages(); track k.id) { @if (k.is_active) { <option [ngValue]="k.id">{{ pkgLabel(k) }}</option> } }</select></div>
          <div style="flex:0 0 190px"><label>Payment</label><select [(ngModel)]="assign.paid"><option value="cash">Paid · Cash</option><option value="upi">Paid · UPI</option><option value="card">Paid · Card</option><option value="bank_transfer">Paid · Bank transfer</option><option value="other">Paid · Other</option><option value="pending">Pending (pay later)</option></select></div>
          <div style="flex:0 0 auto"><button class="p" style="margin:0" (click)="assignPlan(c.id)" [disabled]="!assign.package_id">Assign membership</button></div>
        </div>
      } @else { <small>No membership plans yet. {{ auth.isAdmin() ? 'Add them in the Memberships tab.' : 'Ask an admin to add them.' }}</small> }
      @if (planMsg()) { <div class="msg" [class.err]="planErr()">{{ planMsg() }}</div> }
      @if (auth.isAdmin()) {
      <details class="sec"><summary>Custom plan <small>admin only, any amount and price</small></summary><div class="body">
      <div class="grid">
        <div><label>Plan name *</label><input [(ngModel)]="planForm.name" placeholder="e.g. 10 hour package"></div>
        <div><label>Balance type</label><select [(ngModel)]="planForm.plan_type">
          <option value="hours">Hours</option><option value="rupees">Rupees (INR)</option></select></div>
        <div><label>{{ planForm.plan_type === 'hours' ? 'Hours purchased' : 'Rupees purchased' }} *</label>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="planForm.amount"></div>
        <div><label>Plan cost (Rs, optional)</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="planForm.price_paid" [placeholder]="planForm.plan_type === 'rupees' ? 'same as amount' : 'e.g. 9000 for 10 hrs'"></div>
        <div><label>Expiry date (optional)</label><input type="date" [(ngModel)]="planForm.expires_on"></div>
        <div style="flex:0 0 auto"><label>Payment</label><select [(ngModel)]="planForm.paid"><option value="cash">Paid · Cash</option><option value="upi">Paid · UPI</option><option value="card">Paid · Card</option><option value="bank_transfer">Paid · Bank transfer</option><option value="other">Paid · Other</option><option value="pending">Pending (pay later)</option></select></div>
      </div>
      <label>Plan notes</label><input [(ngModel)]="planForm.notes" placeholder="Optional package details">
      <button class="p" style="margin-top:8px" (click)="addPlan(c.id)">Add custom plan</button>
      </div></details>
      }
      <h3>Payment history</h3>
      <div class="wrap"><table><tr><th>Receipt</th><th>Received</th><th>Appointment</th><th>Method</th><th class="num">Received</th><th class="num">Refunded</th><th></th></tr>
        @for (p of (c.payments ?? []); track p.id) {
          <tr><td>SP-{{ p.id.toString().padStart(6,'0') }}</td><td>{{ when(p.received_at) }}</td>
            <td>#{{ p.appointment_id }}</td><td>{{ methodName(p.method) }}</td>
            <td class="num">{{ p.amount | number:'1.2-2' }}</td><td class="num">{{ p.refunded_amount | number:'1.2-2' }}</td>
            <td><button class="s" (click)="receipt(p)">Receipt</button></td></tr>
        } @empty { <tr><td colspan="7">No payment records yet.</td></tr> }
      </table></div>
      <h3>Appointment history</h3>
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
      <div class="wrap"><table><tr><th>When</th><th>Service</th><th>Duration</th><th>Therapist</th><th class="num">Price</th><th>Appointment</th><th>Payment</th><th>Plan deduction</th></tr>
      @for (a of rows; track a.id) {
        <tr><td>{{ a.start_at.replace('T', ' ') }}</td><td>{{ a.service }}</td><td>{{ a.duration_min | dur }}</td><td>{{ a.therapist }}</td>
          <td class="num">{{ a.price | number: '1.2-2' }}</td><td><span class="badge">{{ a.status }}</span></td>
          <td><span class="badge">{{ paymentLabel(a) }}</span></td>
          <td>@if (a.plan_deducted != null && a.plan_unit) {
            {{ a.plan_name }} · {{ a.plan_unit === 'hours' ? (a.plan_deducted | number: '1.2-2') + ' hrs' : ('Rs ' + (a.plan_deducted | number: '1.2-2')) }}
            @if (a.plan_reversed_at) { <br><small>Reversed {{ when(a.plan_reversed_at) }}</small> }
          } @else { — }</td></tr>
      } @empty { <tr><td colspan="8">No visits match.</td></tr> }
      </table></div>
    </div>
  }`,
})
export class Customers implements OnInit {
  /** One select = paid or not + how: 'cash' | 'upi' | ... | 'pending'. */
  markVia = 'cash';
  payOf(v: unknown) { const m = String(v); return { paid: m !== 'pending', payment_method: m === 'pending' ? null : m }; }

  private api = inject(Api);
  auth = inject(Auth);
  form: Edit | null = null; formErr = signal('');
  planForm = { name: '', plan_type: 'hours' as 'hours' | 'rupees', amount: 0, price_paid: null as number | null, paid: 'cash', expires_on: '', notes: '' };
  planMsg = signal(''); planErr = signal(false);
  packages = signal<PlanPackage[]>([]);
  assign = { package_id: null as number | null, paid: 'cash' };
  pkgLabel(k: PlanPackage) {
    const gives = k.plan_type === 'hours' ? `${+k.amount} hrs` : `₹${(+k.amount).toLocaleString('en-IN')} wallet`;
    return `${k.name} · ${gives} · ₹${(+k.price).toLocaleString('en-IN')}${k.validity_days ? ' · ' + k.validity_days + ' days' : ''}`;
  }
  async assignPlan(cid: number) {
    try {
      await this.api.post(`/customers/${cid}/plans/assign`, { package_id: this.assign.package_id, ...this.payOf(this.assign.paid) });
      this.planErr.set(false); this.planMsg.set('Plan assigned.'); this.assign = { package_id: null, paid: 'cash' }; await this.open(cid);
    } catch (x) { this.planErr.set(true); this.planMsg.set(errorText(x)); }
  }
  planEdit: { id: number; mode: 'edit' | 'topup'; plan_type: 'hours' | 'rupees'; name: string; expires_on: string; notes: string; amount: number | null; price_paid: number | null; paid: string; note: string } | null = null;
  startPlan(p: { id: number; name: string; plan_type: 'hours' | 'rupees'; expires_on?: string | null; notes?: string | null }, mode: 'edit' | 'topup') {
    this.planMsg.set('');
    this.planEdit = { id: p.id, mode, plan_type: p.plan_type, name: p.name, expires_on: p.expires_on ?? '', notes: p.notes ?? '', amount: null, price_paid: null, paid: 'cash', note: '' };
  }
  async markPaid(cid: number, pid: number) {
    try { await this.api.put(`/customers/${cid}/plans/${pid}/paid`, { paid: 'cash' }); this.planErr.set(false); this.planMsg.set('Plan marked paid.'); await this.open(cid); }
    catch (x) { this.planErr.set(true); this.planMsg.set(errorText(x)); }
  }
  async markTopupPaid(cid: number, tid: number) {
    try { await this.api.put(`/plan-topups/${tid}/paid`, { paid: 'cash' }); this.planErr.set(false); this.planMsg.set('Top-up marked paid.'); await this.open(cid); }
    catch (x) { this.planErr.set(true); this.planMsg.set(errorText(x)); }
  }
  async savePlan(cid: number) {
    const e = this.planEdit!;
    try {
      if (e.mode === 'topup') {
        if (!(Number(e.amount) > 0)) { this.planErr.set(true); this.planMsg.set('Enter an amount greater than zero.'); return; }
        await this.api.post(`/customers/${cid}/plans/${e.id}/topup`, { amount: Number(e.amount), note: e.note.trim() || null,
          price_paid: e.price_paid === null || String(e.price_paid) === '' ? null : Number(e.price_paid), ...this.payOf(e.paid) });
        this.planMsg.set('Top-up added.');
      } else {
        await this.api.put(`/customers/${cid}/plans/${e.id}`, { name: e.name.trim(), expires_on: e.expires_on || null, notes: e.notes.trim() || null });
        this.planMsg.set('Plan updated.');
      }
      this.planErr.set(false); this.planEdit = null; await this.open(cid);
    } catch (x) { this.planErr.set(true); this.planMsg.set(errorText(x)); }
  }
  q = ''; list = signal<Customer[]>([]); sel = signal<Customer | null>(null); err = signal('');
  page = signal(1); pageSize = signal(25); total = signal(0);
  private searchTimer?: ReturnType<typeof setTimeout>;
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
    const currentDate = today();
    return (c.plans ?? []).filter((p) => p.plan_type === type && Number(p.balance) > 0
      && (!p.expires_on || p.expires_on >= currentDate)).reduce((sum, p) => sum + Number(p.balance), 0);
  }
  planStatus(p: { balance: number; expires_on?: string | null }) {
    if (p.expires_on && p.expires_on < today()) return 'Expired';
    return Number(p.balance) > 0 ? 'Available' : 'Used up';
  }
  clearHist() { this.hf = { from: '', to: '', therapist: '', service: '', status: '' }; }
  async load() {
    try {
      const result=await this.api.get<CustomerPage>('/customers/page',{q:this.q,page:this.page(),page_size:this.pageSize()});
      this.list.set(result.items); this.total.set(result.total); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }
  search(value:string) {
    this.q=value;
    if(this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer=setTimeout(()=>{this.page.set(1);void this.load();},300);
  }
  clearSearch() { this.q=''; this.page.set(1); void this.load(); }
  async changePage(delta:number) { this.page.set(Math.max(1,this.page()+delta)); await this.load(); }
  paymentLabel(a: import('../core/models').Appointment) {
    if(a.payment_status==='prepaid') return a.plan_unit ? 'Plan · '+(a.plan_unit==='hours'?'Hours':'Rupees') : 'Plan redeemed';
    return ({pending:'Pending',partial:'Partially paid',paid:'Paid'} as Record<string,string>)[a.payment_status ?? 'pending'];
  }
  methodName(v?:string|null) {
    if(!v) return 'No preference';
    return ({cash:'Cash',upi:'UPI',card:'Card',bank_transfer:'Bank transfer',other:'Other'} as Record<string,string>)[v]??v;
  }
  async receipt(p:Payment) {
    try {
      const res=await this.api.download('/payments/'+p.id+'/receipt'); const url=URL.createObjectURL(res.blob);
      const a=document.createElement('a');a.href=url;a.download=res.name||('receipt_SP-'+p.id.toString().padStart(6,'0')+'.pdf');a.click();URL.revokeObjectURL(url);
    } catch(e) { this.err.set(errorText(e)); }
  }
  private pkgLoaded = false;
  async open(id: number) {
    if (!this.pkgLoaded) { this.pkgLoaded = true; this.api.get<PlanPackage[]>('/plan-packages').then((p) => this.packages.set(p)).catch(() => (this.pkgLoaded = false)); }
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
        price_paid: p.price_paid === null || String(p.price_paid) === '' ? null : Number(p.price_paid), ...this.payOf(p.paid),
      });
      this.planErr.set(false); this.planMsg.set('Plan added.');
      this.planForm = { name: '', plan_type: 'hours', amount: 0, price_paid: null, paid: 'cash', expires_on: '', notes: '' };
      await this.open(id);
    } catch (e) { this.planErr.set(true); this.planMsg.set(errorText(e)); }
  }
  startEdit(c: Customer) {
    this.formErr.set('');
    this.form = { name: c.name, phone: c.phone, email: c.email ?? '', gender: c.gender ?? '', dob: c.dob ?? '',
      address: c.address ?? '', notes: c.notes ?? '', preferred_payment_method: c.preferred_payment_method ?? '' };
  }
  async save(id: number) {
    if (!this.form) return;
    const f = this.form;
    try {
      await this.api.put(`/customers/${id}`, { name: f.name.trim(), phone: f.phone.trim(), email: f.email || null,
        gender: f.gender || null, dob: f.dob || null, address: f.address || null, notes: f.notes || null,
        preferred_payment_method: f.preferred_payment_method || null });
      await this.open(id); await this.load();
    } catch (e) { this.formErr.set(errorText(e)); }
  }
}
