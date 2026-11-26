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
      <div class="wrap"><table><tr><th>When</th><th>Service</th><th>Therapist</th><th class="num">Price</th><th>Status</th></tr>
      @for (a of c.appointments; track a.id) {
        <tr><td>{{ a.start_at.replace('T', ' ') }}</td><td>{{ a.service }}</td><td>{{ a.therapist }}</td>
          <td class="num">{{ a.price | number: '1.2-2' }}</td><td><span class="badge">{{ a.status }}</span></td></tr>
      }</table></div>
    </div>
  }`,
})
export class Customers implements OnInit {
  private api = inject(Api);
  form: Edit | null = null; formErr = signal('');
  q = ''; list = signal<Customer[]>([]); sel = signal<Customer | null>(null); err = signal('');
  ngOnInit() { return this.load(); }
  async load() {
    try { this.list.set(await this.api.get<Customer[]>('/customers', { q: this.q })); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async open(id: number) {
    this.form = null;
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
