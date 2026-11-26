import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-account', imports: [FormsModule],
  template: `
  <form class="card" style="max-width:380px" (ngSubmit)="save()">
    <h2>Change my password</h2>
    <p style="margin:0;color:var(--mut)">Signed in as {{ auth.me()?.username }}</p>
    <label>Current password</label><input type="password" name="c" autocomplete="current-password" [(ngModel)]="cur">
    <label>New password (8+ characters)</label><input type="password" name="n" autocomplete="new-password" [(ngModel)]="next">
    <label>Repeat new password</label><input type="password" name="r" autocomplete="new-password" [(ngModel)]="again">
    <button class="p">Change password</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <p style="font-size:12px;color:var(--mut)">Your other signed-in devices are signed out; this one stays signed in.</p>
  </form>`,
})
export class Account {
  private api = inject(Api);
  auth = inject(Auth);
  cur = ''; next = ''; again = ''; msg = signal(''); isErr = signal(false);

  async save() {
    try {
      if (this.next !== this.again) throw new Error('The new passwords do not match');
      await this.api.post('/auth/password', { current_password: this.cur, new_password: this.next });
      this.msg.set('Password changed'); this.isErr.set(false); this.cur = this.next = this.again = '';
    } catch (e) { this.msg.set(errorText(e)); this.isErr.set(true); }
  }
}
