import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';

interface Row { id: number; at: string; username: string | null; role: string | null; action: string; method: string; path: string;
  details: Record<string, unknown> | null; ip: string | null; }

@Component({
  selector: 'app-audit', imports: [FormsModule],
  styles: [`.det{font-size:12px;color:var(--mut);max-width:420px;word-break:break-word}
    .act{font-weight:600}.m{font-size:10.5px;padding:1px 6px;border-radius:6px;background:var(--bg);color:var(--mut);margin-left:6px}`],
  template: `
  <div class="page-head"><div><h1>Audit log</h1><p>Every change: who did it, what, and when. Passwords are never stored.</p></div></div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div style="flex:2"><label>Search</label><input [(ngModel)]="q" (keyup.enter)="go(1)" placeholder="refund, price, a username…"></div>
      <div style="flex:0 0 160px"><label>From</label><input type="date" [(ngModel)]="from" (change)="go(1)"></div>
      <div style="flex:0 0 160px"><label>To</label><input type="date" [(ngModel)]="to" (change)="go(1)"></div>
      <div style="flex:0 0 auto"><button class="p" style="margin:0" (click)="go(1)">Search</button></div>
    </div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    <div class="wrap" style="margin-top:10px"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr>
      @for (r of rows(); track r.id) {
        <tr><td style="white-space:nowrap">{{ when(r.at) }}</td>
          <td>{{ r.username || '—' }} <small style="color:var(--mut)">{{ r.role }}</small></td>
          <td><span class="act">{{ r.action }}</span><span class="m">{{ r.path.replace('/api/', '') }}</span></td>
          <td class="det">{{ summary(r.details) }}</td></tr>
      } @empty { <tr><td colspan="4">Nothing recorded yet.</td></tr> }
    </table></div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
      <button class="s" [disabled]="page() <= 1" (click)="go(page() - 1)">Previous</button>
      <small>Page {{ page() }} of {{ pages() }} · {{ total() }} entries</small>
      <button class="s" [disabled]="page() >= pages()" (click)="go(page() + 1)">Next</button>
    </div>
  </div>`,
})
export class Audit implements OnInit {
  private api = inject(Api); auth = inject(Auth);
  rows = signal<Row[]>([]); total = signal(0); page = signal(1); pages = signal(1); err = signal('');
  q = ''; from = ''; to = '';
  async ngOnInit() { await this.go(1); }
  async go(p: number) {
    try {
      const r = await this.api.get<{ total: number; items: Row[] }>('/audit', {
        page: p, size: 50, ...(this.q.trim() ? { q: this.q.trim() } : {}), ...(this.from ? { from: this.from } : {}), ...(this.to ? { to: this.to } : {}) });
      this.rows.set(r.items); this.total.set(r.total); this.page.set(p); this.pages.set(Math.max(1, Math.ceil(r.total / 50))); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }
  when(t: string) { return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  summary(d: Record<string, unknown> | null) {
    if (!d) return '';
    return Object.entries(d).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .slice(0, 8).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
  }
}
