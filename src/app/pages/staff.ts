import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Service, Therapist } from '../core/models';
import { Bonuses } from './bonuses';

const blankT = () => ({ name: '', phone: '', fixed_salary: 0, incentive_percent: 0 });
const blankS = () => ({ name: '', price: 0, duration_min: 60 });

@Component({
  selector: 'app-staff', imports: [FormsModule, DecimalPipe, Bonuses],
  template: `
  <div class="card"><h2>Therapists</h2>
    <div class="wrap"><table><tr><th>Name</th><th>Phone</th><th class="num">Fixed salary</th><th class="num">Incentive %</th><th>Active</th><th></th></tr>
    @for (t of therapists(); track t.id) {
      <tr><td>{{ t.name }}</td><td>{{ t.phone }}</td><td class="num">{{ t.fixed_salary | number: '1.2-2' }}</td><td class="num">{{ t.incentive_percent }}</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!t.is_active" (change)="toggleT(t)"></td>
        <td><button class="s" (click)="editT(t)">Edit</button></td></tr>
    }</table></div>
    <h2 style="margin-top:14px">{{ tId() ? 'Edit therapist' : 'Add therapist' }}</h2>
    <div class="row">
      <div><label>Name</label><input [(ngModel)]="t.name"></div>
      <div><label>Phone</label><input [(ngModel)]="t.phone"></div>
      <div><label>Fixed salary / month</label><input type="number" min="0" [(ngModel)]="t.fixed_salary"></div>
      <div><label>Incentive %</label><input type="number" min="0" max="100" step="0.5" [(ngModel)]="t.incentive_percent"></div>
    </div>
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
      <div><label>Minutes</label><input type="number" min="1" [(ngModel)]="s.duration_min"></div>
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
    this.t = { name: x.name, phone: x.phone ?? '', fixed_salary: x.fixed_salary, incentive_percent: x.incentive_percent };
  }
  resetT() { this.tId.set(null); this.t = blankT(); this.tActive = true; }
  async saveT() {
    try {
      const body = { ...this.t, phone: this.t.phone || null, is_active: this.tActive };
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
