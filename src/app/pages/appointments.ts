import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Appointment, Customer, STATUSES, Service, Status, Therapist } from '../core/models';
import { WhenPicker } from '../shared/when-picker';
import { today } from '../core/util';

@Component({
  selector: 'app-appointments', imports: [FormsModule, DecimalPipe, WhenPicker],
  template: `
  <div class="card"><h2>{{ editId() ? "Edit appointment #" + editId() : "Book appointment" }}</h2>
    <div class="grid">
      <div><label>Customer</label><select name="c" [(ngModel)]="f.customer_id">
        @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.name }} - {{ c.phone }}</option> }</select></div>
      <div><label>Therapist</label><select [(ngModel)]="f.therapist_id">
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></div>
      <div><label>Service</label><select [(ngModel)]="f.service_id">
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }} (Rs {{ s.price }})</option> }</select></div>
      <div><label>{{ editId() ? "Price (blank = keep, or list price if service changed)" : "Price override (optional)" }}</label><input type="number" min="0" [(ngModel)]="f.price"></div>
      <div><label>Duration (min) &middot; blank = {{ editId() ? "keep" : "service default " + serviceMinutes() }}</label>
        <input type="number" min="5" max="720" step="5" [(ngModel)]="f.duration_min"
          [placeholder]="'' + serviceMinutes()">
        <div class="chips">@for (m of [30, 60, 90, 120]; track m) {<button type="button" [class.on]="f.duration_min === m" (click)="f.duration_min = m">{{ m }} min</button>}</div></div>
      <div><label>Notes</label><input [(ngModel)]="f.notes"></div>
    </div>
    <app-when-picker [(value)]="f.start_at" [therapistId]="f.therapist_id" [durationMin]="duration()"
      [excludeId]="editId()" />
    <button class="p" style="margin-top:10px" (click)="save()">{{ editId() ? "Save changes" : "Book" }}</button>
    @if (editId()) { <button class="s" style="margin-left:8px" (click)="cancelEdit()">Cancel</button> }
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
  </div>
  <div class="card">
    <div class="row"><div><label>Day</label>
      <div style="display:flex;gap:4px">
        <button class="s" (click)="moveDay(-1)" aria-label="Previous day">&lsaquo;</button>
        <input type="date" [ngModel]="day()" (ngModelChange)="day.set($event); load()" style="flex:1">
        <button class="s" (click)="moveDay(1)" aria-label="Next day">&rsaquo;</button>
        <button class="s" (click)="day.set(todayStr()); load()">Today</button>
      </div></div></div>
    <div class="wrap">
    @if (rows().length) {
      <table><tr><th>Time</th><th>Customer</th><th>Therapist</th><th>Service</th><th class="num">Price</th><th>Status</th><th></th></tr>
      @for (a of rows(); track a.id) {
        <tr><td>{{ a.start_at.slice(11, 16) }}</td><td>{{ a.customer }}<br><small>{{ a.phone }}</small></td>
          <td>{{ a.therapist }}</td><td>{{ a.service }}</td><td class="num">{{ a.price | number: '1.2-2' }}</td>
          <td><select [ngModel]="a.status" (ngModelChange)="setStatus(a, $event)">
            @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select></td>
          <td>@if (a.status === 'booked') { <button class="s" (click)="edit(a)">Edit</button> }</td></tr>
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
  editId = signal<number | null>(null);
  f: { customer_id?: number; therapist_id?: number; service_id?: number; start_at: string; price: number | null; duration_min: number | null; notes: string | null } =
    { start_at: '', price: null, duration_min: null, notes: null };

  async ngOnInit() {
    const [c, t, s] = await Promise.all([this.api.get<Customer[]>('/customers'),
      this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.customers.set(c);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
    this.f.customer_id = c[0]?.id; this.f.therapist_id = this.therapists()[0]?.id; this.f.service_id = this.services()[0]?.id;
    await this.load();
  }

  todayStr = today;
  /** The chosen service's length, so the free-time buttons fit it. */
  serviceMinutes() { return this.services().find((x) => x.id === this.f.service_id)?.duration_min ?? 60; }
  /** The length the free-time buttons must fit: the override if given, else the service's. */
  duration() { return this.f.duration_min || this.serviceMinutes(); }
  moveDay(n: number) {
    const d = new Date(this.day() + 'T12:00:00'); d.setDate(d.getDate() + n);
    this.day.set(d.toISOString().slice(0, 10)); void this.load();
  }

  async load() { this.rows.set(await this.api.get<Appointment[]>('/appointments', { date: this.day() })); }

  async save() {
    try {
      if (!this.f.start_at) throw new Error('Pick a date and a time');
      const body: Record<string, unknown> = { ...this.f };
      if (body['price'] === null || body['price'] === '') delete body['price'];
      if (!body['duration_min']) delete body['duration_min'];
      if (!body['notes']) body['notes'] = null;
      const id = this.editId();
      if (id) await this.api.put(`/appointments/${id}`, body); else await this.api.post('/appointments', body);
      this.say(id ? 'Saved' : 'Booked'); this.day.set(this.f.start_at.slice(0, 10));
      this.cancelEdit(); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }

  edit(a: Appointment) {
    this.editId.set(a.id);
    this.f = { customer_id: a.customer_id, therapist_id: a.therapist_id, service_id: a.service_id,
      start_at: a.start_at, price: null, duration_min: a.duration_min, notes: a.notes ?? null };
    this.msg.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() { this.editId.set(null); this.f = { ...this.f, start_at: '', price: null, duration_min: null, notes: null }; }

  async setStatus(a: Appointment, status: Status) {
    try { await this.api.patch(`/appointments/${a.id}/status`, { status }); }
    catch (e) { this.say(errorText(e), true); }
    await this.load();
  }

  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }
}
