import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { today } from '../core/util';

const CATS = ['Maintenance', 'Rent', 'Electricity & water', 'Supplies', 'Laundry', 'Repairs', 'Marketing', 'Other'];
interface Line { id: number; on_date: string; category: string; name: string | null; amount: number; kind: 'one-off' | 'regular'; payment_method?: string | null; }
interface Regular { id: number; name: string; category: string; amount: number; day_of_month: number; starts_on: string; ends_on: string | null; notes: string | null; payment_method?: string; }
interface Month { total: number; lines: Line[]; by_category: { category: string; amount: number }[]; regular: Regular[]; }

import { exportTable } from '../shared/export';
import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-expenses', imports: [FormsModule, DecimalPipe],
  template: `
  <div class="page-head"><div><h1>Expenses</h1><p>Spa running costs. They reduce net profit in Reports.</p></div></div>

  <div class="card pop"><h2>Add expense</h2>
    <div class="row">
      <div style="flex:0 0 150px"><label>Amount (Rs) *</label><input type="number" min="1" step="1" [(ngModel)]="f.amount" placeholder="0"></div>
      <div style="flex:2"><label>Reason *</label><input [(ngModel)]="f.note" placeholder="e.g. AC service, towels, plumber" (keyup.enter)="add()"></div>
      <div style="flex:0 0 160px"><label>Date</label><input type="date" [(ngModel)]="f.on_date"></div>
      <div style="flex:0 0 180px"><label>Type</label><select [(ngModel)]="f.category">@for (c of cats; track c) {<option>{{ c }}</option>}</select></div>
      <div style="flex:0 0 150px"><label>Paid by *</label><select [(ngModel)]="f.payment_method"><option value="cash">Cash</option><option value="upi">UPI</option>
        <option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
    </div>
    <button class="p" (click)="add()" [disabled]="busy()">{{ editId() ? 'Save changes' : 'Add expense' }}</button>
    @if (editId()) { <button class="s" style="margin-left:8px" (click)="reset()">Cancel</button> }
    @if (msg()) { <div class="msg" [class.err]="err()">{{ msg() }}</div> }
  </div>

  <div class="card">
    <div class="row" style="align-items:center">
      <div style="flex:0 0 200px"><label>Month</label><input type="month" [(ngModel)]="month" (change)="load()"></div>
      <div style="flex:0 0 auto;margin-top:14px"><span style="display:inline-flex;gap:6px;margin-left:auto"><button class="s" (click)="exp('pdf')">PDF</button><button class="s" (click)="exp('xlsx')">Excel</button></span></div>
      <div class="kpi" style="flex:0 0 200px;margin-top:14px"><span>Total this month</span><b>&#8377;{{ (data()?.total ?? 0) | number: '1.0-2' }}</b></div>
    </div>
    @if (data()?.by_category?.length) {
      <p class="hint" style="margin-top:10px">@for (c of data()!.by_category; track c.category) {
        <span class="badge mute" style="margin:0 6px 6px 0">{{ c.category }} &#8377;{{ c.amount | number: '1.0-0' }}</span> }</p>
    }
    <div class="wrap" style="margin-top:8px"><table><tr><th>Date</th><th>Reason</th><th>Type</th><th class="num">Amount</th><th></th></tr>
      @for (x of data()?.lines ?? []; track x.kind + x.id + x.on_date) {
        <tr><td>{{ x.on_date }}</td><td>{{ x.name || '—' }} @if (x.kind === 'regular') { <span class="badge gold">monthly</span> }</td>
          <td>{{ x.category }}{{ x.payment_method ? ' · ' + ({cash:'Cash',upi:'UPI',card:'Card',bank_transfer:'Bank',other:'Other'}[x.payment_method] ?? x.payment_method) : '' }}</td><td class="num">{{ x.amount | number: '1.2-2' }}</td>
          <td style="white-space:nowrap">@if (x.kind === 'one-off') {
            <button class="s" (click)="edit(x)">Edit</button> <button class="s" (click)="remove(x)">Delete</button> }</td></tr>
      } @empty { <tr><td colspan="5">No expenses this month.</td></tr> }
    </table></div>
  </div>

  <details class="sec card" style="padding:0"><summary>Regular monthly expenses <small>rent, electricity, internet… added every month automatically</small></summary>
    <div class="body">
      <div class="wrap"><table><tr><th>Name</th><th>Type</th><th class="num">Monthly</th><th>Due day</th><th>From</th><th>Until</th><th></th></tr>
        @for (r of data()?.regular ?? []; track r.id) {
          <tr><td>{{ r.name }}</td><td>{{ r.category }}</td><td class="num">{{ r.amount | number: '1.2-2' }}</td><td>{{ r.day_of_month }}</td>
            <td>{{ r.starts_on }}</td><td>{{ r.ends_on || 'Ongoing' }}</td>
            <td style="white-space:nowrap"><button class="s" (click)="editR(r)">Edit</button>
              @if (!r.ends_on) { <button class="s" (click)="stopR(r)">Stop</button> }</td></tr>
        } @empty { <tr><td colspan="7">None yet.</td></tr> }
      </table></div>
      <div class="row">
        <div><label>Name *</label><input [(ngModel)]="r.name" placeholder="e.g. Shop rent"></div>
        <div style="flex:0 0 140px"><label>Monthly (Rs) *</label><input type="number" min="1" [(ngModel)]="r.amount"></div>
        <div style="flex:0 0 170px"><label>Type</label><select [(ngModel)]="r.category">@for (c of cats; track c) {<option>{{ c }}</option>}</select></div>
        <div style="flex:0 0 110px"><label>Due day</label><input type="number" min="1" max="28" [(ngModel)]="r.day_of_month"></div>
        <div style="flex:0 0 160px"><label>From</label><input type="date" [(ngModel)]="r.starts_on"></div>
        <div style="flex:0 0 150px"><label>Paid by</label><select [(ngModel)]="r.payment_method"><option value="cash">Cash</option><option value="upi">UPI</option>
          <option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
      </div>
      <button class="p" (click)="saveR()">{{ rId() ? 'Save regular expense' : 'Add regular expense' }}</button>
      @if (rId()) { <button class="s" style="margin-left:8px" (click)="resetR()">Cancel</button> }
    </div>
  </details>`,
})
export class Expenses implements OnInit {
  private confirm = inject(Confirm);
  private api = inject(Api);
  cats = CATS;
  month = today().slice(0, 7);
  data = signal<Month | null>(null); msg = signal(''); err = signal(false); busy = signal(false);
  editId = signal<number | null>(null); rId = signal<number | null>(null);
  f = this.blank(); r = this.blankR(); private rEnds: string | null = null;

  blank() { return { amount: null as number | null, note: '', on_date: today(), category: 'Maintenance', payment_method: 'cash' }; }
  blankR() { return { name: '', amount: null as number | null, category: 'Rent', day_of_month: 1, starts_on: today().slice(0, 8) + '01', payment_method: 'cash' }; }
  async ngOnInit() { await this.load(); }
  async load() {
    try { this.data.set(await this.api.get<Month>('/expenses', { month: this.month })); } catch (e) { this.say(errorText(e), true); }
  }
  private say(t: string, e = false) { this.msg.set(t); this.err.set(e); }

  async add() {
    if (!(await this.confirm.ask(this.editId() ? 'Save expense changes?' : 'Add this expense?', `₹${this.f.amount ?? ''} · ${this.f.note}`, 'Save', false))) return;
    if (!(Number(this.f.amount) > 0) || !this.f.note.trim()) { this.say('Enter the amount and the reason.', true); return; }
    this.busy.set(true);
    try {
      const body = { ...this.f, amount: Number(this.f.amount), note: this.f.note.trim() };
      const id = this.editId();
      if (id) await this.api.put(`/expenses/${id}`, body); else await this.api.post('/expenses', body);
      this.say(id ? 'Expense updated.' : `Added Rs ${Number(this.f.amount).toLocaleString('en-IN')} — ${this.f.note.trim()}`);
      this.month = this.f.on_date.slice(0, 7); this.reset(); await this.load();
    } catch (e) { this.say(errorText(e), true); }
    this.busy.set(false);
  }
  edit(x: Line) {
    this.editId.set(x.id); this.f = { amount: +x.amount, note: x.name ?? '', on_date: x.on_date, category: x.category, payment_method: x.payment_method ?? 'cash' };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  reset() { this.editId.set(null); const d = this.f.on_date; this.f = this.blank(); this.f.on_date = d || today(); }
  async remove(x: Line) {
    if (!(await this.confirm.ask('Delete this expense?', `₹${x.amount} · ${x.name ?? ''}`, 'Delete', true))) return;
    try { await this.api.delete(`/expenses/${x.id}`); this.say('Expense deleted.'); await this.load(); } catch (e) { this.say(errorText(e), true); }
  }

  editR(x: Regular) {
    this.rId.set(x.id); this.rEnds = x.ends_on;
    this.r = { name: x.name, amount: +x.amount, category: x.category, day_of_month: x.day_of_month, starts_on: x.starts_on, payment_method: x.payment_method ?? 'cash' };
  }
  resetR() { this.rId.set(null); this.rEnds = null; this.r = this.blankR(); }
  async saveR() {
    if (!(await this.confirm.ask('Save this regular monthly expense?', '', 'Save', false))) return;
    if (!this.r.name.trim() || !(Number(this.r.amount) > 0)) { this.say('Enter a name and a monthly amount.', true); return; }
    try {
      const body = { ...this.r, name: this.r.name.trim(), amount: Number(this.r.amount), ends_on: this.rEnds };
      const id = this.rId();
      if (id) await this.api.put(`/expenses/recurring/${id}`, body); else await this.api.post('/expenses/recurring', body);
      this.say('Regular expense saved.'); this.resetR(); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  async stopR(x: Regular) {
    const end = today();
    try {
      await this.api.put(`/expenses/recurring/${x.id}`, { ...x, ends_on: end < x.starts_on ? x.starts_on : end });
      this.say(`${x.name} stopped from today; past months keep it.`); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  async exp(ext: 'pdf' | 'xlsx') {
    try {
      const d = this.data();
      await exportTable(this.api, ext, 'Expenses', this.month, ['Date', 'Reason', 'Type', 'Paid via', 'Kind', 'Amount'],
        (d?.lines ?? []).map((x) => [x.on_date, x.name ?? '', x.category, x.payment_method ?? '', x.kind, Number(x.amount)])
          .concat([['Total', '', '', '', '', Number(d?.total ?? 0)]]));
    } catch (e) { this.say(errorText(e), true); }
  }
}
