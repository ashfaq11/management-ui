import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-signup', imports: [FormsModule, RouterLink],
  template: `
  <form class="card" style="max-width:380px;margin:8vh auto" (ngSubmit)="go()">
    <h2>Start your free trial</h2>
    <p class="hint" style="margin-top:-6px">{{ days() }} days free, no card needed. You get your own spa and an admin login.</p>
    @if (closed()) { <div class="msg err">Sign-up is closed right now. Please contact us.</div> }
    <label>Spa name *</label><input name="s" [(ngModel)]="f.spa_name" placeholder="e.g. Lotus Wellness">
    <label>Your username *</label><input name="u" [(ngModel)]="f.username" autocomplete="username">
    <label>Password * (8+ characters)</label><input name="p" type="password" [(ngModel)]="f.password" autocomplete="new-password">
    <label>Phone</label><input name="ph" [(ngModel)]="f.phone" inputmode="tel">
    <label>Email</label><input name="e" type="email" [(ngModel)]="f.email">
    <button class="p" [disabled]="busy() || closed()">Create my spa</button>
    @if (error()) { <div class="msg err">{{ error() }}</div> }
    <p class="hint" style="margin-top:14px;text-align:center">Already have an account? <a routerLink="/login">Sign in</a></p>
  </form>`,
})
export class Signup implements OnInit {
  private auth = inject(Auth); private api = inject(Api); private router = inject(Router);
  f = { spa_name: '', username: '', password: '', phone: '', email: '' };
  busy = signal(false); error = signal(''); days = signal(30); closed = signal(false);
  async ngOnInit() {
    try { const c = await this.api.get<{ trial_days: number; allow_signup: boolean }>('/platform/contact'); this.days.set(c.trial_days); this.closed.set(!c.allow_signup); }
    catch { /* defaults */ }
  }
  async go() {
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.register({ ...this.f, phone: this.f.phone || null, email: this.f.email || null });
      await this.router.navigateByUrl('/');
    } catch (e) { this.error.set(errorText(e)); } finally { this.busy.set(false); }
  }
}
