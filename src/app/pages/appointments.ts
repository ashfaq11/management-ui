import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Appointment, Customer, CustomerPlan, PaymentMethod, STATUSES, Service, Status, Therapist } from '../core/models';
import { WhenPicker } from '../shared/when-picker';
import { today } from '../core/util';

@Component({
  selector: 'app-appointments', imports: [FormsModule, DecimalPipe, WhenPicker],
  styles: [`
    .cal-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .cal-toolbar .spacer{flex:1}
    .mode-switch{display:flex;gap:4px;background:var(--bg);padding:4px;border-radius:10px}
    .mode-switch button{border:0;background:transparent;border-radius:8px;padding:7px 12px;color:var(--mut)}
    .mode-switch button.active{background:var(--card);color:var(--acc);font-weight:700;box-shadow:var(--shadow)}
    .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
    .cal-cell{min-width:0;min-height:105px;padding:7px;border:1px solid var(--line);border-radius:10px;background:var(--card);cursor:pointer}
    .cal-cell.today{border-color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc)}
    .cal-cell.selected{background:var(--acc-soft)}
    .cal-cell.muted{opacity:.48}
    .cal-date{font-weight:750;font-size:12px;display:flex;justify-content:space-between;gap:3px}
    .cal-item{display:block;font-size:10px;line-height:1.3;margin-top:5px;padding:3px 5px;border-radius:5px;background:var(--acc-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cal-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
    .cal-week>section{min-width:0;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--card)}
    .cal-week h4{font-size:12px;margin:0 0 8px;color:var(--mut)}
    .cal-week .cal-item{font-size:11px;white-space:normal}
    .collection{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end}
    @media(max-width:760px){.cal-cell{min-height:74px;padding:4px}.cal-item{font-size:9px}.cal-week{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `],
  template: `
  <div class="card"><h2>{{ editId() ? "Edit appointment #" + editId() : "Book appointment" }}</h2>
    <div class="grid">
      <div><label>Customer</label><select name="c" [(ngModel)]="f.customer_id">
        @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.name }} - {{ c.phone }}</option> }</select></div>
      <div><label>Therapist</label><select [(ngModel)]="f.therapist_id">
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></div>
      <div><label>Service</label><select [(ngModel)]="f.service_id">
        @for (s of services(); track s.id) { <option [ngValue]="s.id">{{ s.name }} (Rs {{ s.price }})</option> }</select></div>
      <div><label>{{ editId() ? "Price (blank = keep, or list price if service changed)" : "Price override (optional)" }}</label><input type="number" min="0" [(ngModel)]="f.price"></div>
      <div><label>Duration (min) &middot; blank = {{ editId() ? "keep" : "service default " + serviceMinutes() }}</label>
        <input type="number" min="5" max="720" step="5" [(ngModel)]="f.duration_min"
          [placeholder]="'' + serviceMinutes()">
        <div class="chips">@for (m of [30, 60, 90, 120]; track m) {<button type="button" [class.on]="f.duration_min === m" (click)="f.duration_min = m">{{ m }} min</button>}</div></div>
      <div><label>Notes</label><input [(ngModel)]="f.notes"></div>
    </div>
    <app-when-picker [(value)]="f.start_at" [(selectionValid)]="slotValid"
      [therapistId]="f.therapist_id" [durationMin]="duration()" [excludeId]="editId()" />
    <button class="p" style="margin-top:10px" [disabled]="!slotValid" (click)="save()">{{ editId() ? "Save changes" : "Book" }}</button>
    @if (editId()) { <button class="s" style="margin-left:8px" (click)="cancelEdit()">Cancel</button> }
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
  </div>
  @if (pendingCompletion(); as pending) {
    <div class="card">
      <h2>Complete appointment #{{ pending.id }}</h2>
      <p>{{ pending.customer }} · {{ pending.service }} · {{ pending.duration_min }} min · Rs {{ pending.price | number: '1.2-2' }}</p>
      @if (pendingLoading()) {
        <p>Loading customer plan balances...</p>
      } @else {
        <div class="grid">
          <div>
            <label>Hours wallet balance</label>
            <h2>{{ availableBalance('hours') | number: '1.2-2' }} hrs</h2>
            <p>Required for this appointment: {{ hoursNeeded(pending) | number: '1.2-2' }} hrs</p>
            @for (p of plansByType('hours'); track p.id) {
              <small>{{ p.name }}: {{ p.balance | number: '1.2-2' }} hrs</small><br>
            }
            <button class="p" [disabled]="!canDeduct('hours', pending) || (pending.paid_amount ?? 0) > 0" (click)="completeWith('hours')">Deduct hours</button>
            @if (!canDeduct('hours', pending)) { <small>No single active hours plan has enough balance.</small> }
          </div>
          <div>
            <label>Rupees wallet balance</label>
            <h2>Rs {{ availableBalance('rupees') | number: '1.2-2' }}</h2>
            <p>Required for this appointment: Rs {{ rupeesNeeded(pending) | number: '1.2-2' }}</p>
            @for (p of plansByType('rupees'); track p.id) {
              <small>{{ p.name }}: Rs {{ p.balance | number: '1.2-2' }}</small><br>
            }
            <button class="p" [disabled]="!canDeduct('rupees', pending) || (pending.paid_amount ?? 0) > 0" (click)="completeWith('rupees')">Deduct rupees</button>
            @if (!canDeduct('rupees', pending)) { <small>No single active rupees plan has enough balance.</small> }
          </div>
        </div>
        @if ((pending.paid_amount ?? 0) > 0) { <small class="shift-warn">A payment has already been recorded for this appointment. Refund it before using a prepaid plan.</small> }
        <small>The oldest eligible plan with enough balance will be used. Balances are not mixed between hours and rupees.</small>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="s" (click)="completeWith(null)">Complete without plan deduction</button>
          <button class="s" (click)="cancelCompletion()">Cancel</button>
        </div>
      }
      @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    </div>
  }
  @if (collecting(); as a) {
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center"><h2>Collect payment · Appointment #{{ a.id }}</h2>
        <button class="s" (click)="cancelPayment()">Close</button></div>
      <p>{{ a.customer }} · {{ a.service }} · Outstanding ₹{{ a.balance_due | number:'1.2-2' }}</p>
      <div class="collection">
        <div><label>Amount received (INR)</label><input type="number" min="0.01" step="0.01" [max]="a.balance_due" [(ngModel)]="paymentAmount"></div>
        <div><label>Payment method</label><select [(ngModel)]="paymentMethod">
          <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
        <div><label>Transaction reference (optional)</label><input [(ngModel)]="paymentReference" maxlength="120"></div>
        <div><label>Note (optional)</label><input [(ngModel)]="paymentNote" maxlength="500"></div>
      </div>
      <button class="p" [disabled]="!canSavePayment() || savingPayment()"
        (click)="savePayment()">{{ savingPayment() ? 'Saving...' : 'Record payment & create receipt' }}</button>
      @if (paymentError()) { <div class="msg err">{{ paymentError() }}</div> }
    </div>
  }
  <div class="card">
    <div class="cal-toolbar">
      <div class="mode-switch">
        <button type="button" [class.active]="calendarMode() === 'day'" (click)="setMode('day')">Day</button>
        <button type="button" [class.active]="calendarMode() === 'week'" (click)="setMode('week')">Week</button>
        <button type="button" [class.active]="calendarMode() === 'month'" (click)="setMode('month')">Month</button>
      </div>
      <button class="s" (click)="movePeriod(-1)" aria-label="Previous period">&lsaquo;</button>
      <strong>{{ periodLabel() }}</strong>
      <button class="s" (click)="movePeriod(1)" aria-label="Next period">&rsaquo;</button>
      <button class="s" (click)="goToday()">Today</button>
      <span class="spacer"></span>
      <select style="max-width:200px" [(ngModel)]="therapistFilter" (ngModelChange)="load()">
        <option [ngValue]="null">All therapists</option>
        @for (t of therapists(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
      </select>
    </div>
    @if (calendarMode() === 'month') {
      <div class="cal-grid">
        @for (w of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; track w) { <div class="cal-date" style="color:var(--mut);padding:4px">{{ w }}</div> }
        @for (d of calendarDays(); track d) {
          <div class="cal-cell" [class.today]="d === todayStr()" [class.selected]="d === day()" [class.muted]="d.slice(0,7) !== day().slice(0,7)"
            (click)="selectDay(d)">
            <div class="cal-date"><span>{{ dayNumber(d) }}</span><span>{{ appointmentsFor(d).length || '' }}</span></div>
            @for (a of appointmentsFor(d).slice(0,3); track a.id) {
              <span class="cal-item">{{ a.start_at.slice(11,16) }} {{ a.customer }}</span>
            }
            @if (appointmentsFor(d).length > 3) { <small>+{{ appointmentsFor(d).length-3 }} more</small> }
          </div>
        }
      </div>
    } @else if (calendarMode() === 'week') {
      <div class="cal-week">
        @for (d of calendarDays(); track d) {
          <section [class.open]="d === day()">
            <h4><button class="link" (click)="selectDay(d)">{{ weekday(d) }} · {{ dayNumber(d) }}</button></h4>
            @for (a of appointmentsFor(d); track a.id) {
              <div class="cal-item" [title]="a.customer + ' / ' + a.service">{{ a.start_at.slice(11,16) }} · {{ a.customer }}<small>{{ a.therapist }}</small></div>
            } @empty { <small>No bookings</small> }
          </section>
        }
      </div>
    } @else {
      <div class="wrap">
        @if (rows().length) {
          <table><tr><th>Time</th><th>Customer</th><th>Therapist</th><th>Service</th><th class="num">Price</th><th class="num">Paid</th><th class="num">Due</th><th>Status</th><th>Actions</th></tr>
          @for (a of rows(); track a.id) {
            <tr><td>{{ a.start_at.slice(11,16) }}</td><td>{{ a.customer }}<br><small>{{ a.phone }}</small></td>
              <td>{{ a.therapist }}</td><td>{{ a.service }}</td><td class="num">{{ a.price | number:'1.2-2' }}</td>
              <td class="num">{{ a.paid_amount || 0 | number:'1.2-2' }}</td><td class="num"><strong>{{ a.balance_due || 0 | number:'1.2-2' }}</strong></td>
              <td><select [ngModel]="a.status" (ngModelChange)="setStatus(a, $event)">
                @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select></td>
              <td style="white-space:nowrap">
                @if (a.status === 'booked') { <button class="s" (click)="edit(a)">Edit</button> }
                @if ((a.balance_due ?? 0) > 0 && (a.status === 'booked' || a.status === 'completed')) {
                  <button class="s" (click)="startPayment(a)">Collect</button>
                }
              </td></tr>
          }
          </table>
        } @else { <p>No appointments for this day.</p> }
      </div>
    }
    @if (calendarMode() !== 'day') {
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="s" (click)="calendarMode.set('day')">Open selected day · {{ day() }}</button>
      </div>
    }
    <small style="display:block;margin-top:10px">Appointments are validated against each therapist's assigned shift. Payments reduce the outstanding balance; prepaid redemptions settle the appointment separately.</small>
  </div>  </div>`,
})
export class Appointments implements OnInit {
  private api = inject(Api);
  statuses = STATUSES;
  customers = signal<Customer[]>([]); therapists = signal<Therapist[]>([]); services = signal<Service[]>([]);
  rows = signal<Appointment[]>([]); day = signal(today());
  calendarMode = signal<'day'|'week'|'month'>('day');
  therapistFilter: number | null = null;
  collecting = signal<Appointment | null>(null);
  paymentAmount: number | null = null; paymentMethod: PaymentMethod = 'cash';
  paymentReference = ''; paymentNote = ''; savingPayment = signal(false); paymentError = signal('');
  msg = signal(''); isErr = signal(false);
  editId = signal<number | null>(null);
  slotValid = false;
  pendingCompletion = signal<Appointment | null>(null);
  pendingLoading = signal(false);
  completionPlans = signal<CustomerPlan[]>([]);
  f: { customer_id?: number; therapist_id?: number; service_id?: number; start_at: string; price: number | null; duration_min: number | null; notes: string | null } =
    { start_at: '', price: null, duration_min: null, notes: null };

  async ngOnInit() {
    const [c, t, s] = await Promise.all([this.api.get<Customer[]>('/customers'),
      this.api.get<Therapist[]>('/therapists'), this.api.get<Service[]>('/services')]);
    this.customers.set(c);
    this.therapists.set(t.filter((x) => x.is_active)); this.services.set(s.filter((x) => x.is_active));
    this.f.customer_id = c[0]?.id; this.f.therapist_id = this.therapists()[0]?.id; this.f.service_id = this.services()[0]?.id;
    await this.load();
  }

  todayStr = today;
  /** The chosen service's length, so the free-time buttons fit it. */
  serviceMinutes() { return this.services().find((x) => x.id === this.f.service_id)?.duration_min ?? 60; }
  /** The length the free-time buttons must fit: the override if given, else the service's. */
  duration() { return this.f.duration_min || this.serviceMinutes(); }
  moveDay(n: number) {
    const d = new Date(this.day() + 'T12:00:00'); d.setDate(d.getDate() + n);
    this.day.set(d.toISOString().slice(0, 10)); void this.load();
  }

  async load() {
    const [from, to] = this.viewRange();
    this.rows.set(await this.api.get<Appointment[]>('/appointments', {
      from, to, therapist_id: this.therapistFilter ?? undefined,
    }));
  }

  private viewRange(): [string,string] {
    const d = new Date(this.day() + 'T12:00:00');
    if (this.calendarMode() === 'day') return [this.day(), this.day()];
    if (this.calendarMode() === 'week') {
      const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset);
      const from = d.toISOString().slice(0,10); d.setDate(d.getDate()+6);
      return [from,d.toISOString().slice(0,10)];
    }
    d.setDate(1); const offset = (d.getDay()+6)%7; d.setDate(1-offset);
    const from = d.toISOString().slice(0,10); d.setDate(d.getDate()+41);
    return [from,d.toISOString().slice(0,10)];
  }
  calendarDays(): string[] {
    const [from] = this.viewRange();
    const count = this.calendarMode() === 'month' ? 42 : 7;
    const d = new Date(from + 'T12:00:00');
    return Array.from({length:count},(_,i)=>{ const x=new Date(d); x.setDate(x.getDate()+i); return x.toISOString().slice(0,10); });
  }
  appointmentsFor(date: string) { return this.rows().filter(a=>a.start_at.slice(0,10)===date); }
  dayNumber(date: string) { return Number(date.slice(8,10)); }
  weekday(date: string) { return new Date(date+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short'}); }
  periodLabel() {
    const [from,to]=this.viewRange();
    const fmt=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    return from===to ? fmt(from) : fmt(from)+' – '+fmt(to);
  }
  async setMode(mode:'day'|'week'|'month') { this.calendarMode.set(mode); await this.load(); }
  async selectDay(date:string) { this.day.set(date); this.calendarMode.set('day'); await this.load(); }
  async goToday() { this.day.set(today()); await this.load(); }
  async movePeriod(delta:number) {
    const d=new Date(this.day()+'T12:00:00');
    d.setDate(d.getDate()+(this.calendarMode()==='month' ? 0 : 0));
    if(this.calendarMode()==='month') d.setMonth(d.getMonth()+delta,1);
    else d.setDate(d.getDate()+delta*(this.calendarMode()==='week'?7:1));
    this.day.set(d.toISOString().slice(0,10)); await this.load();
  }

  startPayment(a:Appointment) {
    this.collecting.set(a); this.paymentAmount=Number(a.balance_due ?? 0);
    this.paymentMethod=a.preferred_payment_method ?? 'cash';
    this.paymentReference=''; this.paymentNote=''; this.paymentError.set('');
  }
  cancelPayment() { this.collecting.set(null); this.paymentError.set(''); }
  canSavePayment() {
    const a=this.collecting();
    return !!a && Number(this.paymentAmount)>0 && Number(this.paymentAmount)<=Number(a.balance_due);
  }
  async savePayment() {
    const a=this.collecting(); if(!a || this.savingPayment()) return;
    if(!(Number(this.paymentAmount)>0) || Number(this.paymentAmount)>Number(a.balance_due)) {
      this.paymentError.set('Enter an amount greater than zero and no more than the outstanding balance.'); return;
    }
    this.savingPayment.set(true);
    try {
      const result=await this.api.post<{id:number;receipt_number:string;balance_due:number}>(
        '/appointments/'+a.id+'/payments',
        {amount:Number(this.paymentAmount),method:this.paymentMethod,reference:this.paymentReference.trim()||null,note:this.paymentNote.trim()||null});
      this.say('Payment recorded · '+result.receipt_number+' · remaining due ₹'+result.balance_due.toFixed(2));
      await this.api.blob('/payments/'+result.id+'/receipt').then(blob=>{
        const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url;
        link.download='receipt_'+result.receipt_number+'.pdf'; link.click(); URL.revokeObjectURL(url);
      });
      this.collecting.set(null); await this.load();
    } catch(e) { this.paymentError.set(errorText(e)); }
    finally { this.savingPayment.set(false); }
  }

  async save() {
    try {
      if (!this.f.start_at) throw new Error('Pick a date and a time');
      if (!this.slotValid) throw new Error('Choose a free appointment time within the therapist\'s assigned shift.');
      const body: Record<string, unknown> = { ...this.f };
      if (body['price'] === null || body['price'] === '') delete body['price'];
      if (!body['duration_min']) delete body['duration_min'];
      if (!body['notes']) body['notes'] = null;
      const id = this.editId();
      if (id) await this.api.put(`/appointments/${id}`, body); else await this.api.post('/appointments', body);
      this.say(id ? 'Saved' : 'Booked'); this.day.set(this.f.start_at.slice(0, 10));
      this.cancelEdit(); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }

  edit(a: Appointment) {
    this.editId.set(a.id);
    this.slotValid = false;
    this.f = { customer_id: a.customer_id, therapist_id: a.therapist_id, service_id: a.service_id,
      start_at: a.start_at, price: null, duration_min: a.duration_min, notes: a.notes ?? null };
    this.msg.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editId.set(null);
    this.slotValid = false;
    this.f = { ...this.f, start_at: '', price: null, duration_min: null, notes: null };
  }

  async setStatus(a: Appointment, status: Status) {
    if (status === 'completed') {
      await this.askCompletion(a);
      return;
    }
    try {
      await this.api.patch('/appointments/' + a.id + '/status', { status });
      this.say(status === 'cancelled' ? 'Appointment cancelled. Any active plan deduction was reversed.' : 'Status updated.');
    } catch (e) { this.say(errorText(e), true); }
    await this.load();
  }

  private async askCompletion(a: Appointment) {
    this.msg.set('');
    this.pendingCompletion.set(a);
    this.pendingLoading.set(true);
    try {
      const customer = await this.api.get<Customer>('/customers/' + a.customer_id);
      this.completionPlans.set(customer.plans ?? []);
    } catch (e) {
      this.pendingCompletion.set(null);
      this.say(errorText(e), true);
    } finally {
      this.pendingLoading.set(false);
    }
  }

  plansByType(type: 'hours' | 'rupees') {
    const currentDate = today();
    return this.completionPlans().filter((p) => p.plan_type === type && Number(p.balance) > 0
      && (!p.expires_on || p.expires_on >= currentDate));
  }

  availableBalance(type: 'hours' | 'rupees') {
    return this.plansByType(type).reduce((sum, p) => sum + Number(p.balance), 0);
  }

  hoursNeeded(a: Appointment) { return Math.round((Number(a.duration_min) / 60) * 100) / 100; }
  rupeesNeeded(a: Appointment) { return Math.round(Number(a.price) * 100) / 100; }

  canDeduct(type: 'hours' | 'rupees', a: Appointment) {
    const required = type === 'hours' ? this.hoursNeeded(a) : this.rupeesNeeded(a);
    return this.plansByType(type).some((p) => Number(p.balance) >= required);
  }

  async completeWith(type: 'hours' | 'rupees' | null) {
    const a = this.pendingCompletion();
    if (!a) return;
    if (type && !this.canDeduct(type, a)) return;
    try {
      const result = await this.api.patch<{ plan_deduction: { plan_name: string; amount: number; unit: 'hours' | 'rupees'; remaining_balance: number } | null }>(
        '/appointments/' + a.id + '/status', { status: 'completed', ...(type ? { plan_type: type } : {}) });
      const d = result.plan_deduction;
      this.say(d
        ? 'Completed. Deducted ' + d.amount.toFixed(2) + ' ' + d.unit + ' from ' + d.plan_name + '; remaining balance ' + d.remaining_balance.toFixed(2) + '.'
        : 'Appointment completed without prepaid-plan deduction.');
      this.pendingCompletion.set(null);
      this.completionPlans.set([]);
      await this.load();
    } catch (e) {
      this.say(errorText(e), true);
    }
  }

  cancelCompletion() {
    this.pendingCompletion.set(null);
    this.completionPlans.set([]);
    this.msg.set('');
  }

  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }
}
