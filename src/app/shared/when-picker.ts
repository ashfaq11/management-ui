import { Component, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { Appointment, ShiftAssignment } from '../core/models';
import { today } from '../core/util';

/** Default window used by the backend only when this therapist has no weekly roster. */
const OPEN = 9 * 60;
const CLOSE = 21 * 60;
const STEP = 30;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

/**
 * Date + time picker constrained to the therapist's active shift and genuinely free time.
 * The form receives a value only after both the shift and appointment availability have been checked.
 * The API remains authoritative and revalidates every booking.
 */
@Component({
  selector: 'app-when-picker', imports: [FormsModule],
  styles: [`.shift-note{display:block;color:var(--mut);font-size:12px;margin-top:5px;line-height:1.4}.shift-warn{color:#a4532a;font-weight:600}`],
  template: `
  <label>Date</label>
  <div style="display:flex;gap:4px">
    <button type="button" class="s" (click)="shift(-1)" aria-label="Previous day">&lsaquo;</button>
    <input type="date" [min]="minDate()" [ngModel]="date()" (ngModelChange)="setDate($event)" style="flex:1;min-width:0">
    <button type="button" class="s" (click)="shift(1)" aria-label="Next day">&rsaquo;</button>
  </div>
  <label style="margin-top:8px">Time</label>
  <input type="time" step="900" [min]="minTime()" [max]="maxTime()"
    [disabled]="timeInputDisabled()" [ngModel]="time()" (ngModelChange)="setTime($event)">
  @if (therapistId() && date()) {
    @if (loading()) {
      <small class="shift-note">Checking the therapist's shift and appointment availability...</small>
    }
    @if (shiftLookupFailed()) {
      <small class="shift-note shift-warn">The shift roster could not be loaded. Time selection is disabled until it can be checked.</small>
    } @else if (rosterConfigured()) {
      @if (dayShift(); as sh) {
        <small class="shift-note">Assigned shift: {{ sh.shift_name }} · {{ sh.start_time.slice(0,5) }}–{{ sh.end_time.slice(0,5) }}</small>
      } @else {
        <small class="shift-note shift-warn">No active shift is assigned on this weekday. Ask an admin to update the weekly roster.</small>
      }
    } @else if (shiftReady()) {
      <small class="shift-note">No weekly roster is set. Default booking window: 09:00–21:00.</small>
    }
    @if (appointmentLookupFailed()) {
      <small class="shift-note shift-warn">Existing appointments could not be checked. Time selection is disabled to avoid double-booking.</small>
    }
    @if (selectionError()) {
      <small class="shift-note shift-warn">{{ selectionError() }}</small>
    }
    @if (shiftLookupFailed() || appointmentLookupFailed()) {
      <button type="button" class="s" style="margin-top:6px" (click)="retry()">Retry availability check</button>
    }
    <label style="margin-top:8px">Available times @if (loading()) { (checking...) }</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
      @for (s of slots(); track s.t) {
        <button type="button" class="s" [class.on]="s.t === time()" (click)="setTime(s.t)">{{ s.t }}</button>
      } @empty {
        @if (!loading() && !shiftLookupFailed() && !appointmentLookupFailed()) {
          <small>No available times fit this appointment on this day.
            <a href="" (click)="$event.preventDefault(); shift(1)">Next day &rsaquo;</a></small>
        }
      }
    </div>
  }`,
})
export class WhenPicker {
  private api = inject(Api);
  private requestVersion = 0;

  /** "YYYY-MM-DDTHH:MM" */
  value = model('');
  /** True only after the selected time has passed shift, duration, past-time and overlap checks. */
  selectionValid = model(false);
  therapistId = input<number | undefined>();
  durationMin = input(60);
  /** The appointment being edited: its own slot is not counted as taken. */
  excludeId = input<number | null>(null);

  date = signal(today());
  time = signal('');
  minDate = signal(today());
  slots = signal<{ t: string }[]>([]);
  loading = signal(false);
  shiftReady = signal(false);
  rosterConfigured = signal(false);
  shiftLookupFailed = signal(false);
  appointmentLookupFailed = signal(false);
  dayShift = signal<ShiftAssignment | null>(null);
  selectionError = signal('');
  private busy: { from: number; to: number }[] = [];

  constructor() {
    // Outside value (edit, reset) -> the two boxes.
    effect(() => {
      const v = this.value();
      if (v) {
        this.date.set(v.slice(0, 10));
        this.time.set(v.slice(11, 16));
      } else {
        this.time.set('');
        this.selectionValid.set(false);
      }
    });
    // Day, therapist or edited appointment changed -> re-check both the roster and booked time.
    effect(() => { void this.fetch(this.date(), this.therapistId(), this.excludeId()); });
    effect(() => { this.durationMin(); this.build(); });
  }

  setDate(d: string) {
    if (!d) return;
    this.date.set(d);
    this.time.set('');
    this.value.set('');
    this.selectionValid.set(false);
    this.selectionError.set('');
  }

  setTime(t: string) {
    const next = t || '';
    if (!next) {
      this.time.set('');
      this.value.set('');
      this.selectionValid.set(false);
      this.selectionError.set('');
      return;
    }

    const error = this.invalidReason(next);
    if (error) {
      this.time.set('');
      this.value.set('');
      this.selectionValid.set(false);
      this.selectionError.set(error);
      return;
    }

    this.time.set(next);
    this.value.set(`${this.date()}T${next}`);
    this.selectionValid.set(true);
    this.selectionError.set('');
  }

  shift(days: number) {
    const d = new Date(this.date() + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next >= this.minDate()) this.setDate(next);
  }

  retry() { void this.fetch(this.date(), this.therapistId(), this.excludeId()); }

  minTime() {
    const window = this.timeWindow();
    return window ? hhmm(window.start) : undefined;
  }

  maxTime() {
    const window = this.timeWindow();
    return window ? hhmm(window.end - (this.durationMin() || 60)) : undefined;
  }

  timeInputDisabled() {
    const window = this.timeWindow();
    return this.loading() || !this.shiftReady() || !window
      || this.durationMin() > window.end - window.start;
  }

  isWithinShift() {
    const selected = this.time();
    const window = this.timeWindow();
    if (!selected || !window) return false;
    const from = mins(selected);
    return from >= window.start && from + (this.durationMin() || 60) <= window.end;
  }

  private async fetch(date: string, therapist: number | undefined, exclude: number | null) {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.shiftReady.set(false);
    this.selectionValid.set(false);
    this.slots.set([]);
    this.shiftLookupFailed.set(false);
    this.appointmentLookupFailed.set(false);
    this.rosterConfigured.set(false);
    this.dayShift.set(null);
    this.selectionError.set('');

    if (!date || !therapist) {
      this.busy = [];
      this.loading.set(false);
      this.shiftReady.set(true);
      return;
    }

    let appointments: Appointment[] = [];
    let assignments: ShiftAssignment[] = [];

    try {
      appointments = await this.api.get<Appointment[]>('/appointments', { date, therapist_id: therapist });
    } catch {
      if (version !== this.requestVersion) return;
      this.appointmentLookupFailed.set(true);
    }

    try {
      assignments = await this.api.get<ShiftAssignment[]>('/shift-assignments', { therapist_id: therapist });
    } catch {
      if (version !== this.requestVersion) return;
      this.shiftLookupFailed.set(true);
    }

    if (version !== this.requestVersion) return;

    this.busy = appointments
      .filter((a) => (a.status === 'booked' || a.status === 'completed') && a.id !== exclude)
      .map((a) => {
        const from = mins(a.start_at.slice(11, 16));
        return { from, to: from + a.duration_min };
      });

    if (!this.shiftLookupFailed()) {
      this.rosterConfigured.set(assignments.length > 0);
      const weekday = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
      this.dayShift.set(assignments.find((a) => a.day_of_week === weekday && a.shift_is_active) ?? null);
    }

    this.shiftReady.set(true);
    this.loading.set(false);
    this.build();
  }

  private timeWindow(): { start: number; end: number } | null {
    if (!this.shiftReady() || this.shiftLookupFailed() || this.appointmentLookupFailed()) return null;
    if (this.rosterConfigured() && !this.dayShift()) return null;
    const sh = this.dayShift();
    return sh
      ? { start: mins(sh.start_time.slice(0, 5)), end: mins(sh.end_time.slice(0, 5)) }
      : { start: OPEN, end: CLOSE };
  }

  private invalidReason(value: string): string {
    if (!/^\\d{2}:\\d{2}$/.test(value)) return 'Choose a valid start time.';
    if (!this.shiftReady() || this.loading()) return 'Wait for the shift and availability check to finish.';
    if (this.shiftLookupFailed()) return 'The therapist shift could not be verified. Retry the availability check.';
    if (this.appointmentLookupFailed()) return 'Existing appointments could not be checked. Retry the availability check.';
    if (this.rosterConfigured() && !this.dayShift()) return 'No active shift is assigned to this therapist on the selected day.';

    const window = this.timeWindow();
    if (!window) return 'No booking window is available for this therapist on the selected day.';

    const from = mins(value);
    const finish = from + (this.durationMin() || 60);
    if (from < window.start || finish > window.end) {
      return 'Choose a start time inside the assigned shift that allows the full appointment to finish before shift end.';
    }

    const now = new Date();
    const currentMinutes = this.date() === today() ? now.getHours() * 60 + now.getMinutes() : -1;
    if (from < currentMinutes) return 'Choose a future start time.';

    if (this.busy.some((b) => from < b.to && b.from < finish)) {
      return 'That time overlaps an existing appointment. Choose another available time.';
    }
    return '';
  }

  private build() {
    const window = this.timeWindow();
    if (!window) {
      this.slots.set([]);
      this.selectionValid.set(false);
      return;
    }

    const selected = this.time();
    if (selected) {
      const error = this.invalidReason(selected);
      if (error) {
        this.time.set('');
        this.value.set('');
        this.selectionValid.set(false);
        this.selectionError.set('The previous time is no longer available. Choose a free time within the assigned shift.');
      } else {
        this.selectionValid.set(true);
      }
    }

    const len = this.durationMin() || 60;
    const now = new Date();
    const past = this.date() === today() ? now.getHours() * 60 + now.getMinutes() : -1;
    const out: { t: string }[] = [];
    for (let m = window.start; m + len <= window.end; m += STEP) {
      if (m < past) continue;
      if (this.busy.some((b) => m < b.to && b.from < m + len)) continue;
      out.push({ t: hhmm(m) });
    }
    this.slots.set(out);
  }
}
