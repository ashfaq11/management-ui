import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Customer } from '../core/models';

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
      <div class="wrap"><table><tr><th>When</th><th>Service</th><th>Therapist</th><th class="num">Price</th><th>Status</th></tr>
      @for (a of rows; track a.id) {
        <tr><td>{{ a.start_at.replace('T', ' ') }}</td><td>{{ a.service }}</td><td>{{ a.therapist }}</td>
          <td class="num">{{ a.price | number: '1.2-2' }}</td><td><span class="badge">{{ a.status }}</span></td></tr>
      } @empty { <tr><td colspan="5">No visits match.</td></tr> }
      </table></div>
    </div>
  }`,
})
export class Customers implements OnInit {
  private api = inject(Api);
  form: Edit | null = null; formErr = signal('');
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
  clearHist() { this.hf = { from: '', to: '', therapist: '', service: '', status: '' }; }
  async load() {
    try { this.list.set(await this.api.get<Customer[]>('/customers', { q: this.q })); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async open(id: number) {
    this.form = null; this.clearHist();
    try { this.sel.set(await this.api.get<Customer>(`/customers/${id}`)); } catch (e) { this.err.set(errorText(e)); }
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
