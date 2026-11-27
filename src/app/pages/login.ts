import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorText } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login', imports: [FormsModule, RouterLink],
  template: `
  <form class="card" style="max-width:340px;margin:12vh auto" (ngSubmit)="go()">
    <h2>StudioDesk</h2><p class="hint" style="margin-top:-6px">Sign in to manage bookings, customers and payroll.</p>
    <label>Username</label><input name="u" [(ngModel)]="username" autocomplete="username">
    <label>Password</label><input name="p" type="password" [(ngModel)]="password" autocomplete="current-password">
    <button class="p" [disabled]="busy()">Sign in</button>
    @if (error()) { <div class="msg err">{{ error() }}</div> }
    <p class="hint" style="margin-top:14px;text-align:center">New spa? <a routerLink="/signup">Start a free trial</a></p>
  </form>`,
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);
  username = ''; password = '';
  busy = signal(false); error = signal('');

  async go() {
    this.busy.set(true); this.error.set('');
    try { await this.auth.login(this.username, this.password); await this.router.navigateByUrl('/'); }
    catch (e) { this.error.set(errorText(e)); }
    finally { this.busy.set(false); }
  }
}
