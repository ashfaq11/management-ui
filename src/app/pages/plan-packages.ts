import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { PlanPackage } from '../core/models';

/** Admin: the plans the spa sells, at fixed prices. Staff assign these to customers. */
@Component({
  selector: 'app-plan-packages', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="page-head"><div><h1>Memberships</h1><p>Set up membership plans once; staff assign them to customers at these prices.</p></div></div>
  <div class="card"><h2>Membership plans</h2>
    <p class="hint">The membership plans you sell. Staff can only assign these to customers, at these prices.</p>
    <div class="wrap"><table><tr><th>Package</th><th>Gives</th><th class="num">Price</th><th>Valid for</th><th>Active</th><th></th></tr>
      @for (k of list(); track k.id) {
        <tr><td><b>{{ k.name }}</b></td><td>{{ k.plan_type === 'hours' ? (k.amount | number: '1.0-2') + ' hours' : '₹' + (k.amount | number: '1.0-2') + ' wallet' }}</td>
          <td class="num">₹{{ k.price | number: '1.0-2' }}</td><td>{{ k.validity_days ? k.validity_days + ' days' : 'No expiry' }}</td>
          <td><input type="checkbox" [checked]="k.is_active" (change)="toggle(k)"></td>
          <td><button class="s" (click)="edit(k)">Edit</button></td></tr>
      } @empty { <tr><td colspan="6">No packages yet. Add your first one below.</td></tr> }
    </table></div>
    <h3 style="margin-top:14px">{{ id() ? 'Edit membership plan' : 'Add membership plan' }}</h3>
    <div class="row">
      <div><label>Name *</label><input [(ngModel)]="f.name" placeholder="e.g. 10 Hours Gold"></div>
      <div style="flex:0 0 150px"><label>Type</label><select [(ngModel)]="f.plan_type"><option value="hours">Hours</option><option value="rupees">Rupees wallet</option></select></div>
      <div style="flex:0 0 130px"><label>{{ f.plan_type === 'hours' ? 'Hours' : 'Wallet ₹' }} *</label><input type="number" min="0.5" step="0.5" [(ngModel)]="f.amount"></div>
      <div style="flex:0 0 130px"><label>Price ₹ *</label><input type="number" min="0" step="1" [(ngModel)]="f.price"></div>
      <div style="flex:0 0 140px"><label>Valid for (days)</label><input type="number" min="1" [(ngModel)]="f.validity_days" placeholder="no expiry"></div>
    </div>
    <button class="p" (click)="save()">{{ id() ? 'Save membership plan' : 'Add membership plan' }}</button>
    @if (id()) { <button class="s" style="margin-left:8px" (click)="reset()">Cancel</button> }
    @if (msg()) { <div class="msg" [class.err]="err()">{{ msg() }}</div> }
  </div>`,
})
export class PlanPackages implements OnInit {
  private api = inject(Api);
  list = signal<PlanPackage[]>([]); id = signal<number | null>(null); msg = signal(''); err = signal(false);
  f = this.blank();
  blank() { return { name: '', plan_type: 'hours' as 'hours' | 'rupees', amount: null as number | null, price: null as number | null, validity_days: null as number | null, is_active: true }; }
  async ngOnInit() { await this.load(); }
  async load() { this.list.set(await this.api.get<PlanPackage[]>('/plan-packages')); }
  edit(k: PlanPackage) { this.id.set(k.id); this.f = { name: k.name, plan_type: k.plan_type, amount: +k.amount, price: +k.price, validity_days: k.validity_days ?? null, is_active: k.is_active }; }
  reset() { this.id.set(null); this.f = this.blank(); }
  private body(k = this.f) {
    return { ...k, name: k.name.trim(), amount: Number(k.amount), price: Number(k.price), validity_days: k.validity_days ? Number(k.validity_days) : null };
  }
  async save() {
    if (!this.f.name.trim() || !(Number(this.f.amount) > 0) || this.f.price === null || String(this.f.price) === '') {
      this.err.set(true); this.msg.set('Enter a name, amount and price.'); return;
    }
    try {
      const id = this.id();
      if (id) await this.api.put(`/plan-packages/${id}`, this.body()); else await this.api.post('/plan-packages', this.body());
      this.err.set(false); this.msg.set(id ? 'Package updated. Plans already sold keep their terms.' : 'Package added.');
      this.reset(); await this.load();
    } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async toggle(k: PlanPackage) {
    try { await this.api.put(`/plan-packages/${k.id}`, this.body({ ...k, amount: +k.amount, price: +k.price, validity_days: k.validity_days ?? null, is_active: !k.is_active })); await this.load(); }
    catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
}
