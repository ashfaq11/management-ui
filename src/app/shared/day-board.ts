import { DtPipe } from './dt.pipe';
import { Component, computed, input, output } from '@angular/core';

interface Appt { id: number; start_at: string; duration_min: number; customer: string; service: string; therapist: string; therapist_id: number; status: string; }

/** One day as a grid: a column per therapist, 9:00–21:00, each booking drawn at its time and length. */
@Component({
  selector: 'app-day-board', imports: [DtPipe],
  styles: [`
    .board{display:grid;overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}
    .col{position:relative;border-left:1px solid var(--line);min-width:150px}
    .head{position:sticky;top:0;height:34px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;
      background:var(--bg);border-bottom:1px solid var(--line);z-index:2}
    .hours .h{height:60px;font-size:11px;color:var(--mut);text-align:right;padding:2px 6px 0 0;border-top:1px dashed var(--line)}
    .slot{height:60px;border-top:1px dashed var(--line)}
    .b{position:absolute;left:4px;right:4px;border-radius:8px;padding:4px 6px;font-size:11.5px;line-height:1.25;overflow:hidden;cursor:pointer;
      background:var(--acc-soft);border-left:3px solid var(--acc);color:var(--ink)}
    .b.completed{background:var(--ok-soft);border-color:var(--ok)}.b.cancelled,.b.no_show{background:var(--bad-soft);border-color:var(--bad);opacity:.7}
    .b b{display:block;font-size:12px}`],
  template: `
  <div class="board" [style.grid-template-columns]="'56px repeat(' + cols().length + ', minmax(150px, 1fr))'">
    <div class="hours"><div class="head"></div>@for (h of hours; track h) { <div class="h">{{ h }}:00</div> }</div>
    @for (c of cols(); track c.id) {
      <div class="col"><div class="head">{{ c.name }}</div>
        @for (h of hours; track h) { <div class="slot"></div> }
        @for (a of c.items; track a.id) {
          <div class="b" [class]="'b ' + a.status" [style.top.px]="34 + top(a)" [style.height.px]="height(a)" (click)="pick.emit(a.id)"
            [title]="a.customer + ' · ' + a.service">
            <b>{{ a.start_at | dt: 't' }} {{ a.customer }}</b>{{ a.service }} · {{ a.duration_min }} min</div>
        }
      </div>
    } @empty { <p class="hint" style="padding:12px">No therapists.</p> }
  </div>`,
})
export class DayBoard {
  appointments = input<Appt[]>([]);
  therapists = input<{ id: number; name: string; is_active?: boolean }[]>([]);
  pick = output<number>();
  open = 9; close = 21;
  hours = Array.from({ length: 21 - 9 }, (_, i) => 9 + i);
  cols = computed(() => this.therapists().filter((t) => t.is_active !== false)
    .map((t) => ({ id: t.id, name: t.name, items: this.appointments().filter((a) => a.therapist_id === t.id) })));
  private mins(a: Appt) { const [h, m] = a.start_at.slice(11, 16).split(':').map(Number); return h * 60 + m; }
  top(a: Appt) { return Math.max(0, this.mins(a) - this.open * 60); }
  height(a: Appt) { return Math.max(22, Math.min(Number(a.duration_min), this.close * 60 - this.mins(a))); }
}
