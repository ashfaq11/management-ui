import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-shell', imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`header{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 16px;background:var(--acc);color:#fff}
    a{color:#fff;text-decoration:none;padding:8px 10px;border-radius:6px}a.on{background:rgba(255,255,255,.22)}
    .sp{flex:1}main{max-width:1000px;margin:0 auto;padding:16px}button{color:#fff;border-color:#fff8}`],
  template: `
  <header>
    <b style="margin-right:12px">Spa Manager</b>
    <a routerLink="/appointments" routerLinkActive="on">Appointments</a>
    <a routerLink="/onboarding" routerLinkActive="on">New customer</a>
    <a routerLink="/customers" routerLinkActive="on">Customers</a>
    @if (auth.isAdmin()) {
      <a routerLink="/staff" routerLinkActive="on">Therapists &amp; services</a>
      <a routerLink="/reports" routerLinkActive="on">Reports</a>
      <a routerLink="/payroll" routerLinkActive="on">Payroll</a>
    }
    <span class="sp"></span><span>{{ auth.me()?.username }} ({{ auth.me()?.role }})</span>
    <button class="s" (click)="auth.logout()">Logout</button>
  </header>
  <main><router-outlet /></main>`,
})
export class Shell { auth = inject(Auth); }
