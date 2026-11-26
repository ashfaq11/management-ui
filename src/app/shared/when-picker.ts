import { Component, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { Appointment, ShiftAssignment } from '../core/models';
import { today } from '../core/util';

/** Opening hours used for the suggested slots; any other time can still be typed in the time box. */
const OPEN = 9 * 60;
const CLOSE = 21 * 60;
const STEP = 30;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

/**
 * Date + time for an appointment, with the therapist's free slots for that day as one-tap buttons.
 * Value: "YYYY-MM-DDTHH:MM" (the spa's local time), or '' until both parts are chosen.
 * A slot is taken when it overlaps a booked/completed appointment of the same therapist (cancelled and
 * no-show ones free the slot, as on the server); the server still makes the final no-double-booking check.
 */
@Component({
  selector: 'app-when-picker', imports: [FormsModule],
  styles: [`.shift-note{display:block;color:var(--mut);font-size:12px;margin-top:5px;line-height:1.4}`],
  template: `
  <label>Date</label>
  <div style="display:flex;gap:4px">
    <button type="button" class="s" (click)="shift(-1)" aria-label="Previous day">&lsaquo;</button>
    <input type="date" [min]="minDate()" [ngModel]="date()" (ngModelChange)="setDate($event)" style="flex:1;min-width:0">
    <button type="button" class="s" (click)="shift(1)" aria-label="Next day">&rsaquo;</button>
  </div>
  <label style="margin-top:8px">Time</label>
  <input type="time" step="900" [ngModel]="time()" (ngModelChange)="setTime($event)">
  @if (therapistId() && date()) {
    @if (rosterConfigured()) {
      @if (dayShift(); as sh) {
        <small class="shift-note">Assigned shift: {{ sh.shift_name }} · {{ sh.start_time.slice(0,5) }}–{{ sh.end_time.slice(0,5) }}</small>
      } @else {
        <small class="shift-note">This therapist has no active shift assigned for this weekday. Choose another day or ask an admin to update the roster.</small>
      }
    } @else {
      <small class="shift-note">No weekly roster set for this therapist. Default booking window: 09:00–21:00.</small>
    }
    <label style="margin-top:8px">Available times @if (loading()) { (checking...) }</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
      @for (s of slots(); track s.t) {
        <button type="button" class="s" [disabled]="!s.free" (click)="setTime(s.t)"
          [style.opacity]="s.free ? 1 : .35" [style.text-decoration]="s.free ? 'none' : 'line-through'"
          [style.background]="s.t === time() ? 'var(--acc)' : ''" [style.color]="s.t === time() ? '#fff' : ''"
          [title]="s.free ? 'Free' : 'Taken'">{{ s.t }}</button>
      } @empty {
        <small>No free times left on this day.
          <a href="" (click)="$event.preventDefault(); shift(1)">Next day &rsaquo;</a></small>
      }
    </div>
  }`,
})
export class WhenPicker {
  private api = inject(Api);
  /** "YYYY-MM-DDTHH:MM" */
  value = model('');
  therapistId = input<number | undefined>();
  durationMin = input(60);
  /** The appointment being edited: its own slot is not counted as taken. */
  excludeId = input<number | null>(null);

  date = signal(today()); time = signal('');
  minDate = signal(today());
  slots = signal<{ t: string; free: boolean }[]>([]);
  loading = signal(false);
  rosterConfigured = signal(false);
  dayShift = signal<ShiftAssignment | null>(null);
  private busy: { from: number; to: number }[] = [];

  constructor() {
    // Outside value (edit, reset) -> the two boxes.
    effect(() => {
      const v = this.value();
      if (v) { this.date.set(v.slice(0, 10)); this.time.set(v.slice(11, 16)); }
      else this.time.set('');
    });
    // Day, therapist or duration changed -> fetch that therapist's day.
    effect(() => { void this.fetch(this.date(), this.therapistId(), this.excludeId()); });
    effect(() => { this.durationMin(); this.build(); });
  }

  setDate(d: string) { if (d) { this.date.set(d); this.emit(); } }
  setTime(t: string) { this.time.set(t || ''); this.emit(); }
  shift(days: number) {
    const d = new Date(this.date() + 'T12:00:00'); d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next >= this.minDate()) this.setDate(next);
  }

  private emit() { this.value.set(this.date() && this.time() ? `${this.date()}T${this.time()}` : ''); }

  private async fetch(date: string, therapist: number | undefined, exclude: number | null) {
    if (!date || !therapist) {
      this.busy = []; this.rosterConfigured.set(false); this.dayShift.set(null); this.build(); return;
    }
    this.loading.set(true);
    try {
      const [rows, assignments] = await Promise.all([
        this.api.get<Appointment[]>('/appointments', { date, therapist_id: therapist }),
        this.api.get<ShiftAssignment[]>('/shift-assignments', { therapist_id: therapist }),
      ]);
      this.busy = rows.filter((a) => (a.status === 'booked' || a.status === 'completed') && a.id !== exclude)
        .map((a) => { const from = mins(a.start_at.slice(11, 16)); return { from, to: from + a.duration_min }; });
      this.rosterConfigured.set(assignments.length > 0);
      const weekday = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
      this.dayShift.set(assignments.find((a) => a.day_of_week === weekday && a.shift_is_active) ?? null);
    } catch {
      this.busy = []; this.rosterConfigured.set(false); this.dayShift.set(null);
    }
    this.loading.set(false);
    this.build();
  }

  private build() {
    const len = this.durationMin() || 60;
    const now = new Date();
    const past = this.date() === today() ? now.getHours() * 60 + now.getMinutes() : -1;
    const shift = this.dayShift();
    if (this.rosterConfigured() && !shift) { this.slots.set([]); return; }
    const open = shift ? mins(shift.start_time.slice(0,5)) : OPEN;
    const close = shift ? mins(shift.end_time.slice(0,5)) : CLOSE;
    const out: { t: string; free: boolean }[] = [];
    for (let m = open; m + len <= close; m += STEP) {
      if (m < past) continue;
      out.push({ t: hhmm(m), free: !this.busy.some((b) => m < b.to && b.from < m + len) });
    }
    this.slots.set(out);
  }
}
