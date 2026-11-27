import { Component, Injectable, inject, signal } from '@angular/core';

interface Ask { title: string; detail?: string; ok: string; danger: boolean; resolve: (v: boolean) => void; }

/** App-wide "Are you sure?" popup: `if (!(await confirm.ask('Cancel this appointment?'))) return;` */
@Injectable({ providedIn: 'root' })
export class Confirm {
  current = signal<Ask | null>(null);
  ask(title: string, detail = '', ok = 'Yes, continue', danger = false): Promise<boolean> {
    return new Promise((resolve) => this.current.set({ title, detail, ok, danger, resolve }));
  }
  close(v: boolean) { this.current()?.resolve(v); this.current.set(null); }
}

@Component({
  selector: 'app-confirm-host',
  styles: [`
    .scrim{position:fixed;inset:0;z-index:100;background:rgba(10,17,26,.5);display:grid;place-items:center;padding:16px}
    .box{background:var(--card);border-radius:16px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:rise .15s ease-out}
    h3{margin:0 0 6px;font-size:17px}p{margin:0 0 16px;color:var(--mut);white-space:pre-line;font-size:14px}
    .acts{display:flex;gap:8px;justify-content:flex-end}.acts .p{margin:0}.danger{background:var(--bad)!important}`],
  template: `
  @if (c.current(); as a) {
    <div class="scrim" (click)="c.close(false)" (keydown.escape)="c.close(false)">
      <div class="box" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
        <h3>{{ a.title }}</h3>@if (a.detail) { <p>{{ a.detail }}</p> }
        <div class="acts"><button class="s" (click)="c.close(false)">Cancel</button>
          <button class="p" [class.danger]="a.danger" (click)="c.close(true)" autofocus>{{ a.ok }}</button></div>
      </div>
    </div>
  }`,
})
export class ConfirmHost { c = inject(Confirm); }
