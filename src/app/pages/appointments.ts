import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Appointment, Customer, STATUSES, Service, Status, Therapist } from '../core/models';
import { today } from '../core/util';

@Component({
  selector: 'app-appointments', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><h2>Book appointment</h2>
    <div class="grid">
      <div><label>Customer</label><select name="c" [(ngModel)]="f.customer_id">
        @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.name }} - {{ c.phone }}</option> }</select></div>
      <div><label>Therapist</label><select [(ngModel)]="f.therapist_id">
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></div>
      <div><label>Service</label><select [(ngModel)]="f.service_id">
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }} (Rs {{ s.price }})</option> }</select></div>
      <div><label>Start</label><input type="datetime-local" [(ngModel)]="f.start_at"></div>
      <div><label>Price override (optional)</label><input type="number" min="0" [(ngModel)]="f.price"></div>
    </div>
    <button class="p" (click)="book()">Book</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
  </div>
  <div class="card">
    <div class="row"><div><label>Day</label><input type="date" [ngModel]="day()" (ngModelChange)="day.set($event); load()"></div></div>
    <div class="wrap">
    @if (rows().length) {
      <table><tr><th>Time</th><th>Customer</th><th>Therapist</th><th>Service</th><th class="num">Price</th><th>Status</th></tr>
      @for (a of rows(); track a.id) {
        <tr><td>{{ a.start_at.slice(11, 16) }}</td><td>{{ a.customer }}<br><small>{{ a.phone }}</small></td>
          <td>{{ a.therapist }}</td><td>{{ a.service }}</td><td class="num">{{ a.price | number: '1.2-2' }}</td>
          <td><select [ngModel]="a.status" (ngModelChange)="setStatus(a, $event)">
            @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select></td></tr>
      }</table>
    } @else { <p>No appointments.</p> }
    </div>
  </div>`,
})
export class Appointments implements OnInit {
  private api = inject(Api);
  statuses = STATUSES;
  customers = signal<Customer[]>([]); therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  rows = signal<Appointment[]>([]); day = signal(today());
  msg = signal(''); isErr = signal(false);
  f: { customer_id?: number; therapist_id?: number; service_id?: number; start_at: string; price: number | null } =
    { start_at: '', price: null };

  async ngOnInit() {
    const [c, t, s] = await Promise.all([this.api.get<Customer[]>('/customers'),
      this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.customers.set(c);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
    this.f.customer_id = c[0]?.id; this.f.therapist_id = this.therapists()[0]?.id; this.f.service_id = this.services()[0]?.id;
    await this.load();
  }

  async load() { this.rows.set(await this.api.get<Appointment[]>('/appointments', { date: this.day() })); }

  async book() {
    try {
      if (!this.f.start_at) throw new Error('Pick a start time');
      const body: Record<string, unknown> = { ...this.f };
      if (body['price'] === null || body['price'] === '') delete body['price'];
      await this.api.post('/appointments', body);
      this.say('Booked'); this.day.set(this.f.start_at.slice(0, 10)); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }

  async setStatus(a: Appointment, status: Status) {
    try { await this.api.patch(`/appointments/${a.id}/status`, { status }); a.status = status; }
    catch (e) { this.say(errorText(e), true); await this.load(); }
  }

  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }
}
