import { DtPipe } from '../shared/dt.pipe';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Payment, PaymentReport } from '../core/models';
import { today } from '../core/util';

import { exportTable } from '../shared/export';
import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-payments', imports: [DtPipe, FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}
    .settle{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card)}
    .settle span{display:block;color:var(--mut);font-size:12px;font-weight:650;text-transform:uppercase}
    .settle strong{display:block;font-size:22px;margin-top:6px}
    .method{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)}
    .refund-box{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding:12px;background:var(--bg);border-radius:10px}
  `],
  template: `
  <div class="page-head"><div><h1>Payments &amp; settlement</h1><p>Collections, receipts and refunds for the selected day.</p></div>
    <div style="display:flex;gap:10px;align-items:flex-end"><div><label>Settlement date</label><input type="date" [(ngModel)]="day" (ngModelChange)="load()"></div>
      <button class="p" style="margin:0" (click)="settlementPdf()">Download settlement PDF</button></div>
  </div>
  @if (error()) { <div class="msg err">{{ error() }}</div> }
  <div class="summary">
    <div class="settle"><span>Gross received</span><strong>₹{{ summary().gross | number:'1.2-2' }}</strong></div>
    <div class="settle"><span>Refunds issued</span><strong>₹{{ summary().refunds | number:'1.2-2' }}</strong></div>
    <div class="settle"><span>Net collections</span><strong>₹{{ summary().net | number:'1.2-2' }}</strong></div>
    <div class="settle"><span>Payment activities</span><strong>{{ rows().length }}</strong></div>
  </div>
  @if (summary().methods.length) {
    <div class="card"><h2>Collection by method</h2>
      @for (m of summary().methods; track m.method) {
        <div class="method"><span>{{ methodName(m.method) }} <small>· {{ m.count }} received</small></span>
          <strong>₹{{ m.gross | number:'1.2-2' }} <small>· refunds ₹{{ m.refunds | number:'1.2-2' }}</small></strong></div>
      }
    </div>
  }
  <div class="card">
    <div class="row" style="align-items:center;justify-content:space-between"><h2 style="display:flex;align-items:center;gap:8px">Payment ledger <span style="display:inline-flex;gap:6px;margin-left:auto"><button class="s" (click)="exp('pdf')">PDF</button><button class="s" (click)="exp('xlsx')">Excel</button></span></h2>
      <button class="s" (click)="load()" [disabled]="loading()">{{ loading() ? 'Loading...' : 'Refresh' }}</button></div>
    <div class="wrap"><table>
      <tr><th>Type</th><th>Time</th><th>Customer</th><th>Appointment</th><th>Method</th><th class="num">Amount</th><th>Reference / note</th><th></th></tr>
      @for (p of rows(); track (p.event_type || 'payment') + '-' + p.id) {
        <tr><td><span class="badge">{{ p.event_type === 'refund' ? 'Refund' : 'Payment' }}</span>
            @if (p.event_type !== 'refund') { <small>SP-{{ (p.payment_id || p.id).toString().padStart(6,'0') }}</small> }
          </td>
          <td>{{ p.received_at | date:'shortTime' }}</td>
          <td>{{ p.customer }}<br><small>{{ p.phone }}</small></td>
          <td>#{{ p.appointment_id }} · {{ p.start_at | dt }}</td>
          <td>{{ methodName(p.method) }}</td>
          <td class="num"><strong>{{ p.event_type === 'refund' ? '− ' : '' }}{{ p.amount | number:'1.2-2' }}</strong></td>
          <td>{{ p.reference || p.note || '—' }}</td>
          <td style="white-space:nowrap"><button class="s" (click)="receipt(p)">{{ p.event_type === 'refund' ? 'Original receipt' : 'Receipt' }}</button>
            @if (p.event_type !== 'refund' && auth.isAdmin() && p.amount > p.refunded_amount && refundId() !== p.id) {
              <button class="s" (click)="beginRefund(p)">Refund</button>
            }</td></tr>
        @if (refundId() === p.id) {
          <tr class="detail"><td colspan="8">
            <div class="refund-box">
              <div><label>Refund amount (max ₹{{ (p.amount-p.refunded_amount) | number:'1.2-2' }})</label>
                <input type="number" min="0.01" step="0.01" [max]="p.amount-p.refunded_amount" [(ngModel)]="refundAmount"></div>
              <div><label>Reason (optional)</label><input [(ngModel)]="refundReason" maxlength="500"></div>
              <div style="display:flex;gap:8px;align-items:end"><button class="p" (click)="refund(p)">Confirm refund</button>
                <button class="s" (click)="refundId.set(null)">Cancel</button></div>
            </div>
          </td></tr>
        }
      } @empty { <tr><td colspan="8">No payments were received on this date.</td></tr> }
    </table></div>
  </div>
  `,
})
export class Payments implements OnInit {
  private confirm = inject(Confirm);
  private api = inject(Api);
  auth = inject(Auth);
  day = today();
  rows = signal<Payment[]>([]);
  report = signal<PaymentReport | null>(null);
  loading = signal(false);
  error = signal('');
  refundId = signal<number | null>(null);
  refundAmount: number | null = null;
  refundReason = '';

  summary() {
    const r = this.report();
    if (r) return r;
    const gross = this.rows().reduce((n,p)=>n+Number(p.amount),0);
    const refunds = this.rows().reduce((n,p)=>n+Number(p.refunded_amount),0);
    return { date:this.day, gross, refunds, net:gross-refunds, methods:[] as PaymentReport['methods'] };
  }

  ngOnInit() { return this.load(); }

  async settlementPdf() {
    try {
      const res = await this.api.download('/payments/settlement/pdf?received_on=' + this.day);
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob);
      a.download = res.name || `settlement_${this.day}.pdf`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.error.set(errorText(e)); }
  }
  async load() {
    this.loading.set(true);
    try {
      const [rows, report] = await Promise.all([
        this.api.get<Payment[]>('/payments', { received_on:this.day }),
        this.api.get<PaymentReport>('/payments/settlement', { received_on:this.day }),
      ]);
      this.rows.set(rows);
      this.report.set(report);
      this.error.set('');
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  methodName(method: string) {
    return ({cash:'Cash',upi:'UPI',card:'Card',bank_transfer:'Bank transfer',other:'Other'} as Record<string,string>)[method] ?? method;
  }

  beginRefund(p: Payment) {
    this.refundId.set(p.id);
    this.refundAmount = Number(p.amount)-Number(p.refunded_amount);
    this.refundReason = '';
  }

  async refund(p: Payment) {
    if (!(await this.confirm.ask('Refund this payment?', 'This cannot be undone from here.', 'Refund', true))) return;
    try {
      if (!(Number(this.refundAmount)>0)) throw new Error('Enter a refund amount greater than zero.');
      await this.api.post('/payments/'+p.id+'/refunds',{amount:Number(this.refundAmount),reason:this.refundReason.trim()||null});
      this.refundId.set(null);
      await this.load();
    } catch (e) { this.error.set(errorText(e)); }
  }

  async receipt(p: Payment) {
    try {
      const blob = await this.api.blob('/payments/'+(p.payment_id || p.id)+'/receipt');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url;
      a.download = 'receipt_SP-'+(p.payment_id || p.id).toString().padStart(6,'0')+'.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { this.error.set(errorText(e)); }
  }
  async exp(ext: 'pdf' | 'xlsx') {
    try {
      await exportTable(this.api, ext, 'Payments', this.day, ['Type', 'Time', 'Customer', 'Method', 'Amount', 'Reference / note'],
        this.rows().map((p) => {
          const x = p as unknown as Record<string, unknown>;
          return [x['event_type'] === 'refund' ? 'Refund' : 'Payment', String(x['received_at'] ?? x['refunded_at'] ?? '').replace('T', ' ').slice(0, 16),
            x['customer'] ?? '', x['method'] ?? '', Number(x['amount'] ?? 0), x['reference'] ?? x['reason'] ?? x['note'] ?? ''];
        }));
    } catch (e) { this.error.set(errorText(e)); }
  }
}
