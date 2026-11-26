import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Service, Therapist } from '../core/models';

@Component({
  selector: 'app-staff', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="card"><h2>Therapists</h2>
    <div class="wrap"><table><tr><th>Name</th><th class="num">Fixed salary</th><th class="num">Incentive %</th><th>Active</th></tr>
    @for (t of therapists(); track t.id) {
      <tr><td>{{ t.name }}</td><td class="num">{{ t.fixed_salary | number: '1.2-2' }}</td><td class="num">{{ t.incentive_percent }}</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!t.is_active" (change)="toggleT(t)"></td></tr>
    }</table></div>
    <div class="row">
      <div><label>Name</label><input [(ngModel)]="t.name"></div>
      <div><label>Fixed salary / month</label><input type="number" min="0" [(ngModel)]="t.fixed_salary"></div>
      <div><label>Incentive %</label><input type="number" min="0" max="100" step="0.5" [(ngModel)]="t.incentive_percent"></div>
    </div>
    <button class="p" (click)="addT()">Add therapist</button>
    @if (tm()) { <div class="msg err">{{ tm() }}</div> }
  </div>
  <div class="card"><h2>Services</h2>
    <div class="wrap"><table><tr><th>Name</th><th class="num">Price</th><th class="num">Minutes</th><th>Active</th></tr>
    @for (s of services(); track s.id) {
      <tr><td>{{ s.name }}</td><td class="num">{{ s.price | number: '1.2-2' }}</td><td class="num">{{ s.duration_min }}</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!s.is_active" (change)="toggleS(s)"></td></tr>
    }</table></div>
    <div class="row">
      <div><label>Name</label><input [(ngModel)]="s.name"></div>
      <div><label>Price</label><input type="number" min="0" [(ngModel)]="s.price"></div>
      <div><label>Minutes</label><input type="number" min="1" [(ngModel)]="s.duration_min"></div>
    </div>
    <button class="p" (click)="addS()">Add service</button>
    @if (sm()) { <div class="msg err">{{ sm() }}</div> }
  </div>`,
})
export class Staff implements OnInit {
  private api = inject(Api);
  therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  tm = signal(''); sm = signal('');
  t = { name: '', fixed_salary: 0, incentive_percent: 0 };
  s = { name: '', price: 0, duration_min: 60 };

  async ngOnInit() { await this.reload(); }
  async reload() {
    const [t, s] = await Promise.all([this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.therapists.set(t); this.services.set(s);
  }
  async addT() {
    try { await this.api.post('/therapists', this.t); this.t = { name: '', fixed_salary: 0, incentive_percent: 0 }; this.tm.set(''); await this.reload(); }
    catch (e) { this.tm.set(errorText(e)); }
  }
  async addS() {
    try { await this.api.post('/services', this.s); this.s = { name: '', price: 0, duration_min: 60 }; this.sm.set(''); await this.reload(); }
    catch (e) { this.sm.set(errorText(e)); }
  }
  async toggleT(x: Therapist) {
    try { await this.api.put(`/therapists/${x.id}`, { ...x, is_active: !x.is_active }); } catch (e) { this.tm.set(errorText(e)); }
    await this.reload();
  }
  async toggleS(x: Service) {
    try { await this.api.put(`/services/${x.id}`, { ...x, is_active: !x.is_active }); } catch (e) { this.sm.set(errorText(e)); }
    await this.reload();
  }
}
