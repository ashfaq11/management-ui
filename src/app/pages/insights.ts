import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';

interface Insight { title: string; columns: string[]; rows: (string | number | null)[][]; total?: (string | number)[]; from: string; to: string; }

/** One report tab: any of the backend's insight reports, shown as a table with Excel export. */
@Component({
  selector: 'app-insights', imports: [FormsModule],
  template: `
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div style="flex:0 0 180px"><label>Month</label><input type="month" [(ngModel)]="month" (change)="load()"></div>
      @if (kind === 'lapsed' || kind === 'expiring') {
        <div style="flex:0 0 160px"><label>{{ kind === 'lapsed' ? 'Not seen for (days)' : 'Expiring within (days)' }}</label>
          <input type="number" min="1" max="365" [(ngModel)]="days" (change)="load()"></div>
      }
      <div style="flex:0 0 auto"><button class="p" style="margin:0;background:var(--gold)" (click)="excel()">Export to Excel</button></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    @if (data(); as d) {
      <h2 style="margin-top:12px">{{ d.title }} <small style="color:var(--mut);font-weight:500">{{ d.rows.length }} rows</small></h2>
      <div class="wrap"><table><tr>@for (c of d.columns; track $index) { <th [class.num]="isNum(d, $index)">{{ c }}</th> }</tr>
        @for (r of d.rows; track $index) {
          <tr>@for (v of r; track $index) { <td [class.num]="typeof(v) === 'number'">{{ show(v) }}</td> }</tr>
        } @empty { <tr><td [attr.colspan]="d.columns.length">Nothing to show for this period.</td></tr> }
        @if (d.total) { <tr>@for (v of d.total; track $index) { <th [class.num]="typeof(v) === 'number'">{{ show(v) }}</th> }</tr> }
      </table></div>
    }
  </div>`,
})
export class Insights implements OnChanges {
  @Input() kind = 'therapists';
  private api = inject(Api);
  data = signal<Insight | null>(null); err = signal('');
  month = new Date().toISOString().slice(0, 7); days = 30;
  typeof(v: unknown) { return typeof v; }
  ngOnChanges() { void this.load(); }
  isNum(d: Insight, i: number) { return d.rows.some((r) => typeof r[i] === 'number'); }
  show(v: unknown) { return typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : v ?? '—'; }
  private q() { return { month: this.month, days: this.days }; }
  async load() {
    try { this.data.set(await this.api.get<Insight>(`/reports/insights/${this.kind}`, this.q())); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async excel() {
    try {
      const res = await this.api.download(`/reports/insights/${this.kind}/xlsx?month=${this.month}&days=${this.days}`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = res.name || `${this.kind}.xlsx`; a.click();
    } catch (e) { this.err.set(errorText(e)); }
  }
}
