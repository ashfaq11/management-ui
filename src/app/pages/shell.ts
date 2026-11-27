import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Spa } from '../core/models';

import { ConfirmHost } from '../shared/confirm';
@Component({
  selector: 'app-shell', imports: [ConfirmHost, RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    header{position:sticky;top:0;z-index:10;background:linear-gradient(120deg,var(--hdr1) 0%,var(--hdr2) 55%,var(--hdr3) 100%);color:#fff;
      box-shadow:0 4px 18px rgba(0,0,0,.16)}
    .top{display:flex;align-items:center;gap:10px;padding:10px 16px;min-height:58px;box-sizing:border-box}
    .brand{font-weight:700;font-size:17px;letter-spacing:.01em;display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none}
    .brand i{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.16);
      font-style:normal;font-size:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
    .brand img{width:38px;height:38px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.12);padding:3px}
    .brand small{display:block;font-size:11px;font-weight:500;opacity:.75;color:#fff;letter-spacing:.04em;text-transform:uppercase}
    .sp{flex:1}
    select.spa{width:auto;min-height:34px;max-width:200px;padding:5px 30px 5px 10px;border-radius:9px;font-size:13px;
      background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3)}
    select.spa option{color:#0f1c2e}
    .me{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-size:13px;padding:4px 10px 4px 4px;border-radius:99px}
    .me:hover{background:rgba(255,255,255,.12)}
    .me b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fff;color:#0e6e6a;font-size:13px}
    .me span{line-height:1.15}.me em{display:block;font-style:normal;font-size:11px;opacity:.75;text-transform:capitalize}
    .out{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:6px 12px;font-size:13px}
    .out:hover{background:rgba(255,255,255,.12)}
    nav{display:flex;gap:4px;overflow-x:auto;max-width:1120px;margin:0 auto;padding:6px 12px 10px;scrollbar-width:none}
    nav::-webkit-scrollbar{display:none}
    nav a{color:#fff;opacity:.82;text-decoration:none;padding:8px 14px;border-radius:99px;white-space:nowrap;font-size:14px;
      transition:background .15s,opacity .15s}
    nav a:hover{opacity:1;background:rgba(255,255,255,.1)}
    nav a.on{opacity:1;background:#fff;color:#0e6e6a;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.12)}
    .sep{width:1px;background:rgba(255,255,255,.25);margin:6px 4px}
    .layout{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:calc(100vh - 58px)}
    aside{position:sticky;top:58px;align-self:start;height:calc(100vh - 58px);overflow-y:auto;padding:12px 10px 24px;
      background:var(--card);border-right:1px solid var(--line)}
    aside .grp{margin:14px 10px 4px;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--mut)}
    aside .grp:first-child{margin-top:4px}
    aside a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:var(--ink);text-decoration:none;
      font-size:14px;transition:background .12s}
    aside a i{font-style:normal;width:20px;text-align:center;opacity:.75;font-size:14px}
    aside a:hover{background:var(--bg)}
    aside a.on{background:var(--acc-soft);color:var(--acc);font-weight:600}
    aside a.on i{opacity:1}
    .burger{display:none;background:transparent;border:0;color:#fff;font-size:22px;padding:2px 6px;min-height:auto;cursor:pointer}
    .scrim{display:none}
    main{width:100%;max-width:1180px;margin:0 auto;padding:20px 20px 48px;animation:rise .25s ease-out;min-width:0}
    @media(max-width:900px){
      .layout{grid-template-columns:1fr}
      .burger{display:block}
      aside{position:fixed;z-index:30;left:0;top:0;height:100vh;width:260px;transform:translateX(-100%);transition:transform .2s;
        box-shadow:0 10px 40px rgba(0,0,0,.25);padding-top:18px}
      aside.open{transform:none}
      .scrim{display:block;position:fixed;inset:0;z-index:25;background:rgba(10,17,26,.45)}
      main{padding:16px 16px 40px}
    }
    @media(max-width:620px){.me span,.brand small{display:none}}`],
  template: `
  <header>
    <div class="top">
      <button class="burger" aria-label="Menu" (click)="menu.set(!menu())">&#9776;</button>
      <a class="brand" routerLink="/">@if (auth.spaLogo()) { <img [src]="auth.spaLogo()" alt="Spa logo"> } @else { <i>&#10047;</i> }<span>{{ auth.spaName() || 'StudioDesk' }}
        @if (auth.isSuper()) { <small>Super admin</small> }</span></a>
      <span class="sp"></span>
      @if (auth.isSuper() && spas().length) {
        <select class="spa" aria-label="Working in spa" (change)="pick($any($event.target).value)">
          <option value="">All spas…</option>
          @for (s of spas(); track s.id) { @if (s.is_active) { <option [value]="s.id" [selected]="auth.pick()?.id === s.id">{{ s.name }}</option> } }
        </select>
      }
      <button class="out" title="Theme" (click)="cycleTheme()">{{ theme() === 'dark' ? '☾' : theme() === 'light' ? '☀' : '◐' }}</button>
      <button class="out" title="Text size" (click)="cycleSize()">{{ size() === 'normal' ? 'A' : size() === 'large' ? 'A+' : 'A++' }}</button>
      <a class="me" routerLink="/account" title="My account"><b>{{ initial() }}</b>
        <span>{{ auth.me()?.username }}<em>{{ auth.me()?.role }}</em></span></a>
      <button class="out" (click)="auth.logout()">Logout</button>
    </div>
  </header>
  <div class="layout">
  <aside [class.open]="menu()">
    @if (auth.isSuper()) { <p class="grp">Owner</p><a routerLink="/spas" routerLinkActive="on" (click)="menu.set(false)"><i>&#9638;</i>Spas</a> }
    @if (auth.hasSpa()) {
      <p class="grp">Daily</p>
      <a routerLink="/dashboard" routerLinkActive="on" (click)="menu.set(false)"><i>&#9673;</i>Dashboard</a><a routerLink="/appointments" routerLinkActive="on" (click)="menu.set(false)"><i>&#128197;</i>Appointments</a><a routerLink="/onboarding" routerLinkActive="on" (click)="menu.set(false)"><i>&#43;</i>New customer</a><a routerLink="/payments" routerLinkActive="on" (click)="menu.set(false)"><i>&#8377;</i>Payments</a>
      <p class="grp">Customers</p>
      <a routerLink="/customers" routerLinkActive="on" (click)="menu.set(false)"><i>&#128100;</i>Customers</a>
      @if (auth.isAdmin()) { <a routerLink="/members" routerLinkActive="on" (click)="menu.set(false)"><i>&#128101;</i>Customer Memberships</a> }
      @if (auth.isAdmin()) { <a routerLink="/plans" routerLinkActive="on" (click)="menu.set(false)"><i>&#127915;</i>Membership Plans</a> }
      @if (auth.isAdmin()) {
        <p class="grp">Team</p>
        <a routerLink="/staff" routerLinkActive="on" (click)="menu.set(false)"><i>&#128101;</i>Team &amp; shifts</a><a routerLink="/attendance" routerLinkActive="on" (click)="menu.set(false)"><i>&#10003;</i>Attendance</a><a routerLink="/payroll" routerLinkActive="on" (click)="menu.set(false)"><i>&#128176;</i>Payroll</a>
        <p class="grp">Business</p>
        <a routerLink="/services" routerLinkActive="on" (click)="menu.set(false)"><i>&#10047;</i>Services</a><a routerLink="/expenses" routerLinkActive="on" (click)="menu.set(false)"><i>&#128203;</i>Expenses</a><a routerLink="/reports" routerLinkActive="on" (click)="menu.set(false)"><i>&#128202;</i>Reports</a>
      }
    }
    @if (auth.isAdmin()) {
      <p class="grp">Admin</p>
      <a routerLink="/users" routerLinkActive="on" (click)="menu.set(false)"><i>&#128273;</i>Users</a>
      @if (auth.hasSpa()) { <a routerLink="/audit" routerLinkActive="on" (click)="menu.set(false)"><i>&#128270;</i>Audit log</a> }
    }
  </aside>
  @if (menu()) { <div class="scrim" (click)="menu.set(false)"></div> }
  <main><router-outlet /></main>
  <app-confirm-host />
  </div>`,
})
export class Shell implements OnInit {
  auth = inject(Auth); private api = inject(Api); private router = inject(Router);
  spas = signal<Spa[]>([]);
  menu = signal(false);
  /** Theme (auto follows the device) and text size, remembered on this device. */
  theme = signal(this.pref('sd.theme', 'auto')); size = signal(this.pref('sd.size', 'normal'));
  private pref(k: string, d: string) { try { return localStorage.getItem(k) || d; } catch { return d; } }
  private apply() {
    const r = document.documentElement;
    if (this.theme() === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', this.theme());
    r.setAttribute('data-size', this.size());
    try { localStorage.setItem('sd.theme', this.theme()); localStorage.setItem('sd.size', this.size()); } catch { /* private mode */ }
  }
  cycleTheme() { this.theme.set(({ auto: 'light', light: 'dark', dark: 'auto' } as Record<string, string>)[this.theme()]); this.apply(); }
  cycleSize() { this.size.set(({ normal: 'large', large: 'xl', xl: 'normal' } as Record<string, string>)[this.size()]); this.apply(); }
  initial = computed(() => (this.auth.me()?.username ?? '?').charAt(0).toUpperCase());

  constructor() {
    this.apply();
    // a superadmin lands on Spas until one is opened
    effect(() => { if (this.auth.isSuper() && !this.auth.pick() && (this.router.url === '/appointments' || this.router.url === '/dashboard')) this.router.navigateByUrl('/spas'); });
  }
  async ngOnInit() {
    if (this.auth.isSuper()) this.spas.set(await this.api.get<Spa[]>('/spas'));
    if (this.auth.hasSpa()) {
      try { this.auth.spaLogo.set((await this.api.get<{ logo_data_url: string | null }>('/spa/logo')).logo_data_url); }
      catch { this.auth.spaLogo.set(null); }
    }
  }
  pick(v: string) {
    const s = this.spas().find((x) => x.id === +v);
    this.auth.choose(s ? { id: s.id, name: s.name } : null);
    this.router.navigateByUrl(s ? '/appointments' : '/spas').then(() => { if (s) location.reload(); });
  }
}
