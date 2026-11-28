import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { SpaProfileForm, blankProfile, profileBody, profileMissing } from '../shared/spa-profile-form';

@Component({
  selector: 'app-signup', imports: [FormsModule, RouterLink, SpaProfileForm],
  template: `
  <form class="card" style="max-width:760px;margin:5vh auto" (ngSubmit)="go()">
    <h2>Start your free trial</h2>
    <p class="hint" style="margin-top:-6px">{{ days() }} days free, no card needed. You get your own spa and an admin login.</p>
    @if (closed()) { <div class="msg err">Sign-up is closed right now. Please contact us.</div> }
    <label>Spa name *</label><input name="s" [(ngModel)]="f.spa_name" placeholder="e.g. Lotus Wellness">
    <label>Your username *</label><input name="u" [(ngModel)]="f.username" autocomplete="username">
    <label>Password * (8+ characters, letters and numbers)</label><input name="p" type="password" [(ngModel)]="f.password" autocomplete="new-password">
    <label>Repeat password *</label><input name="p2" type="password" [(ngModel)]="password2" autocomplete="new-password">
    @if (password2 && password2 !== f.password) { <small style="color:var(--bad,#c33)">Passwords do not match</small> }
    <h3 style="margin-top:14px">Spa details</h3>
    <app-spa-profile-form [(profile)]="prof" />
    <button class="p" [disabled]="busy() || closed()">Create my spa</button>
    @if (error()) { <div class="msg err">{{ error() }}</div> }
    <p class="hint" style="margin-top:14px;text-align:center">Already have an account? <a routerLink="/login">Sign in</a></p>
  </form>`,
})
export class Signup implements OnInit {
  private auth = inject(Auth); private api = inject(Api); private router = inject(Router);
  f = { spa_name: '', username: '', password: '' }; password2 = '';
  prof = blankProfile();
  busy = signal(false); error = signal(''); days = signal(30); closed = signal(false);
  async ngOnInit() {
    try { const c = await this.api.get<{ trial_days: number; allow_signup: boolean }>('/platform/contact'); this.days.set(c.trial_days); this.closed.set(!c.allow_signup); }
    catch { /* defaults */ }
  }
  async go() {
    const miss = profileMissing(this.prof);
    if (miss.length) { this.error.set('Please fill: ' + miss.join(', ')); return; }
    if (this.f.password.length < 8 || !/[A-Za-z]/.test(this.f.password) || !/\d/.test(this.f.password)) {
      this.error.set('Password needs at least 8 characters with letters and numbers.'); return; }
    if (this.f.password !== this.password2) { this.error.set('The two passwords do not match.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.register({ ...this.f, ...profileBody(this.prof) });
      await this.router.navigateByUrl('/');
    } catch (e) { this.error.set(errorText(e)); } finally { this.busy.set(false); }
  }
}
