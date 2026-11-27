import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { ActivatedRoute, Router } from '@angular/router';

interface Row { id: number; at: string; username: string | null; role: string | null; action: string; method: string; path: string;
  details: Record<string, unknown> | null; ip: string | null; }

import { exportTable } from '../shared/export';
@Component({
  selector: 'app-audit', imports: [FormsModule],
  styles: [`.det{font-size:12px;color:var(--mut);max-width:420px;word-break:break-word}
    .act{font-weight:600}.m{font-size:10.5px;padding:1px 6px;border-radius:6px;background:var(--bg);color:var(--mut);margin-left:6px}`],
  template: `
  <div class="page-head"><div><h1>Audit log</h1><p>Every change: who did it, what, and when. Passwords are never stored.</p></div></div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div style="flex:2"><label>Search</label><input [(ngModel)]="q" (keyup.enter)="go(1)" placeholder="refund, price, a username…"></div>
      <div style="flex:0 0 160px"><label>Type</label><select [(ngModel)]="kind" (change)="go(1)"><option value="">Everything</option>
        @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }</select></div>
      <div style="flex:0 0 160px"><label>From</label><input type="date" [(ngModel)]="from" (change)="go(1)"></div>
      <div style="flex:0 0 160px"><label>To</label><input type="date" [(ngModel)]="to" (change)="go(1)"></div>
      <div style="flex:0 0 auto"><button class="p" style="margin:0" (click)="go(1)">Search</button></div>
    </div>
    @if (ref) { <div class="msg" style="margin-top:8px">Showing history of one record. <a href="" (click)="$event.preventDefault(); clearRef()">Show everything</a></div> }
    <div style="display:flex;margin-top:8px"><span style="display:inline-flex;gap:6px;margin-left:auto"><button class="s" (click)="exp('pdf')">PDF</button><button class="s" (click)="exp('xlsx')">Excel</button></span></div>
    @if (err()) { <div class="msg err">{{ err() }}</div> }
    <div class="wrap" style="margin-top:10px"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr>
      @for (r of rows(); track r.id) {
        <tr><td style="white-space:nowrap">{{ when(r.at) }}</td>
          <td>{{ r.username || '—' }} <small style="color:var(--mut)">{{ r.role }}</small></td>
          <td><span class="act">{{ r.action }}</span>@if ($any(r).target) { <span class="m">{{ $any(r).target }}</span> }</td>
          <td class="det">{{ summary(r.details, $any(r).names) }}</td></tr>
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
  q = ''; from = ''; to = ''; kind = ''; ref = '';
  kinds = [['bookings', 'Bookings'], ['customers', 'Customers'], ['memberships', 'Memberships'], ['payments', 'Payments'],
    ['staff', 'Staff & shifts'], ['users', 'Users & sign-ins'], ['expenses', 'Expenses'], ['settings', 'Settings']];
  private route = inject(ActivatedRoute); private router = inject(Router);
  async ngOnInit() { this.ref = this.route.snapshot.queryParamMap.get('ref') ?? ''; await this.go(1); }
  clearRef() { this.ref = ''; this.router.navigate([], { queryParams: {} }); this.go(1); }
  async go(p: number) {
    try {
      const r = await this.api.get<{ total: number; items: Row[] }>('/audit', {
        page: p, size: 50, ...(this.q.trim() ? { q: this.q.trim() } : {}), ...(this.kind ? { kind: this.kind } : {}), ...(this.ref ? { ref: this.ref } : {}), ...(this.from ? { from: this.from } : {}), ...(this.to ? { to: this.to } : {}) });
      this.rows.set(r.items); this.total.set(r.total); this.page.set(p); this.pages.set(Math.max(1, Math.ceil(r.total / 50))); this.err.set('');
    } catch (e) { this.err.set(errorText(e)); }
  }
  when(t: string) { return new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  summary(d: Record<string, unknown> | null, names: Record<string, string> = {}) {
    if (!d) return '';
    const fmt = (k: string) => k.replace(/_id$/, '').replace(/_/g, ' ');
    const ch = (d['_changes'] ?? {}) as Record<string, [string | null, string | null]>;
    const rm = d['_removed'] as Record<string, string> | undefined;
    const parts = Object.entries(ch).map(([k, [a, b]]) => `${fmt(k)}: ${a ?? '—'} → ${b ?? '—'}`);
    if (rm) parts.push('removed: ' + Object.entries(rm).slice(0, 5).map(([k, v]) => `${fmt(k)} ${v}`).join(', '));
    const rest = Object.entries(d).filter(([k]) => !(k in ch) && !k.startsWith('_'));
    if (parts.length) return parts.concat(rest.filter(([k]) => k in names).map(([k]) => `${fmt(k)}: ${names[k]}`)).join(' · ');
    return rest.filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .slice(0, 8).map(([k, v]) => k in names ? `${k.replace(/_id$/, '').replace(/_/g, ' ')}: ${names[k]}` : `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
  }
  async exp(ext: 'pdf' | 'xlsx') {
    try {
      await exportTable(this.api, ext, 'Audit log', `${this.from || 'start'} to ${this.to || 'today'}`, ['When', 'Who', 'Role', 'Action', 'Details'],
        this.rows().map((r) => [this.when(r.at), r.username ?? '', r.role ?? '', r.action + ((r as any).target ? ' · ' + (r as any).target : ''), this.summary(r.details, (r as any).names)]));
    } catch (e) { this.err.set(errorText(e)); }
  }
}
