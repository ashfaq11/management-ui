import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Service, Therapist } from '../core/models';
import { Bonuses } from './bonuses';

const DETAILS = ['email', 'gender', 'dob', 'address', 'specialities', 'experience_years', 'notes', 'emergency_name',
  'emergency_phone', 'id_proof_type', 'id_proof_number', 'bank_name', 'bank_account_name', 'bank_account_number', 'bank_ifsc',
  'upi_id'] as const;
type Detail = (typeof DETAILS)[number];
const blankT = () => ({ name: '', phone: '', fixed_salary: 0, incentive_percent: 0, joined_on: '',
  ...Object.fromEntries(DETAILS.map((k) => [k, ''])) as Record<Detail, string | number> });
/** Show only the last 4 digits of an account or ID number in lists. */
const mask = (v?: string) => (v ? (v.length > 4 ? '•••• ' + v.slice(-4) : v) : '');
const blankS = () => ({ name: '', price: 0, duration_min: 60 });

@Component({
  selector: 'app-staff', imports: [FormsModule, DecimalPipe, Bonuses],
  template: `
  <div class="page-head"><div><h1>Therapists &amp; services</h1><p>Your team, their profiles, and the treatments you offer.</p></div></div>
  <div class="card"><h2>Therapists</h2>
    <div class="wrap"><table><tr><th>Name</th><th>Phone</th><th>Specialities</th><th class="num">Fixed salary</th><th class="num">Incentive %</th><th>Active</th><th></th></tr>
    @for (t of therapists(); track t.id) {
      <tr [class.open]="viewId() === t.id"><td><button class="link" (click)="viewId.set(viewId() === t.id ? null : t.id)">{{ t.name }}</button></td>
        <td>{{ t.phone }}</td><td>{{ t.specialities }}</td>
        <td class="num">{{ t.fixed_salary | number: '1.2-2' }}</td><td class="num">{{ t.incentive_percent }}</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!t.is_active" (change)="toggleT(t)"></td>
        <td><button class="s" (click)="editT(t)">Edit</button></td></tr>
      @if (viewId() === t.id) {
        <tr class="detail"><td colspan="7"><div class="dl">
          @for (f of view(t); track f[0]) { <div><span>{{ f[0] }}</span><b>{{ f[1] || '—' }}</b></div> }
        </div></td></tr>
      }
    }</table></div>
    <h2 style="margin-top:18px" id="tform">{{ tId() ? 'Edit therapist' : 'Add therapist' }}</h2>
    <div class="row">
      <div><label>Name</label><input [(ngModel)]="t.name"></div>
      <div><label>Phone</label><input [(ngModel)]="t.phone"></div>
      <div><label>Fixed salary / month</label><input type="number" min="0" [(ngModel)]="t.fixed_salary"></div>
      <div><label>Incentive %</label><input type="number" min="0" max="100" step="0.5" [(ngModel)]="t.incentive_percent"></div>
    </div>
    <details class="sec" [open]="tId() !== null"><summary>Personal <small>email, gender, birthday, address</small></summary><div class="grid">
      <div><label>Email</label><input type="email" [(ngModel)]="t.email"></div>
      <div><label>Gender</label><select [(ngModel)]="t.gender"><option value=""></option><option>Female</option><option>Male</option><option>Other</option></select></div>
      <div><label>Date of birth</label><input type="date" [(ngModel)]="t.dob"></div>
      <div><label>Address</label><input [(ngModel)]="t.address"></div>
    </div></details>
    <details class="sec"><summary>Work <small>skills, experience, joining date</small></summary><div class="grid">
      <div><label>Specialities</label><input [(ngModel)]="t.specialities" placeholder="Thai, Deep tissue, Facials"></div>
      <div><label>Experience (years)</label><input type="number" min="0" step="0.5" [(ngModel)]="t.experience_years"></div>
      <div><label>Joined on</label><input type="date" [(ngModel)]="t.joined_on"></div>
      <div><label>Notes</label><input [(ngModel)]="t.notes"></div>
    </div></details>
    <details class="sec"><summary>Emergency contact &amp; ID</summary><div class="grid">
      <div><label>Emergency contact name</label><input [(ngModel)]="t.emergency_name"></div>
      <div><label>Emergency contact phone</label><input [(ngModel)]="t.emergency_phone"></div>
      <div><label>ID proof</label><select [(ngModel)]="t.id_proof_type"><option value=""></option><option>Aadhaar</option><option>PAN</option>
        <option>Driving licence</option><option>Voter ID</option><option>Passport</option></select></div>
      <div><label>ID number</label><input [(ngModel)]="t.id_proof_number" autocomplete="off"></div>
    </div></details>
    <details class="sec"><summary>Salary bank <small>for paying the payslip</small></summary><div class="grid">
      <div><label>Bank name</label><input [(ngModel)]="t.bank_name"></div>
      <div><label>Account holder</label><input [(ngModel)]="t.bank_account_name"></div>
      <div><label>Account number</label><input [(ngModel)]="t.bank_account_number" autocomplete="off" inputmode="numeric"></div>
      <div><label>IFSC</label><input [(ngModel)]="t.bank_ifsc" style="text-transform:uppercase"></div>
      <div><label>UPI ID</label><input [(ngModel)]="t.upi_id" placeholder="name@bank"></div>
    </div></details>
    <p style="font-size:12px;color:var(--mut)">Salary and % changes apply to the whole month's payslip, including services already completed this month.</p>
    <button class="p" (click)="saveT()">{{ tId() ? 'Save changes' : 'Add therapist' }}</button>
    @if (tId()) { <button class="s" style="margin-left:8px" (click)="resetT()">Cancel</button> }
    @if (tm()) { <div class="msg err">{{ tm() }}</div> }
  </div>
  <div class="card"><h2>Services</h2>
    <div class="wrap"><table><tr><th>Name</th><th class="num">Price</th><th class="num">Minutes</th><th>Active</th><th></th></tr>
    @for (x of services(); track x.id) {
      <tr><td>{{ x.name }}</td><td class="num">{{ x.price | number: '1.2-2' }}</td><td class="num">{{ x.duration_min }}</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!x.is_active" (change)="toggleS(x)"></td>
        <td><button class="s" (click)="editS(x)">Edit</button></td></tr>
    }</table></div>
    <h2 style="margin-top:14px">{{ sId() ? 'Edit service' : 'Add service' }}</h2>
    <div class="row">
      <div><label>Name</label><input [(ngModel)]="s.name"></div>
      <div><label>Price</label><input type="number" min="0" [(ngModel)]="s.price"></div>
      <div><label>Minutes</label><input type="number" min="1" [(ngModel)]="s.duration_min">
        <div class="chips">@for (m of [30, 60, 90, 120]; track m) {<button type="button" [class.on]="s.duration_min === m" (click)="s.duration_min = m">{{ m }} min</button>}</div></div>
    </div>
    <p style="font-size:12px;color:var(--mut)">A new price applies to future bookings only; existing appointments keep the price they were booked at.</p>
    <button class="p" (click)="saveS()">{{ sId() ? 'Save changes' : 'Add service' }}</button>
    @if (sId()) { <button class="s" style="margin-left:8px" (click)="resetS()">Cancel</button> }
    @if (sm()) { <div class="msg err">{{ sm() }}</div> }
  </div>
  <app-bonuses [therapists]="therapists()" />`,
})
export class Staff implements OnInit {
  private api = inject(Api);
  therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  viewId = signal<number | null>(null);
  tm = signal(''); sm = signal(''); tId = signal<number | null>(null); sId = signal<number | null>(null);
  t = blankT(); s = blankS();
  private tActive = true; private sActive = true;

  async ngOnInit() { await this.reload(); }
  async reload() {
    const [t, s] = await Promise.all([this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.therapists.set(t); this.services.set(s);
  }

  editT(x: Therapist) {
    this.tId.set(x.id); this.tActive = !!x.is_active; this.tm.set('');
    this.t = { name: x.name, phone: x.phone ?? '', fixed_salary: x.fixed_salary, incentive_percent: x.incentive_percent,
      joined_on: x.joined_on ?? '', ...Object.fromEntries(DETAILS.map((k) => [k, x[k] ?? ''])) as Record<Detail, string | number> };
    setTimeout(() => document.getElementById('tform')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  view(x: Therapist): [string, unknown][] {
    return [['Email', x.email], ['Gender', x.gender], ['Date of birth', x.dob], ['Address', x.address],
      ['Experience', x.experience_years != null ? `${+x.experience_years} yrs` : ''], ['Joined', x.joined_on], ['Notes', x.notes],
      ['Emergency contact', [x.emergency_name, x.emergency_phone].filter(Boolean).join(' · ')],
      ['ID proof', [x.id_proof_type, mask(x.id_proof_number)].filter(Boolean).join(' ')],
      ['Bank', [x.bank_name, x.bank_ifsc?.toUpperCase()].filter(Boolean).join(' · ')], ['Account holder', x.bank_account_name],
      ['Account', mask(x.bank_account_number)], ['UPI', x.upi_id]];
  }
  resetT() { this.tId.set(null); this.t = blankT(); this.tActive = true; }
  async saveT() {
    try {
      const body: Record<string, unknown> = { ...this.t, phone: this.t.phone || null, is_active: this.tActive };
      for (const k of [...DETAILS, 'joined_on']) if (body[k] === '' || body[k] === null) body[k] = null;
      if (body['bank_ifsc']) body['bank_ifsc'] = String(body['bank_ifsc']).toUpperCase();
      const id = this.tId();
      if (id) await this.api.put(`/therapists/${id}`, body); else await this.api.post('/therapists', body);
      this.resetT(); this.tm.set(''); await this.reload();
    } catch (e) { this.tm.set(errorText(e)); }
  }
  async toggleT(x: Therapist) {
    try { await this.api.put(`/therapists/${x.id}`, { ...x, is_active: !x.is_active }); } catch (e) { this.tm.set(errorText(e)); }
    await this.reload();
  }

  editS(x: Service) {
    this.sId.set(x.id); this.sActive = !!x.is_active; this.sm.set('');
    this.s = { name: x.name, price: x.price, duration_min: x.duration_min };
  }
  resetS() { this.sId.set(null); this.s = blankS(); this.sActive = true; }
  async saveS() {
    try {
      const body = { ...this.s, is_active: this.sActive };
      const id = this.sId();
      if (id) await this.api.put(`/services/${id}`, body); else await this.api.post('/services', body);
      this.resetS(); this.sm.set(''); await this.reload();
    } catch (e) { this.sm.set(errorText(e)); }
  }
  async toggleS(x: Service) {
    try { await this.api.put(`/services/${x.id}`, { ...x, is_active: !x.is_active }); } catch (e) { this.sm.set(errorText(e)); }
    await this.reload();
  }
}
