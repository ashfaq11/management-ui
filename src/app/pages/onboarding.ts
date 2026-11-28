import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchSelect, therapistOptions } from '../shared/search-select';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { WhenPicker } from '../shared/when-picker';
import { PaymentMethod, Service, Therapist, PlanPackage } from '../core/models';

const blank = () => ({ name: '', phone: '', email: '', gender: '', dob: '', address: '', notes: '' });

import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-onboarding', imports: [SearchSelect, FormsModule, WhenPicker],
  template: `
  <div class="card"><h2>Onboard new customer</h2>
    <div class="grid">
      <div><label>Name *</label><input [(ngModel)]="c.name"></div>
      <div><label>Phone *</label><input [(ngModel)]="c.phone"></div>
      <div><label>Email</label><input [(ngModel)]="c.email"></div>
      <div><label>Gender</label><select [(ngModel)]="c.gender"><option value="">-</option><option>Female</option><option>Male</option><option>Other</option></select></div>
      <div><label>Date of birth</label><input type="date" [(ngModel)]="c.dob"></div>
      <div><label>Address</label><input [(ngModel)]="c.address"></div>
      <div><label>Preferred payment method (optional)</label><select [(ngModel)]="preferredPaymentMethod">
        <option value="">No preference</option><option value="cash">Cash</option><option value="upi">UPI</option>
        <option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
    </div>
    <label>Notes (allergies, skin type, preferences)</label><textarea rows="2" [(ngModel)]="c.notes"></textarea>

    <h2 style="margin-top:16px">Membership plan (optional)</h2>
    <div class="row" style="align-items:flex-end">
      <div style="flex:2"><label>Plan</label><select [(ngModel)]="pkgChoice" (ngModelChange)="includePlan = $event === 'custom'">
        <option [ngValue]="null">No plan</option>
        @for (k of packages(); track k.id) { @if (k.is_active) { <option [ngValue]="k.id">{{ pkgLabel(k) }}</option> } }
</select></div>
      @if (pkgChoice !== null && pkgChoice !== 'custom') {
        <div style="flex:0 0 190px"><label>Payment</label><select [(ngModel)]="pkgPaid"><option value="cash">Paid · Cash</option><option value="upi">Paid · UPI</option><option value="card">Paid · Card</option><option value="bank_transfer">Paid · Bank transfer</option><option value="other">Paid · Other</option><option value="pending">Pending (pay later)</option></select></div>
      }
    </div>
    
    <h2 style="margin-top:16px">First appointment (optional)</h2>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0 10px"><input type="checkbox" [(ngModel)]="bookNow" (ngModelChange)="!$event && (therapist_id = undefined)"> Book an appointment now</label>
    @if (bookNow) {
    <div class="grid">
      <div><label>Therapist *</label><app-search-select [options]="tOpts()" [(value)]="therapist_id" placeholder="Search therapist…" /></div>
      <div><label>Service</label><select [(ngModel)]="service_id">
        <option [ngValue]="undefined">Choose a service</option>
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }} · {{ s.duration_min }} min</option> }</select></div>
      <div><label>Duration (min) &middot; blank = service default {{ serviceMinutes() }}</label>
        <input type="number" min="5" max="720" step="5" [(ngModel)]="duration_min" [placeholder]="'' + serviceMinutes()">
        <div class="chips">@for (m of [30, 60, 90, 120]; track m) {<button type="button" [class.on]="duration_min === m" (click)="duration_min = m">{{ m }} min</button>}</div></div>
    </div>
    @if (therapist_id) {
    <app-when-picker [(value)]="start_at" [therapistId]="therapist_id" [durationMin]="duration()" />
    } @else { <small>Pick the therapist, service and a free time.</small><br> }
    }

    <button class="p" [disabled]="saving()" (click)="save()">{{ saving() ? 'Registering...' : 'Register customer' }}</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <small>Existing customer? Find them under Customers to book, assign a membership or edit details.</small>
  </div>`,
})
export class Onboarding implements OnInit {
  private confirm = inject(Confirm);
  tOpts = computed(() => therapistOptions(this.therapists()));
  /** One select = paid or not + how: 'cash' | 'upi' | ... | 'pending'. */
  payOf(v: unknown) { const m = String(v); return { paid: m !== 'pending', payment_method: m === 'pending' ? null : m }; }

  private api = inject(Api);
  auth = inject(Auth);
  therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  msg = signal(''); isErr = signal(false); saving = signal(false);
  c = blank(); therapist_id?: number; service_id?: number; start_at = ''; duration_min: number | null = null;
  includePlan = false;
  preferredPaymentMethod: PaymentMethod | '' = '';
  plan: { name: string; plan_type: 'hours' | 'rupees'; amount: number | null; price_paid: number | null; paid: string; expires_on: string; notes: string } =
    { name: '', plan_type: 'hours', amount: null, price_paid: null, paid: 'cash', expires_on: '', notes: '' };

  packages = signal<PlanPackage[]>([]);
  bookNow = false;
  pkgChoice: number | 'custom' | null = null; pkgPaid = 'cash';
  pkgLabel(k: PlanPackage) {
    const gives = k.plan_type === 'hours' ? `${+k.amount} hrs` : `₹${(+k.amount).toLocaleString('en-IN')} wallet`;
    return `${k.name} · ${gives} · ₹${(+k.price).toLocaleString('en-IN')}${k.validity_days ? ' · ' + k.validity_days + ' days' : ''}`;
  }
  async ngOnInit() {
    this.api.get<PlanPackage[]>('/plan-packages').then((p) => this.packages.set(p)).catch(() => undefined);
    const [t, s] = await Promise.all([this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
  }

  serviceMinutes() { return this.services().find((x) => x.id === this.service_id)?.duration_min ?? 60; }
  duration() { return this.duration_min || this.serviceMinutes(); }

  private resetForm() {
    this.c = blank();
    this.start_at = '';
    this.duration_min = null;
    this.therapist_id = undefined; this.bookNow = false;
    this.service_id = undefined;
    this.includePlan = false; this.pkgChoice = null; this.pkgPaid = 'cash';
    this.preferredPaymentMethod = '';
    this.plan = { name: '', plan_type: 'hours', amount: null, price_paid: null, paid: 'cash', expires_on: '', notes: '' };
  }

  async save() {
    if (!(await this.confirm.ask('Register this customer?', [this.c.name, this.pkgChoice ? 'with a membership' : '', this.bookNow ? 'and book the first appointment' : ''].filter(Boolean).join(' '), 'Register', false))) return;
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
    body['preferred_payment_method'] = this.preferredPaymentMethod || null;
    if (this.pkgChoice !== null && this.pkgChoice !== 'custom') body['package'] = { package_id: this.pkgChoice, ...this.payOf(this.pkgPaid) };
    if (this.includePlan) body['plan'] = {
      name: this.plan.name.trim(), plan_type: this.plan.plan_type, amount: Number(this.plan.amount),
      expires_on: this.plan.expires_on || null, notes: this.plan.notes.trim() || null,
      price_paid: this.plan.price_paid === null || String(this.plan.price_paid) === '' ? null : Number(this.plan.price_paid),
      ...this.payOf(this.plan.paid),
    };
    if (this.bookNow && (this.therapist_id || this.service_id || this.start_at)) {
      if (!this.therapist_id || !this.service_id || !this.start_at) {
        this.msg.set('For a first appointment pick a therapist, a service, a date and a time, or untick "Book an appointment now".');
        this.isErr.set(true);
        return;
      }
      body['first_appointment'] = { customer_id: 0, therapist_id: this.therapist_id, service_id: this.service_id, start_at: this.start_at,
        ...(this.duration_min ? { duration_min: this.duration_min } : {}) };
    }

    this.saving.set(true);
    try {
      const r = await this.api.post<{ customer_id: number; appointment_id: number | null; plan_id: number | null }>('/onboarding', body);
      const registered = 'Registered customer #' + r.customer_id + (r.appointment_id ? ' with first appointment booked' : '');
      const planSummary = r.plan_id
        ? ' Added ' + Number(this.plan.amount).toFixed(2) + (this.plan.plan_type === 'hours' ? ' hours to the hours wallet.' : ' rupees to the rupees wallet.')
        : '';
      this.msg.set(registered + '.' + planSummary);
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
