import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Spa } from '../core/models';

@Component({
  selector: 'app-shell', imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    header{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#2f5d50 0%,#24493f 60%,#1d3b33 100%);color:#fff;
      box-shadow:0 4px 18px rgba(0,0,0,.16)}
    .top{display:flex;align-items:center;gap:10px;max-width:1120px;margin:0 auto;padding:12px 16px 4px}
    .brand{font-weight:700;font-size:17px;letter-spacing:.01em;display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none}
    .brand i{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.16);
      font-style:normal;font-size:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
    .brand small{display:block;font-size:11px;font-weight:500;opacity:.75;color:#fff;letter-spacing:.04em;text-transform:uppercase}
    .sp{flex:1}
    select.spa{width:auto;min-height:34px;max-width:200px;padding:5px 30px 5px 10px;border-radius:9px;font-size:13px;
      background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3)}
    select.spa option{color:#1f2a27}
    .me{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-size:13px;padding:4px 10px 4px 4px;border-radius:99px}
    .me:hover{background:rgba(255,255,255,.12)}
    .me b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fff;color:#2f5d50;font-size:13px}
    .me span{line-height:1.15}.me em{display:block;font-style:normal;font-size:11px;opacity:.75;text-transform:capitalize}
    .out{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:6px 12px;font-size:13px}
    .out:hover{background:rgba(255,255,255,.12)}
    nav{display:flex;gap:4px;overflow-x:auto;max-width:1120px;margin:0 auto;padding:6px 12px 10px;scrollbar-width:none}
    nav::-webkit-scrollbar{display:none}
    nav a{color:#fff;opacity:.82;text-decoration:none;padding:8px 14px;border-radius:99px;white-space:nowrap;font-size:14px;
      transition:background .15s,opacity .15s}
    nav a:hover{opacity:1;background:rgba(255,255,255,.1)}
    nav a.on{opacity:1;background:#fff;color:#2f5d50;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.12)}
    .sep{width:1px;background:rgba(255,255,255,.25);margin:6px 4px}
    main{max-width:1120px;margin:0 auto;padding:20px 16px 48px;animation:rise .25s ease-out}
    @media(max-width:620px){.me span,.brand small{display:none}}`],
  template: `
  <header>
    <div class="top">
      <a class="brand" routerLink="/"><i>&#10047;</i><span>{{ auth.spaName() || 'Spa Manager' }}
        @if (auth.isSuper()) { <small>Super admin</small> }</span></a>
      <span class="sp"></span>
      @if (auth.isSuper() && spas().length) {
        <select class="spa" aria-label="Working in spa" (change)="pick($any($event.target).value)">
          <option value="">All spas…</option>
          @for (s of spas(); track s.id) { @if (s.is_active) { <option [value]="s.id" [selected]="auth.pick()?.id === s.id">{{ s.name }}</option> } }
        </select>
      }
      <a class="me" routerLink="/account" title="My account"><b>{{ initial() }}</b>
        <span>{{ auth.me()?.username }}<em>{{ auth.me()?.role }}</em></span></a>
      <button class="out" (click)="auth.logout()">Logout</button>
    </div>
    <nav>
      @if (auth.isSuper()) { <a routerLink="/spas" routerLinkActive="on">Spas</a><span class="sep"></span> }
      @if (auth.hasSpa()) {
        <a routerLink="/dashboard" routerLinkActive="on">Dashboard</a>
        <a routerLink="/appointments" routerLinkActive="on">Appointments</a>
        <a routerLink="/payments" routerLinkActive="on">Payments</a>
        <a routerLink="/onboarding" routerLinkActive="on">New customer</a>
        <a routerLink="/customers" routerLinkActive="on">Customers</a>
        @if (auth.isAdmin()) {
          <a routerLink="/staff" routerLinkActive="on">Team &amp; shifts</a>
          <a routerLink="/reports" routerLinkActive="on">Reports</a>
          <a routerLink="/payroll" routerLinkActive="on">Payroll</a>
        }
      }
      @if (auth.isAdmin()) { <a routerLink="/users" routerLinkActive="on">Users</a> }
    </nav>
  </header>
  <main><router-outlet /></main>`,
})
export class Shell implements OnInit {
  auth = inject(Auth); private api = inject(Api); private router = inject(Router);
  spas = signal<Spa[]>([]);
  initial = computed(() => (this.auth.me()?.username ?? '?').charAt(0).toUpperCase());

  constructor() {
    // a superadmin lands on Spas until one is opened
    effect(() => { if (this.auth.isSuper() && !this.auth.pick() && (this.router.url === '/appointments' || this.router.url === '/dashboard')) this.router.navigateByUrl('/spas'); });
  }
  async ngOnInit() { if (this.auth.isSuper()) this.spas.set(await this.api.get<Spa[]>('/spas')); }
  pick(v: string) {
    const s = this.spas().find((x) => x.id === +v);
    this.auth.choose(s ? { id: s.id, name: s.name } : null);
    this.router.navigateByUrl(s ? '/appointments' : '/spas').then(() => { if (s) location.reload(); });
  }
}
