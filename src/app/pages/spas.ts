import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Spa } from '../core/models';
import { SpaProfileForm, blankProfile, profileBody, profileMissing } from '../shared/spa-profile-form';

import { Confirm } from '../shared/confirm';
@Component({
  selector: 'app-spas', imports: [SpaProfileForm, FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
    .grid-spas{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
    .spa{display:flex;flex-direction:column;gap:10px;margin:0}
    .spa.off{opacity:.6}
    .spa header{display:flex;align-items:center;gap:10px}
    .ava{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:700;color:#fff;
      background:linear-gradient(135deg,var(--acc),var(--gold))}
    .spa h4{margin:0;font-size:16px}
    .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}
    .facts div{background:var(--bg);border-radius:10px;padding:8px 4px}
    .facts b{display:block;font-size:17px}.facts span{font-size:11px;color:var(--mut)}
    .acts{display:flex;gap:6px;flex-wrap:wrap}.acts .p{margin:0;flex:1}`],
  template: `
  <div class="page-head"><div><h1>Spas</h1><p>Every spa runs on its own data. Open one to work inside it.</p></div>
    <button class="p" (click)="showNew.set(!showNew())">{{ showNew() ? 'Close' : '+ New spa' }}</button></div>

  <div class="kpis">
    <div class="kpi"><span>Spas</span><b>{{ active() }}<small> / {{ spas().length }}</small></b></div>
    <div class="kpi"><span>Customers</span><b>{{ totals().customers | number }}</b></div>
    <div class="kpi"><span>Staff logins</span><b>{{ totals().people | number }}</b></div>
    <div class="kpi"><span>Revenue this month</span><b>&#8377;{{ totals().revenue | number: '1.0-0' }}</b></div>
  </div>

  @if (showNew()) {
    <div class="card pop"><h2>New spa</h2>
      <p class="hint">Creates the spa and its first admin. That admin then adds the spa's staff.</p>
      <div class="row">
        <div><label>Spa name</label><input [(ngModel)]="n.name" placeholder="e.g. Lotus Wellness"></div>
        <div><label>Admin username</label><input [(ngModel)]="n.admin_username" autocomplete="off"></div>
        <div><label>Admin password (8+)</label><input type="password" autocomplete="new-password" [(ngModel)]="n.admin_password"></div>
      </div>
      <div class="row">
        <div><label>Plan start</label><input type="date" [(ngModel)]="n.plan_start"></div>
        <div><label>Plan end (blank = no end)</label><input type="date" [(ngModel)]="n.plan_end"></div>
      </div>
      <app-spa-profile-form [(profile)]="prof" />
      <button class="p" (click)="create()" [disabled]="busy()">Create spa</button>
    </div>
  }
  @if (msg()) { <div class="msg" [class.err]="err()">{{ msg() }}</div> }

  <div class="grid-spas">
    @for (s of spas(); track s.id) {
      <div class="card spa" [class.off]="!s.is_active">
        <header><span class="ava">{{ s.name.charAt(0).toUpperCase() }}</span>
          <div style="flex:1;min-width:0">
            @if (editId() === s.id) { <input [(ngModel)]="editName" (keyup.enter)="rename(s)"> }
            @else { <h4>{{ s.name }}</h4><small>Since {{ s.created_at | date: 'mediumDate' }}</small> }
          </div>
          <span class="badge" [class.mute]="!s.is_active" [style.background]="s.expired ? 'var(--bad-soft)' : ''" [style.color]="s.expired ? 'var(--bad)' : ''">
            {{ !s.is_active ? 'Off' : s.expired ? 'Expired' : s.is_trial ? 'Trial' : 'Active' }}</span>
        </header>
        <small>Plan: {{ s.plan_start || '—' }} → {{ s.plan_end || 'no end' }}{{ left(s) }}
          @if (s.contact_phone || s.contact_email) { · {{ s.contact_phone }} {{ s.contact_email }} }</small>
        @if (planId() === s.id) {
          <div class="row" style="margin:0">
            <div><label>Start</label><input type="date" [(ngModel)]="pf.plan_start"></div>
            <div><label>End</label><input type="date" [(ngModel)]="pf.plan_end"></div>
          </div>
          <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" [(ngModel)]="pf.is_trial"> Trial</label>
          <div class="acts"><button class="p" (click)="savePlan(s)">Save plan</button><button class="s" (click)="planId.set(null)">Cancel</button>
            <button class="s" (click)="extend(30)">+30 days</button><button class="s" (click)="extend(365)">+1 year</button></div>
        }
        <div class="facts">
          <div><b>{{ s.customers }}</b><span>customers</span></div>
          <div><b>{{ s.admins }}/{{ s.staff }}</b><span>admins/staff</span></div>
          <div><b>&#8377;{{ s.revenue_this_month | number: '1.0-0' }}</b><span>this month</span></div>
        </div>
        <div class="acts">
          <button class="p" (click)="open(s)" [disabled]="!s.is_active">Open</button>
          @if (editId() === s.id) { <button class="s" (click)="rename(s)">Save</button><button class="s" (click)="editId.set(null)">Cancel</button> }
          @else { <button class="s" (click)="editId.set(s.id); editName = s.name">Rename</button> }
          <button class="s" (click)="toggle(s)">{{ s.is_active ? 'Deactivate' : 'Activate' }}</button>
          <button class="s" (click)="editPlan(s)">Plan dates</button>
        </div>
      </div>
    } @empty { <div class="card"><p class="hint">No spas yet.</p></div> }
  </div>

  <div class="card" style="margin-top:16px"><h2>Renewal contact &amp; sign-up</h2>
    <p class="hint">Shown to a spa whose plan has ended. New spas can sign up from the login page for a free trial.</p>
    <div class="row">
      <div><label>Contact name</label><input [(ngModel)]="pc.renewal_name"></div>
      <div><label>Phone / WhatsApp</label><input [(ngModel)]="pc.renewal_phone"></div>
      <div><label>Email</label><input [(ngModel)]="pc.renewal_email"></div>
    </div>
    <div class="row">
      <div style="flex:3"><label>Message</label><input [(ngModel)]="pc.renewal_message" placeholder="e.g. Renew for ₹999/month — call or WhatsApp us"></div>
      <div><label>Trial days</label><input type="number" min="1" max="365" [(ngModel)]="pc.trial_days"></div>
      <div><label>Public sign-up</label><select [(ngModel)]="pc.allow_signup"><option [ngValue]="true">Open</option><option [ngValue]="false">Closed</option></select></div>
    </div>
    <button class="p" (click)="savePlatform()">Save</button>
  </div>`,
})
export class Spas implements OnInit {
  private confirm = inject(Confirm);
  private api = inject(Api); private auth = inject(Auth); private router = inject(Router);
  spas = signal<Spa[]>([]); msg = signal(''); err = signal(false); busy = signal(false);
  showNew = signal(false); editId = signal<number | null>(null); editName = '';
  n = this.blankN();
  blankN() { return { name: '', admin_username: '', admin_password: '', plan_start: new Date().toISOString().slice(0, 10), plan_end: '' }; }
  prof = blankProfile();
  planId = signal<number | null>(null);
  pf = { plan_start: '', plan_end: '', is_trial: false };
  pc = { renewal_name: '', renewal_phone: '', renewal_email: '', renewal_message: '', trial_days: 30, allow_signup: true };
  left(s: Spa) {
    if (!s.plan_end) return '';
    const d = Math.round((new Date(s.plan_end).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 864e5);
    return d < 0 ? ` (ended ${-d} days ago)` : ` (${d} days left)`;
  }
  private body(s: Spa, over: Record<string, unknown> = {}) {
    return { name: s.name, is_active: s.is_active, plan_start: s.plan_start || null, plan_end: s.plan_end || null, is_trial: !!s.is_trial,
      contact_phone: s.contact_phone || null, contact_email: s.contact_email || null, ...over };
  }
  editPlan(s: Spa) { this.planId.set(s.id); this.pf = { plan_start: s.plan_start || '', plan_end: s.plan_end || '', is_trial: !!s.is_trial }; }
  extend(days: number) {
    const base = this.pf.plan_end && this.pf.plan_end > new Date().toISOString().slice(0, 10) ? new Date(this.pf.plan_end) : new Date();
    base.setDate(base.getDate() + days); this.pf.plan_end = base.toISOString().slice(0, 10); this.pf.is_trial = false;
  }
  async savePlan(s: Spa) {
    if (!(await this.confirm.ask(`Save plan dates for ${s.name}?`, `${this.pf.plan_start || '—'} → ${this.pf.plan_end || 'no end'}`, 'Save', false))) return;
    try {
      await this.api.put(`/spas/${s.id}`, this.body(s, { plan_start: this.pf.plan_start || null, plan_end: this.pf.plan_end || null, is_trial: this.pf.is_trial }));
      this.planId.set(null); this.say(`${s.name}: plan saved`); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  async savePlatform() {
    if (!(await this.confirm.ask('Save renewal contact and sign-up settings?', '', 'Save', false))) return;
    try { await this.api.put('/platform/settings', { ...this.pc, trial_days: Number(this.pc.trial_days) }); this.say('Renewal contact saved'); }
    catch (e) { this.say(errorText(e), true); }
  }
  active = computed(() => this.spas().filter((s) => s.is_active).length);
  totals = computed(() => this.spas().reduce((a, s) => ({
    customers: a.customers + +s.customers, people: a.people + +s.admins + +s.staff, revenue: a.revenue + +s.revenue_this_month,
  }), { customers: 0, people: 0, revenue: 0 }));

  async ngOnInit() { await this.load(); }
  async load() {
    this.spas.set(await this.api.get<Spa[]>('/spas'));
    try { const c = await this.api.get<typeof this.pc>('/platform/contact'); this.pc = { ...this.pc, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null)) }; } catch { /* ignore */ }
  }
  private say(t: string, e = false) { this.msg.set(t); this.err.set(e); }

  async create() {
    if (!(await this.confirm.ask('Create this spa and its admin?', this.n.name, 'Create', false))) return;
    this.busy.set(true);
    try {
      const miss = profileMissing(this.prof);
      if (miss.length) { this.say('Please fill: ' + miss.join(', '), true); this.busy.set(false); return; }
      await this.api.post('/spas', { ...this.n, ...profileBody(this.prof), name: this.n.name.trim(), admin_username: this.n.admin_username.trim(),
        plan_start: this.n.plan_start || null, plan_end: this.n.plan_end || null });
      this.prof = blankProfile();
      this.say(`Created ${this.n.name.trim()} with admin ${this.n.admin_username.trim()}`);
      this.n = this.blankN(); this.showNew.set(false); await this.load();
    } catch (e) { this.say(errorText(e), true); }
    this.busy.set(false);
  }
  async rename(s: Spa) {
    try { await this.api.put(`/spas/${s.id}`, this.body(s, { name: this.editName.trim() })); this.editId.set(null); await this.load(); }
    catch (e) { this.say(errorText(e), true); }
  }
  async toggle(s: Spa) {
    if (!(await this.confirm.ask(`${s.is_active ? 'Deactivate' : 'Activate'} ${s.name}?`, s.is_active ? 'All its logins will be signed out.' : '', 'Yes', s.is_active))) return;
    try {
      await this.api.put(`/spas/${s.id}`, this.body(s, { is_active: !s.is_active }));
      if (s.is_active && this.auth.pick()?.id === s.id) this.auth.choose(null);
      this.say(s.is_active ? `${s.name} deactivated; its logins are signed out` : `${s.name} activated`); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  open(s: Spa) { this.auth.choose({ id: s.id, name: s.name }); this.router.navigateByUrl('/appointments'); }
}
