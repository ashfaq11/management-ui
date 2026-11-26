import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { User } from '../core/models';

@Component({
  selector: 'app-users', imports: [FormsModule],
  template: `
  <div class="card"><h2>Staff accounts</h2>
    <div class="wrap"><table><tr><th>Username</th><th>Role</th><th>Active</th><th></th></tr>
    @for (u of users(); track u.id) {
      <tr><td>{{ u.username }} @if (u.id === auth.me()?.id) { <span class="badge">you</span> }</td>
        <td><select [ngModel]="u.role" (ngModelChange)="update(u, $event, !!u.is_active)" [disabled]="u.id === auth.me()?.id">
          <option value="staff">staff</option><option value="admin">admin</option></select></td>
        <td><input type="checkbox" style="width:auto" [checked]="!!u.is_active" [disabled]="u.id === auth.me()?.id"
              (change)="update(u, u.role, !u.is_active)"></td>
        <td>
          @if (resetId() === u.id) {
            <input type="password" placeholder="New password (8+)" style="width:170px" [(ngModel)]="newPw">
            <button class="s" (click)="reset(u)">Set</button> <button class="s" (click)="resetId.set(null)">Cancel</button>
          } @else { <button class="s" (click)="startReset(u)">Reset password</button> }
        </td></tr>
    }</table></div>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <p style="font-size:12px;color:var(--mut)">Admins can do everything. Staff can use customers, onboarding and appointments only.
      Deactivating an account or resetting its password signs that person out immediately.</p>
  </div>
  <div class="card"><h2>Add user</h2>
    <div class="row">
      <div><label>Username (3+)</label><input name="nu" autocomplete="off" [(ngModel)]="nu"></div>
      <div><label>Password (8+)</label><input type="password" name="np" autocomplete="new-password" [(ngModel)]="np"></div>
      <div><label>Role</label><select [(ngModel)]="nr"><option value="staff">staff</option><option value="admin">admin</option></select></div>
    </div>
    <button class="p" (click)="add()">Create user</button>
  </div>`,
})
export class Users implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  users = signal<User[]>([]); msg = signal(''); isErr = signal(false); resetId = signal<number | null>(null);
  nu = ''; np = ''; nr: 'staff' | 'admin' = 'staff'; newPw = '';

  ngOnInit() { return this.load(); }
  async load() { this.users.set(await this.api.get<User[]>('/users')); }
  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }

  async add() {
    try {
      await this.api.post('/users', { username: this.nu.trim(), password: this.np, role: this.nr });
      this.say(`Created ${this.nu.trim()}`); this.nu = ''; this.np = ''; this.nr = 'staff'; await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  async update(u: User, role: string, active: boolean) {
    try { await this.api.put(`/users/${u.id}`, { role, is_active: active }); this.say(`Updated ${u.username}`); }
    catch (e) { this.say(errorText(e), true); }
    await this.load();
  }
  startReset(u: User) { this.newPw = ''; this.resetId.set(u.id); }
  async reset(u: User) {
    try {
      await this.api.post(`/users/${u.id}/password`, { password: this.newPw });
      this.say(`Password reset for ${u.username}; they have been signed out`); this.resetId.set(null);
    } catch (e) { this.say(errorText(e), true); }
  }
}
