import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';
import { Spa } from '../core/models';

@Component({
  selector: 'app-spas', imports: [FormsModule, DecimalPipe, DatePipe],
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
          <span class="badge" [class.mute]="!s.is_active">{{ s.is_active ? 'Active' : 'Off' }}</span>
        </header>
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
        </div>
      </div>
    } @empty { <div class="card"><p class="hint">No spas yet.</p></div> }
  </div>`,
})
export class Spas implements OnInit {
  private api = inject(Api); private auth = inject(Auth); private router = inject(Router);
  spas = signal<Spa[]>([]); msg = signal(''); err = signal(false); busy = signal(false);
  showNew = signal(false); editId = signal<number | null>(null); editName = '';
  n = { name: '', admin_username: '', admin_password: '' };
  active = computed(() => this.spas().filter((s) => s.is_active).length);
  totals = computed(() => this.spas().reduce((a, s) => ({
    customers: a.customers + +s.customers, people: a.people + +s.admins + +s.staff, revenue: a.revenue + +s.revenue_this_month,
  }), { customers: 0, people: 0, revenue: 0 }));

  async ngOnInit() { await this.load(); }
  async load() { this.spas.set(await this.api.get<Spa[]>('/spas')); }
  private say(t: string, e = false) { this.msg.set(t); this.err.set(e); }

  async create() {
    this.busy.set(true);
    try {
      await this.api.post('/spas', { ...this.n, name: this.n.name.trim(), admin_username: this.n.admin_username.trim() });
      this.say(`Created ${this.n.name.trim()} with admin ${this.n.admin_username.trim()}`);
      this.n = { name: '', admin_username: '', admin_password: '' }; this.showNew.set(false); await this.load();
    } catch (e) { this.say(errorText(e), true); }
    this.busy.set(false);
  }
  async rename(s: Spa) {
    try { await this.api.put(`/spas/${s.id}`, { name: this.editName.trim(), is_active: s.is_active }); this.editId.set(null); await this.load(); }
    catch (e) { this.say(errorText(e), true); }
  }
  async toggle(s: Spa) {
    try {
      await this.api.put(`/spas/${s.id}`, { name: s.name, is_active: !s.is_active });
      if (s.is_active && this.auth.pick()?.id === s.id) this.auth.choose(null);
      this.say(s.is_active ? `${s.name} deactivated; its logins are signed out` : `${s.name} activated`); await this.load();
    } catch (e) { this.say(errorText(e), true); }
  }
  open(s: Spa) { this.auth.choose({ id: s.id, name: s.name }); this.router.navigateByUrl('/appointments'); }
}
