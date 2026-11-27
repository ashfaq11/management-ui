import { DecimalPipe } from '@angular/common';
import { Component, computed, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchSelect, therapistOptions } from '../shared/search-select';
import { Api, errorText } from '../core/api';
import { Therapist } from '../core/models';
import { thisMonth, today } from '../core/util';

interface Bonus { id: number; therapist_id: number; therapist: string; on_date: string; amount: number; note?: string; added_by?: string; }

/** Extra incentives (bonus, extra hours, ...) for a therapist on a date; they are added to that month's payslip. */
import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-bonuses', imports: [SearchSelect, FormsModule, DecimalPipe],
  template: `
  <div class="card"><h2>Extra incentives</h2>
    <p style="margin:0 0 4px;color:var(--mut);font-size:13px">Paid on top of the % incentive, on the payslip of the month of the date.</p>
    <div class="grid">
      <div><label>Therapist</label><app-search-select [options]="tOpts()" [(value)]="f.therapist_id" placeholder="Search therapist…" /></div>
      <div><label>Date</label><input type="date" [(ngModel)]="f.on_date"></div>
      <div><label>Amount (Rs)</label><input type="number" min="1" [(ngModel)]="f.amount"></div>
      <div><label>Note</label><input [(ngModel)]="f.note" maxlength="200" placeholder="e.g. Festival bonus, extra hours"></div>
    </div>
    <button class="p" (click)="add()">Add incentive</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }

    <div class="row" style="margin-top:14px"><div><label>Show month</label>
      <input type="month" [ngModel]="month" (ngModelChange)="month = $event; load()"></div></div>
    <div class="wrap" style="margin-top:10px">
      <table><tr><th>Date</th><th>Therapist</th><th>Note</th><th class="num">Amount</th><th></th></tr>
      @for (b of rows(); track b.id) {
        <tr><td>{{ b.on_date }}</td><td>{{ b.therapist }}</td><td>{{ b.note || '-' }}</td>
          <td class="num">{{ b.amount | number: '1.2-2' }}</td>
          <td><button class="s" (click)="remove(b)">Remove</button></td></tr>
      } @empty { <tr><td colspan="5">No extra incentives this month.</td></tr> }
      @if (rows().length) { <tr><th colspan="3">Total</th><th class="num">{{ total() | number: '1.2-2' }}</th><th></th></tr> }
      </table>
    </div>
  </div>`,
})
export class Bonuses implements OnInit {
  private confirm = inject(Confirm);
  tOpts = computed(() => therapistOptions(this.therapists()));
  private api = inject(Api);
  therapists = input<Therapist[]>([]);
  month = thisMonth(); rows = signal<Bonus[]>([]);
  msg = signal(''); isErr = signal(false);
  f: { therapist_id?: number; on_date: string; amount: number | null; note: string } = { on_date: today(), amount: null, note: '' };

  ngOnInit() { return this.load(); }
  total() { return this.rows().reduce((s, b) => s + b.amount, 0); }

  async load() {
    if (!this.month) return;
    try { this.rows.set(await this.api.get<Bonus[]>('/bonuses', { month: this.month })); } catch (e) { this.say(errorText(e), true); }
  }

  async add() {
    if (!(await this.confirm.ask('Add this extra incentive?', '', 'Add', false))) return;
    try {
      const tid = this.f.therapist_id ?? this.therapists().find((t) => t.is_active)?.id;
      if (!tid) throw new Error('Pick a therapist');
      if (!this.f.amount || this.f.amount <= 0) throw new Error('Enter an amount');
      await this.api.post('/bonuses', { therapist_id: tid, on_date: this.f.on_date, amount: this.f.amount, note: this.f.note || null });
      this.say('Added'); this.month = this.f.on_date.slice(0, 7); this.f = { ...this.f, amount: null, note: '' };
      await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }

  async remove(b: Bonus) {
    if (!(await this.confirm.ask('Delete this extra incentive?', '', 'Delete', true))) return;
    if (!confirm(`Remove Rs ${b.amount} for ${b.therapist} on ${b.on_date}?`)) return;
    try { await this.api.delete(`/bonuses/${b.id}`); await this.load(); } catch (e) { this.say(errorText(e), true); }
  }

  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }
}
