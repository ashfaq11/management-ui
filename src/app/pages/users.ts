import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Spa, User } from '../core/models';

import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-users', imports: [DatePipe, FormsModule],
  template: `
  <div class="page-head"><div><h1>Users</h1><p>{{ auth.isSuper() ? 'Every login across all spas.' : 'Logins for ' + auth.spaName() + '.' }}</p></div></div>
  <div class="card"><h2>Accounts</h2>
    <div class="wrap"><table><tr><th>Username</th>@if (auth.isSuper()) { <th>Spa</th><th>Last sign-in</th> }<th>Role</th><th>Active</th><th></th></tr>
    @for (u of users(); track u.id) {
      <tr><td>{{ u.username }} @if (u.id === auth.me()?.id) { <span class="badge">you</span> }</td>
        @if (auth.isSuper()) { <td>{{ u.spa ?? '—' }}</td>
          <td>{{ u.last_login_at ? (u.last_login_at | date: 'd MMM y, h:mm a') : 'Never' }}<small style="display:block;color:var(--mut)">{{ u.login_count || 0 }} sign-ins</small></td> }
        <td>@if (auth.isSuper() && u.role !== 'superadmin') {
          <select [ngModel]="u.role" (ngModelChange)="update(u, $event, !!u.is_active)">
            <option value="staff">staff</option><option value="admin">admin</option></select>
          } @else { <span class="badge" [class.gold]="u.role !== 'staff'">{{ u.role }}</span> }</td>
        <td><input type="checkbox" style="width:auto" [checked]="!!u.is_active" [disabled]="!canChange(u)"
              (change)="update(u, u.role, !u.is_active)"></td>
        <td>
          @if (resetId() === u.id) {
            <input type="password" placeholder="New password (8+)" style="width:170px" [(ngModel)]="newPw">
            <button class="s" (click)="reset(u)">Set</button> <button class="s" (click)="resetId.set(null)">Cancel</button>
          } @else if (canChange(u)) { <button class="s" (click)="startReset(u)">Reset password</button> }
        </td></tr>
    }</table></div>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <p class="hint">Admins run their spa and add its staff. Staff use customers, onboarding and appointments only.
      Deactivating an account or resetting its password signs that person out immediately.</p>
  </div>
  <div class="card"><h2>Add user</h2>
    <div class="row">
      <div><label>Username (3+)</label><input name="nu" autocomplete="off" [(ngModel)]="nu"></div>
      <div><label>Password (8+)</label><input type="password" name="np" autocomplete="new-password" [(ngModel)]="np"></div>
      @if (auth.isSuper()) {
        <div><label>Role</label><select [(ngModel)]="nr"><option value="staff">staff</option><option value="admin">admin</option>
          <option value="superadmin">superadmin</option></select></div>
        @if (nr !== 'superadmin') {
          <div><label>Spa</label><select [(ngModel)]="nspa">
            @for (p of spas(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }</select></div>
        }
      } @else { <div><label>Role</label><input value="staff" disabled></div> }
    </div>
    <button class="p" (click)="add()">Create user</button>
  </div>`,
})
export class Users implements OnInit {
  private confirm = inject(Confirm);
  private api = inject(Api);
  auth = inject(Auth);
  users = signal<User[]>([]); spas = signal<Spa[]>([]); nspa: number | null = null; msg = signal(''); isErr = signal(false); resetId = signal<number | null>(null);
  nu = ''; np = ''; nr: 'staff' | 'admin' | 'superadmin' = 'staff'; newPw = '';

  ngOnInit() { return this.load(); }
  async load() {
    this.users.set(await this.api.get<User[]>('/users'));
    if (this.auth.isSuper() && !this.spas().length) {
      this.spas.set(await this.api.get<Spa[]>('/spas'));
      this.nspa = this.auth.pick()?.id ?? this.spas()[0]?.id ?? null;
    }
  }
  canChange(u: User) { return u.id !== this.auth.me()?.id && (this.auth.isSuper() || u.role === 'staff'); }
  private say(t: string, err = false) { this.msg.set(t); this.isErr.set(err); }

  async add() {
    if (!(await this.confirm.ask('Create this login?', `${this.nu} · ${this.nr}`, 'Create', false))) return;
    try {
      const sup = this.auth.isSuper();
      await this.api.post('/users', { username: this.nu.trim(), password: this.np, role: sup ? this.nr : 'staff',
        spa_id: sup && this.nr !== 'superadmin' ? this.nspa : null });
      this.say(`Created ${this.nu.trim()}`); this.nu = ''; this.np = ''; this.nr = 'staff'; await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  async update(u: User, role: string, active: boolean) {
    if (!(await this.confirm.ask(`Update ${u.username}?`, `Role: ${role} · ${active ? 'active' : 'deactivated (signed out)'}`, 'Update', !active))) { await this.load(); return; }
    try { await this.api.put(`/users/${u.id}`, { role, is_active: active }); this.say(`Updated ${u.username}`); }
    catch (e) { this.say(errorText(e), true); }
    await this.load();
  }
  startReset(u: User) { this.newPw = ''; this.resetId.set(u.id); }
  async reset(u: User) {
    if (!(await this.confirm.ask(`Reset password for ${u.username}?`, 'They will be signed out everywhere.', 'Reset', true))) return;
    try {
      await this.api.post(`/users/${u.id}/password`, { password: this.newPw });
      this.say(`Password reset for ${u.username}; they have been signed out`); this.resetId.set(null);
    } catch (e) { this.say(errorText(e), true); }
  }
}
