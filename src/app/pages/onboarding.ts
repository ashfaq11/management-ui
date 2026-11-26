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

    <h2 style="margin-top:16px">Prepaid plan (optional)</h2>
    <label style="display:flex;align-items:center;gap:8px;margin:8px 0 12px">
      <input type="checkbox" [(ngModel)]="includePlan">
      Add a prepaid plan when registering this customer
    </label>
    @if (includePlan) {
      <div class="grid">
        <div><label>Plan name *</label><input [(ngModel)]="plan.name" placeholder="e.g. 10 hour package"></div>
        <div><label>Plan balance type</label>
          <select [(ngModel)]="plan.plan_type">
            <option value="hours">Hours plan</option>
            <option value="rupees">Rupees plan (INR)</option>
          </select>
        </div>
        <div><label>{{ plan.plan_type === 'hours' ? 'Hours purchased *' : 'Rupees purchased *' }}</label>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="plan.amount">
        </div>
        <div><label>Expiry date (optional)</label><input type="date" [(ngModel)]="plan.expires_on"></div>
      </div>
      <label>Plan notes</label><input [(ngModel)]="plan.notes" placeholder="Optional package details">
      <small>Hours and rupees are separate balances. The selected balance type is what staff can redeem later.</small>
    }

    <h2 style="margin-top:16px">First appointment (optional)</h2>
    <div class="grid">
      <div><label>Therapist</label><select [(ngModel)]="therapist_id">
        <option [ngValue]="undefined">No appointment now</option>
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></div>
      <div><label>Service</label><select [(ngModel)]="service_id">
        <option [ngValue]="undefined">Choose a service</option>
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</select></div>
      <div><label>Duration (min) &middot; blank = service default {{ serviceMinutes() }}</label>
        <input type="number" min="5" max="720" step="5" [(ngModel)]="duration_min" [placeholder]="'' + serviceMinutes()">
        <div class="chips">@for (m of [30, 60, 90, 120]; track m) {<button type="button" [class.on]="duration_min === m" (click)="duration_min = m">{{ m }} min</button>}</div></div>
    </div>
    @if (therapist_id) {
    <app-when-picker [(value)]="start_at" [therapistId]="therapist_id" [durationMin]="duration()" />
    } @else { <small>Pick a therapist to book a first appointment, or just register the customer.</small><br> }

    <button class="p" [disabled]="saving()" (click)="save()">{{ saving() ? 'Registering...' : 'Register customer' }}</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <small>To add a plan to an existing customer, open Customers, select History, and use Add plan / package.</small>
  </div>`,
})
export class Onboarding implements OnInit {
  private api = inject(Api);
  therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  msg = signal(''); isErr = signal(false); saving = signal(false);
  c = blank(); therapist_id?: number; service_id?: number; start_at = ''; duration_min: number | null = null;
  includePlan = false;
  plan: { name: string; plan_type: 'hours' | 'rupees'; amount: number | null; expires_on: string; notes: string } =
    { name: '', plan_type: 'hours', amount: null, expires_on: '', notes: '' };

  async ngOnInit() {
    const [t, s] = await Promise.all([this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
  }

  serviceMinutes() { return this.services().find((x) => x.id === this.service_id)?.duration_min ?? 60; }
  duration() { return this.duration_min || this.serviceMinutes(); }

  private resetForm() {
    this.c = blank();
    this.start_at = '';
    this.duration_min = null;
    this.therapist_id = undefined;
    this.service_id = undefined;
    this.includePlan = false;
    this.plan = { name: '', plan_type: 'hours', amount: null, expires_on: '', notes: '' };
  }

  async save() {
    if (this.saving()) return;
    this.msg.set('');
    if (!this.c.name.trim() || !this.c.phone.trim()) {
      this.msg.set('Enter the customer name and phone number.');
      this.isErr.set(true);
      return;
    }
    if (this.includePlan && (!this.plan.name.trim() || !(Number(this.plan.amount) > 0))) {
      this.msg.set('Enter a plan name and an amount greater than zero.');
      this.isErr.set(true);
      return;
    }

    const body: Record<string, unknown> = { name: this.c.name.trim(), phone: this.c.phone.trim() };
    for (const k of ['email', 'gender', 'dob', 'address', 'notes'] as const) body[k] = this.c[k] || null;
    if (this.therapist_id || this.service_id || this.start_at) {
      if (!this.therapist_id || !this.service_id || !this.start_at) {
        this.msg.set('For a first appointment pick a therapist, a service, a date and a time - or leave them all empty.');
        this.isErr.set(true);
        return;
      }
      body['first_appointment'] = { customer_id: 0, therapist_id: this.therapist_id, service_id: this.service_id, start_at: this.start_at,
        ...(this.duration_min ? { duration_min: this.duration_min } : {}) };
    }

    this.saving.set(true);
    try {
      const r = await this.api.post<{ customer_id: number; appointment_id: number | null }>('/onboarding', body);
      const registered = 'Registered customer #' + r.customer_id + (r.appointment_id ? ' with first appointment booked' : '');

      if (this.includePlan) {
        try {
          await this.api.post('/customers/' + r.customer_id + '/plans', {
            name: this.plan.name.trim(), plan_type: this.plan.plan_type, amount: Number(this.plan.amount),
            expires_on: this.plan.expires_on || null, notes: this.plan.notes.trim() || null,
          });
        } catch (e) {
          this.msg.set(registered + ', but the prepaid plan could not be added: ' + errorText(e)
            + ' Open this customer under Customers and add the plan from History.');
          this.isErr.set(true);
          this.resetForm();
          return;
        }
      }

      this.msg.set(registered + (this.includePlan ? ' and added the prepaid plan.' : '.'));
      this.isErr.set(false);
      this.resetForm();
    } catch (e) {
      this.msg.set(errorText(e));
      this.isErr.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
