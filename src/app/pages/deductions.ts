import { Component, computed, inject, input, signal, effect, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { today } from '../core/util';
import { SearchSelect } from '../shared/search-select';

interface Row { id: number; therapist: string; kind: string; amount: number; reason: string; on_date: string; }
const KINDS = ['advance', 'leave', 'damage', 'fine', 'loan', 'other'];

/** Payroll: salary deductions with a reason; they come off that month's net pay. */
import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-deductions', imports: [FormsModule, SearchSelect],
  template: `
  <div class="card"><h2>Salary deductions</h2>
    <div class="row">
      <div style="flex:2"><label>Therapist *</label><app-search-select [options]="opts()" [(value)]="f.therapist_id" placeholder="Search therapist…" /></div>
      <div style="flex:0 0 140px"><label>Type</label><select [(ngModel)]="f.kind">@for (k of kinds; track k) { <option [value]="k">{{ k }}</option> }</select></div>
      <div style="flex:0 0 130px"><label>Amount ₹ *</label><input type="number" min="1" [(ngModel)]="f.amount"></div>
      <div style="flex:0 0 160px"><label>Date</label><input type="date" [(ngModel)]="f.on_date"></div>
      <div style="flex:3"><label>Reason *</label><input [(ngModel)]="f.reason" placeholder="e.g. advance taken on 10th"></div>
    </div>
    <button class="p" (click)="add()">Add deduction</button>
    @if (msg()) { <div class="msg" [class.err]="err()">{{ msg() }}</div> }
    <div class="wrap" style="margin-top:10px"><table><tr><th>Date</th><th>Therapist</th><th>Type</th><th>Reason</th><th class="num">Amount</th><th></th></tr>
      @for (x of rows(); track x.id) {
        <tr><td>{{ x.on_date }}</td><td>{{ x.therapist }}</td><td>{{ x.kind }}</td><td>{{ x.reason }}</td>
          <td class="num">- {{ (+x.amount).toLocaleString('en-IN') }}</td><td><button class="s" (click)="remove(x)">Delete</button></td></tr>
      } @empty { <tr><td colspan="6">No deductions this month.</td></tr> }
    </table></div>
  </div>`,
})
export class Deductions {
  private confirm = inject(Confirm);
  month = input.required<string>();
  therapists = input<{ therapist_id: number; therapist: string }[]>([]);
  changed = output<void>();
  private api = inject(Api);
  kinds = KINDS;
  opts = computed(() => this.therapists().map((t) => ({ id: t.therapist_id, label: t.therapist })));
  rows = signal<Row[]>([]); msg = signal(''); err = signal(false);
  f = { therapist_id: null as number | null, kind: 'advance', amount: null as number | null, on_date: today(), reason: '' };
  constructor() { effect(() => { void this.load(this.month()); }); }
  async load(m = this.month()) {
    try { this.rows.set(await this.api.get<Row[]>('/deductions', { month: m })); } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async add() {
    if (!(await this.confirm.ask('Add this salary deduction?', `₹${this.f.amount} · ${this.f.reason}`, 'Add', false))) return;
    if (!this.f.therapist_id || !(Number(this.f.amount) > 0) || this.f.reason.trim().length < 3) {
      this.err.set(true); this.msg.set('Choose the therapist, amount and a reason.'); return;
    }
    try {
      await this.api.post('/deductions', { ...this.f, amount: Number(this.f.amount), reason: this.f.reason.trim() });
      this.err.set(false); this.msg.set('Deduction added.'); this.f = { ...this.f, amount: null, reason: '' };
      await this.load(); this.changed.emit();
    } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async remove(x: Row) {
    if (!(await this.confirm.ask('Delete this deduction?', `${x.therapist} · ₹${x.amount}`, 'Delete', true))) return;
    try { await this.api.delete(`/deductions/${x.id}`); await this.load(); this.changed.emit(); }
    catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
}
