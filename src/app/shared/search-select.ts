import { Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';

export interface Option { id: number; label: string; hint?: string | null; }

/**
 * Searchable dropdown (combobox). Signals throughout: `options` and `placeholder` are signal inputs, the picked id is a
 * two-way `model` — use it as [(value)]="form.therapist_id". Nothing is selected until the user picks; search ignores case
 * and matches the label or the hint (phone, speciality…). Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
 */
@Component({
  selector: 'app-search-select',
  styles: [`
    :host{display:block;position:relative}
    .box{position:relative}
    input{width:100%;padding-right:56px}
    .x,.caret{position:absolute;top:50%;transform:translateY(-50%);background:none;border:0;padding:0 6px;min-height:auto;color:var(--mut);cursor:pointer}
    .x{right:24px;font-size:15px}.caret{right:6px;font-size:11px;pointer-events:none}
    ul{position:absolute;z-index:40;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;margin:0;padding:4px;list-style:none;
      background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(15,28,46,.14)}
    li{padding:8px 10px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;gap:10px}
    li.on,li:hover{background:var(--acc-soft)}
    li small{color:var(--mut)}
    li.none{color:var(--mut);cursor:default;background:none}`],
  template: `
    <div class="box">
      <input type="text" role="combobox" autocomplete="off" [attr.aria-expanded]="open()" [placeholder]="placeholder()"
        [value]="open() ? query() : selectedLabel()" (focus)="openList()" (input)="type($any($event.target).value)"
        (keydown)="key($event)" [disabled]="disabled()">
      @if (value() != null && !disabled()) { <button type="button" class="x" aria-label="Clear" (click)="clear()">&times;</button> }
      <span class="caret">&#9662;</span>
    </div>
    @if (open()) {
      <ul role="listbox">
        @for (o of matches(); track o.id; let i = $index) {
          <li role="option" [class.on]="i === active()" (mousedown)="pick(o, $event)" (mouseenter)="active.set(i)">
            <span>{{ o.label }}</span>@if (o.hint) { <small>{{ o.hint }}</small> }</li>
        } @empty { <li class="none">No match</li> }
      </ul>
    }`,
})
export class SearchSelect {
  options = input<Option[]>([]);
  placeholder = input('Search…');
  disabled = input(false);
  value = model<number | null | undefined>(null);

  private el = inject(ElementRef);
  open = signal(false); query = signal(''); active = signal(0);
  selectedLabel = computed(() => this.options().find((o) => o.id === this.value())?.label ?? '');
  matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    return (q ? all.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q)) : all).slice(0, 50);
  });

  openList() { this.query.set(''); this.active.set(0); this.open.set(true); }
  type(v: string) { this.query.set(v); this.active.set(0); this.open.set(true); }
  pick(o: Option, e?: Event) { e?.preventDefault(); this.value.set(o.id); this.open.set(false); }
  clear() { this.value.set(null); this.query.set(''); }
  key(e: KeyboardEvent) {
    const n = this.matches().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.open.set(true); this.active.set(Math.min(this.active() + 1, n - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(Math.max(this.active() - 1, 0)); }
    else if (e.key === 'Enter' && this.open()) { e.preventDefault(); const o = this.matches()[this.active()]; if (o) this.pick(o); }
    else if (e.key === 'Escape') this.open.set(false);
  }
  @HostListener('document:mousedown', ['$event'])
  outside(e: Event) { if (!this.el.nativeElement.contains(e.target)) this.open.set(false); }
}

/** Therapists as options: name, with phone / speciality as the searchable hint. */
export const therapistOptions = (ts: { id: number; name: string; phone?: string | null; specialities?: string | null; is_active?: boolean }[]) =>
  ts.filter((t) => t.is_active !== false).map((t) => ({ id: t.id, label: t.name, hint: [t.specialities, t.phone].filter(Boolean).join(' · ') || null }));
