import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchSelect, therapistOptions } from '../shared/search-select';
import { Api, errorText } from '../core/api';
import { today } from '../core/util';

interface Absence { id: number; therapist_id: number; therapist: string; on_date: string; kind: string; half_day: boolean; note: string | null; }
interface Att { therapist_id: number; therapist: string; scheduled: number; away: number; present: number; }
const KINDS: Record<string, string> = { leave: 'Leave', sick: 'Sick', absent: 'Absent (no notice)', holiday: 'Holiday' };

import { exportTable } from '../shared/export';
@Component({
  selector: 'app-attendance', imports: [SearchSelect, FormsModule],
  template: `
  <div class="page-head"><div><h1>Attendance</h1><p>Mark only the days a therapist is away. Days present = shift days minus absences.</p></div></div>
  <div class="card pop"><h2>Mark absence</h2>
    <div class="row">
      <div style="flex:2"><label>Therapist *</label><app-search-select [options]="tOpts()" [(value)]="f.therapist_id" placeholder="Search therapist…" /></div>
      <div style="flex:0 0 160px"><label>From *</label><input type="date" [(ngModel)]="f.on_date"></div>
      <div style="flex:0 0 160px"><label>To (optional)</label><input type="date" [(ngModel)]="f.to_date"></div>
      <div style="flex:0 0 180px"><label>Type</label><select [(ngModel)]="f.kind">@for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }</select></div>
      <div style="flex:0 0 130px"><label>Length</label><select [(ngModel)]="f.half_day"><option [ngValue]="false">Full day</option><option [ngValue]="true">Half day</option></select></div>
      <div style="flex:2"><label>Note</label><input [(ngModel)]="f.note" placeholder="optional reason"></div>
    </div>
    <button class="p" (click)="add()">Mark absent</button>
    @if (msg()) { <div class="msg" [class.err]="err()">{{ msg() }}</div> }
  </div>

  <div class="card">
    <div class="row" style="align-items:flex-end"><div style="flex:0 0 180px"><label>Month</label><input type="month" [(ngModel)]="month" (change)="load()"></div></div>
    <h2 style="margin-top:10px;display:flex;align-items:center">Days present <span style="display:inline-flex;gap:6px;margin-left:auto"><button class="s" (click)="exp('pdf')">PDF</button><button class="s" (click)="exp('xlsx')">Excel</button></span></h2>
    <div class="wrap"><table><tr><th>Therapist</th><th class="num">Shift days</th><th class="num">Away</th><th class="num">Present</th></tr>
      @for (a of team(); track a.therapist_id) {
        <tr><td><b>{{ a.therapist }}</b></td><td class="num">{{ a.scheduled }}</td><td class="num">{{ a.away }}</td>
          <td class="num"><b style="color:var(--ok)">{{ a.present }}</b></td></tr>
      } @empty { <tr><td colspan="4">No therapists.</td></tr> }
    </table></div>
    <p class="hint">Shift days come from Team &amp; shifts and count up to today. A therapist with no shift assigned shows 0.</p>
    <h2 style="margin-top:14px">Absences this month</h2>
    <div class="wrap"><table><tr><th>Date</th><th>Therapist</th><th>Type</th><th>Note</th><th></th></tr>
      @for (x of list(); track x.id) {
        <tr><td>{{ x.on_date }}</td><td>{{ x.therapist }}</td><td>{{ label(x.kind) }}{{ x.half_day ? ' · half day' : '' }}</td><td>{{ x.note || '—' }}</td>
          <td><button class="s" (click)="remove(x)">Remove</button></td></tr>
      } @empty { <tr><td colspan="5">No absences this month.</td></tr> }
    </table></div>
  </div>`,
})
export class Attendance implements OnInit {
  tOpts = computed(() => this.team().map((t) => ({ id: t.therapist_id, label: t.therapist })));
  private api = inject(Api);
  kinds = Object.entries(KINDS);
  month = today().slice(0, 7);
  team = signal<Att[]>([]); list = signal<Absence[]>([]); msg = signal(''); err = signal(false);
  f = this.blank();
  blank() { return { therapist_id: null as number | null, on_date: today(), to_date: '', kind: 'leave', half_day: false, note: '' }; }
  label(k: string) { return KINDS[k] ?? k; }
  async ngOnInit() { await this.load(); }
  async load() {
    try {
      const r = await this.api.get<{ absences: Absence[]; attendance: Att[] }>('/absences', { month: this.month });
      this.list.set(r.absences); this.team.set(r.attendance);
    } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async add() {
    if (!this.f.therapist_id || !this.f.on_date) { this.err.set(true); this.msg.set('Choose the therapist and date.'); return; }
    try {
      const r = await this.api.post<{ days: number }>('/absences', { ...this.f, to_date: this.f.to_date || null, note: this.f.note.trim() || null });
      this.err.set(false); this.msg.set(`Marked ${r.days} day${r.days === 1 ? '' : 's'} away.`);
      this.month = this.f.on_date.slice(0, 7); const keep = this.f.therapist_id; this.f = this.blank(); this.f.therapist_id = keep; await this.load();
    } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async remove(x: Absence) {
    try { await this.api.delete(`/absences/${x.id}`); await this.load(); } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
  async exp(ext: 'pdf' | 'xlsx') {
    try {
      await exportTable(this.api, ext, 'Attendance', this.month, ['Therapist', 'Shift days', 'Away', 'Present'],
        this.team().map((a) => [a.therapist, a.scheduled, a.away, a.present]).concat(
          this.list().map((x) => [`Away: ${x.therapist}`, x.on_date, this.label(x.kind) + (x.half_day ? ' (half)' : ''), x.note ?? ''])));
    } catch (e) { this.err.set(true); this.msg.set(errorText(e)); }
  }
}
