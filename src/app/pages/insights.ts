import { fmtDt } from '../shared/dt.pipe';
import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
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
      <div style="flex:0 0 auto;display:flex;gap:8px"><button class="p" style="margin:0" (click)="file('pdf')">Download PDF</button>
        <button class="p" style="margin:0;background:var(--gold)" (click)="file('xlsx')">Export to Excel</button></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    @if (data(); as d) {
      <h2 style="margin-top:12px">{{ d.title }} <small style="color:var(--mut);font-weight:500">{{ d.rows.length }} rows</small></h2>
      <div class="wrap"><table class="plain"><tr>@for (c of d.columns; track $index) { <th class="sort" [class.num]="isNum(d, $index)" (click)="sortBy($index)">{{ c }}{{ sortCol() === $index ? (sortAsc() ? ' ▲' : ' ▼') : '' }}</th> }</tr>
        @for (r of sorted(); track $index) {
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
  sortCol = signal<number | null>(null); sortAsc = signal(true);
  sortBy(i: number) { if (this.sortCol() === i) this.sortAsc.set(!this.sortAsc()); else { this.sortCol.set(i); this.sortAsc.set(true); } }
  sorted = computed(() => {
    const d = this.data(); const i = this.sortCol(); if (!d) return [];
    if (i === null) return d.rows;
    const dir = this.sortAsc() ? 1 : -1;
    return [...d.rows].sort((a, b) => {
      const x = a[i], y = b[i];
      if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  });
  ngOnChanges() { this.sortCol.set(null); void this.load(); }
  isNum(d: Insight, i: number) { return d.rows.some((r) => typeof r[i] === 'number'); }
  show(v: unknown) { return typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? fmtDt(v) : v ?? '—'; }
  private q() { return { month: this.month, days: this.days }; }
  async load() {
    try { this.data.set(await this.api.get<Insight>(`/reports/insights/${this.kind}`, this.q())); this.err.set(''); }
    catch (e) { this.err.set(errorText(e)); }
  }
  async file(ext: 'pdf' | 'xlsx') {
    try {
      const res = await this.api.download(`/reports/insights/${this.kind}/${ext}?month=${this.month}&days=${this.days}`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = res.name || `${this.kind}.${ext}`; a.click();
    } catch (e) { this.err.set(errorText(e)); }
  }
}
