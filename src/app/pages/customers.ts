import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Customer, CustomerPage, Payment, PaymentMethod } from '../core/models';
import { today } from '../core/util';

type Edit = { name: string; phone: string; email: string; gender: string; dob: string; address: string; notes: string; preferred_payment_method: PaymentMethod | '' };

@Component({
  selector: 'app-customers', imports: [FormsModule, DecimalPipe],
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
      <h3>Prepaid plans</h3>
      <div class="wrap"><table><tr><th>Plan</th><th>Unit</th><th>Purchased</th><th>Used</th><th>Balance</th><th>Expires</th><th>Status</th>@if (auth.isAdmin()) {<th></th>}</tr>
        @for (p of (c.plans ?? []); track p.id) {
          <tr><td>{{ p.name }}</td><td>{{ p.plan_type === 'hours' ? 'Hours' : 'Rupees' }}</td>
            <td>{{ p.purchased_amount | number: '1.2-2' }}</td>
            <td>{{ p.used_amount | number: '1.2-2' }}</td>
            <td><strong>{{ p.balance | number: '1.2-2' }}</strong></td><td>{{ p.expires_on || 'Never' }}</td>
            <td>{{ planStatus(p) }}</td>
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
        } @empty { <tr><td colspan="8">No prepaid plans yet.</td></tr> }
      </table></div>
      @if (auth.isAdmin()) {
      <h4>Add plan / package</h4>
      <div class="grid">
        <div><label>Plan name *</label><input [(ngModel)]="planForm.name" placeholder="e.g. 10 hour package"></div>
        <div><label>Balance type</label><select [(ngModel)]="planForm.plan_type">
          <option value="hours">Hours</option><option value="rupees">Rupees (INR)</option></select></div>
        <div><label>{{ planForm.plan_type === 'hours' ? 'Hours purchased' : 'Rupees purchased' }} *</label>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="planForm.amount"></div>
        <div><label>Plan cost (Rs, optional)</label>
          <input type="number" min="0" step="0.01" [(ngModel)]="planForm.price_paid" [placeholder]="planForm.plan_type === 'rupees' ? 'same as amount' : 'e.g. 9000 for 10 hrs'"></div>
        <div><label>Expiry date (optional)</label><input type="date" [(ngModel)]="planForm.expires_on"></div>
      </div>
      <label>Plan notes</label><input [(ngModel)]="planForm.notes" placeholder="Optional package details">
      <button class="p" style="margin-top:8px" (click)="addPlan(c.id)">Add customer plan</button>
      @if (planMsg()) { <div class="msg" [class.err]="planErr()">{{ planMsg() }}</div> }
      } @else {
        <small>Only admins can add prepaid plans. Staff can view balances and redeem them when completing appointments.</small>
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
      <div class="wrap"><table><tr><th>When</th><th>Service</th><th>Therapist</th><th class="num">Price</th><th>Appointment</th><th>Payment</th><th>Plan deduction</th></tr>
      @for (a of rows; track a.id) {
        <tr><td>{{ a.start_at.replace('T', ' ') }}</td><td>{{ a.service }}</td><td>{{ a.therapist }}</td>
          <td class="num">{{ a.price | number: '1.2-2' }}</td><td><span class="badge">{{ a.status }}</span></td>
          <td><span class="badge">{{ paymentLabel(a) }}</span></td>
          <td>@if (a.plan_deducted != null && a.plan_unit) {
            {{ a.plan_name }} · {{ a.plan_unit === 'hours' ? (a.plan_deducted | number: '1.2-2') + ' hrs' : ('Rs ' + (a.plan_deducted | number: '1.2-2')) }}
            @if (a.plan_reversed_at) { <br><small>Reversed {{ when(a.plan_reversed_at) }}</small> }
          } @else { — }</td></tr>
      } @empty { <tr><td colspan="7">No visits match.</td></tr> }
      </table></div>
    </div>
  }`,
})
export class Customers implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  form: Edit | null = null; formErr = signal('');
  planForm = { name: '', plan_type: 'hours' as 'hours' | 'rupees', amount: 0, price_paid: null as number | null, expires_on: '', notes: '' };
  planMsg = signal(''); planErr = signal(false);
  planEdit: { id: number; mode: 'edit' | 'topup'; plan_type: 'hours' | 'rupees'; name: string; expires_on: string; notes: string; amount: number | null; price_paid: number | null; note: string } | null = null;
  startPlan(p: { id: number; name: string; plan_type: 'hours' | 'rupees'; expires_on?: string | null; notes?: string | null }, mode: 'edit' | 'topup') {
    this.planMsg.set('');
    this.planEdit = { id: p.id, mode, plan_type: p.plan_type, name: p.name, expires_on: p.expires_on ?? '', notes: p.notes ?? '', amount: null, price_paid: null, note: '' };
  }
  async savePlan(cid: number) {
    const e = this.planEdit!;
    try {
      if (e.mode === 'topup') {
        if (!(Number(e.amount) > 0)) { this.planErr.set(true); this.planMsg.set('Enter an amount greater than zero.'); return; }
        await this.api.post(`/customers/${cid}/plans/${e.id}/topup`, { amount: Number(e.amount), note: e.note.trim() || null,
          price_paid: e.price_paid === null || String(e.price_paid) === '' ? null : Number(e.price_paid) });
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
        price_paid: p.price_paid === null || String(p.price_paid) === '' ? null : Number(p.price_paid),
      });
      this.planErr.set(false); this.planMsg.set('Plan added.');
      this.planForm = { name: '', plan_type: 'hours', amount: 0, price_paid: null, expires_on: '', notes: '' };
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
