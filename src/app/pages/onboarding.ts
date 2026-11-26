import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { WhenPicker } from '../shared/when-picker';
import { Service, Therapist } from '../core/models';

const blank = () => ({ name: '', phone: '', email: '', gender: '', dob: '', address: '', notes: '' });

@Component({
  selector: 'app-onboarding', imports: [FormsModule, WhenPicker],
  template: `
  <div class="card"><h2>Onboard new customer</h2>
    <div class="grid">
      <div><label>Name *</label><input [(ngModel)]="c.name"></div>
      <div><label>Phone *</label><input [(ngModel)]="c.phone"></div>
      <div><label>Email</label><input [(ngModel)]="c.email"></div>
      <div><label>Gender</label><select [(ngModel)]="c.gender"><option value="">-</option><option>Female</option><option>Male</option><option>Other</option></select></div>
      <div><label>Date of birth</label><input type="date" [(ngModel)]="c.dob"></div>
      <div><label>Address</label><input [(ngModel)]="c.address"></div>
    </div>
    <label>Notes (allergies, skin type, preferences)</label><textarea rows="2" [(ngModel)]="c.notes"></textarea>
    <h2 style="margin-top:16px">First appointment (optional)</h2>
    <div class="grid">
      <div><label>Therapist</label><select [(ngModel)]="therapist_id">
        <option [ngValue]="undefined">No appointment now</option>
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></div>
      <div><label>Service</label><select [(ngModel)]="service_id">
        <option [ngValue]="undefined">Choose a service</option>
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</select></div>
      <div><label>Duration (min) &middot; blank = service default {{ serviceMinutes() }}</label>
        <input type="number" min="5" max="720" step="5" [(ngModel)]="duration_min" [placeholder]="'' + serviceMinutes()"></div>
    </div>
    @if (therapist_id) {
    <app-when-picker [(value)]="start_at" [therapistId]="therapist_id" [durationMin]="duration()" />
    } @else { <small>Pick a therapist to book a first appointment, or just register the customer.</small><br> }
    <button class="p" (click)="save()">Register customer</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
  </div>`,
})
export class Onboarding implements OnInit {
  private api = inject(Api);
  therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  msg = signal(''); isErr = signal(false);
  c = blank(); therapist_id?: number; service_id?: number; start_at = ''; duration_min: number | null = null;

  async ngOnInit() {
    const [t, s] = await Promise.all([this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
  }

  serviceMinutes() { return this.services().find((x) => x.id === this.service_id)?.duration_min ?? 60; }
  duration() { return this.duration_min || this.serviceMinutes(); }

  async save() {
    try {
      const body: Record<string, unknown> = { name: this.c.name.trim(), phone: this.c.phone.trim() };
      for (const k of ['email', 'gender', 'dob', 'address', 'notes'] as const) body[k] = this.c[k] || null;
      if (this.therapist_id || this.service_id || this.start_at) {
        if (!this.therapist_id || !this.service_id || !this.start_at)
          throw new Error('For a first appointment pick a therapist, a service, a date and a time - or leave them all empty');
        body['first_appointment'] = { customer_id: 0, therapist_id: this.therapist_id, service_id: this.service_id, start_at: this.start_at,
          ...(this.duration_min ? { duration_min: this.duration_min } : {}) };
      }
      const r = await this.api.post<{ customer_id: number; appointment_id: number | null }>('/onboarding', body);
      this.msg.set(`Registered customer #${r.customer_id}` + (r.appointment_id ? ' with first appointment booked' : ''));
      this.isErr.set(false); this.c = blank(); this.start_at = ''; this.duration_min = null; this.therapist_id = undefined; this.service_id = undefined;
    } catch (e) { this.msg.set(errorText(e)); this.isErr.set(true); }
  }
}
