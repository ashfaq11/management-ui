import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-shell', imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    header{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#2f5d50,#24493f);color:#fff;
      box-shadow:0 2px 12px rgba(0,0,0,.15)}
    .top{display:flex;align-items:center;gap:10px;max-width:1080px;margin:0 auto;padding:12px 16px 4px}
    .brand{font-weight:700;font-size:17px;letter-spacing:.01em;display:flex;align-items:center;gap:8px}
    .brand i{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.16);
      font-style:normal;font-size:16px}
    .sp{flex:1}
    .me{color:#fff;opacity:.9;text-decoration:none;font-size:13px;padding:6px 10px;border-radius:8px}
    .me:hover{background:rgba(255,255,255,.12)}
    button{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:9px;padding:6px 12px;
      font:inherit;font-size:13px;cursor:pointer}
    button:hover{background:rgba(255,255,255,.12)}
    nav{display:flex;gap:4px;overflow-x:auto;max-width:1080px;margin:0 auto;padding:6px 12px 10px;scrollbar-width:none}
    nav::-webkit-scrollbar{display:none}
    nav a{color:#fff;opacity:.85;text-decoration:none;padding:8px 14px;border-radius:99px;white-space:nowrap;font-size:14px}
    nav a:hover{opacity:1;background:rgba(255,255,255,.1)}
    nav a.on{opacity:1;background:#fff;color:#2f5d50;font-weight:600}
    main{max-width:1080px;margin:0 auto;padding:18px 16px 40px}`],
  template: `
  <header>
    <div class="top">
      <span class="brand"><i>&#10047;</i>Spa Manager</span>
      <span class="sp"></span>
      <a class="me" routerLink="/account">{{ auth.me()?.username }} &middot; {{ auth.me()?.role }}</a>
      <button (click)="auth.logout()">Logout</button>
    </div>
    <nav>
      <a routerLink="/appointments" routerLinkActive="on">Appointments</a>
      <a routerLink="/onboarding" routerLinkActive="on">New customer</a>
      <a routerLink="/customers" routerLinkActive="on">Customers</a>
      @if (auth.isAdmin()) {
        <a routerLink="/staff" routerLinkActive="on">Therapists &amp; services</a>
        <a routerLink="/reports" routerLinkActive="on">Reports</a>
        <a routerLink="/payroll" routerLinkActive="on">Payroll</a>
        <a routerLink="/users" routerLinkActive="on">Users</a>
      }
    </nav>
  </header>
  <main><router-outlet /></main>`,
})
export class Shell { auth = inject(Auth); }
