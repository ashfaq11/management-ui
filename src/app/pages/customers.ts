import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Customer } from '../core/models';

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
    <div class="card"><h2>{{ c.name }}</h2>
      <p>{{ c.phone }} {{ c.email }}<br>{{ c.notes }}</p>
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
  q = ''; list = signal<Customer[]>([]); sel = signal<Customer | null>(null); err = signal('');
  ngOnInit() { return this.load(); }
  async load() {
    try { this.list.set(await this.api.get<Customer[]>('/customers', { q: this.q })); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async open(id: number) {
    try { this.sel.set(await this.api.get<Customer>(`/customers/${id}`)); } catch (e) { this.err.set(errorText(e)); }
  }
}
