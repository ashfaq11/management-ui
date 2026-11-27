import { Confirm } from '../shared/confirm';
import { Wa, WA_DEFAULTS, WA_KEYS, WA_LABELS } from '../shared/wa';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';

import { SpaProfile, SpaProfileForm, blankProfile, profileBody, profileMissing } from '../shared/spa-profile-form';
@Component({
  selector: 'app-account', imports: [SpaProfileForm, FormsModule],
  template: `
  @if (auth.isAdmin() && auth.hasSpa()) {
    <section class="card" [class.pop]="!profileOk()" style="margin-bottom:16px">
      <h2>Spa profile</h2>
      <p class="hint">Details kept for audits. Fields marked * are required.{{ profileOk() ? '' : ' Please complete your spa profile.' }}</p>
      <app-spa-profile-form [(profile)]="prof" />
      <button class="p" (click)="saveProfile()">Save spa profile</button>
      @if (pmsg()) { <div class="msg" [class.err]="perr()">{{ pmsg() }}</div> }
    </section>
  }
  @if (auth.isAdmin() && auth.hasSpa()) {
    <section class="card" style="margin-bottom:16px">
      <h2>WhatsApp messages</h2>
      <p class="hint">Texts used by the WhatsApp buttons. Placeholders: {{ '{' }}name{{ '}' }}, {{ '{' }}service{{ '}' }}, {{ '{' }}when{{ '}' }}, {{ '{' }}date{{ '}' }}, {{ '{' }}time{{ '}' }}, {{ '{' }}therapist{{ '}' }}, {{ '{' }}spa{{ '}' }}, {{ '{' }}plan{{ '}' }}, {{ '{' }}left{{ '}' }}, {{ '{' }}used{{ '}' }}, {{ '{' }}due{{ '}' }}. Leave blank for the default.</p>
      @for (k of waKeys; track k) {
        <label>{{ waLabels[k] }}</label><textarea rows="2" [(ngModel)]="tpl[k]" [placeholder]="waDefaults[k]"></textarea>
      }
      <button class="p" (click)="saveTpl()">Save messages</button>
      @if (tmsg()) { <div class="msg" [class.err]="terr()">{{ tmsg() }}</div> }
    </section>
  }
  @if (auth.isAdmin() && auth.hasSpa()) {
    <section class="card" style="max-width:520px;margin-bottom:16px">
      <h2>Receipt address</h2>
      <p style="margin:0 0 12px;color:var(--mut)">Enter the business address to print beneath your logo on customer receipts.</p>
      <label for="spa-receipt-address">Spa address</label>
      <textarea id="spa-receipt-address" name="receiptAddress" rows="3" maxlength="500"
        [(ngModel)]="receiptAddress" (ngModelChange)="addressDirty.set(true)"
        placeholder="Street, area, city, state, PIN code"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <button class="p" type="button" (click)="saveReceiptAddress()" [disabled]="addressBusy() || !addressDirty()">Save address</button>
        @if (addressMsg()) { <small [style.color]="addressErr() ? 'var(--danger)' : 'var(--mut)'">{{ addressMsg() }}</small> }
      </div>
    </section>
    <section class="card" style="max-width:520px;margin-bottom:16px">
      <h2>Spa logo</h2>
      <p style="margin:0 0 12px;color:var(--mut)">Choose a logo for {{ auth.spaName() }}. It appears in the app header and is saved only for this spa.</p>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
        <div style="width:112px;height:64px;border:1px dashed var(--line);border-radius:10px;display:grid;place-items:center;overflow:hidden;background:var(--bg)">
          @if (logoPreview()) { <img [src]="logoPreview()!" alt="Logo preview" style="max-width:100%;max-height:100%;object-fit:contain"> }
          @else { <span style="font-size:12px;color:var(--mut)">No logo</span> }
        </div>
        <div style="display:grid;gap:6px">
          <label for="spa-logo">Browse image</label>
          <input id="spa-logo" type="file" accept="image/png,image/jpeg,image/webp" (change)="chooseLogo($event)">
          <small style="color:var(--mut)">PNG, JPG or WebP. Automatically fitted to 512 × 256 px.</small>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="p" type="button" (click)="saveLogo()" [disabled]="logoBusy() || !logoDirty()">Save logo</button>
        <button class="s" type="button" (click)="removeLogo()" [disabled]="logoBusy() || !logoPreview()">Remove logo</button>
      </div>
      @if (logoMsg()) { <div class="msg" [class.err]="logoErr()">{{ logoMsg() }}</div> }
    </section>
  }
  <form class="card" style="max-width:380px" (ngSubmit)="save()">
    <h2>Change my password</h2>
    <p style="margin:0;color:var(--mut)">Signed in as {{ auth.me()?.username }}</p>
    <label>Current password</label><input type="password" name="c" autocomplete="current-password" [(ngModel)]="cur">
    <label>New password (8+ characters)</label><input type="password" name="n" autocomplete="new-password" [(ngModel)]="next">
    <label>Repeat new password</label><input type="password" name="r" autocomplete="new-password" [(ngModel)]="again">
    <button class="p">Change password</button>
    @if (msg()) { <div class="msg" [class.err]="isErr()">{{ msg() }}</div> }
    <p style="font-size:12px;color:var(--mut)">Your other signed-in devices are signed out; this one stays signed in.</p>
  </form>`,
})
export class Account implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  cur = ''; next = ''; again = ''; msg = signal(''); isErr = signal(false);
  private wa = inject(Wa); private confirm = inject(Confirm);
  waKeys = WA_KEYS; waLabels = WA_LABELS; waDefaults = WA_DEFAULTS;
  tpl: Record<string, string> = {}; tmsg = signal(''); terr = signal(false);
  async saveTpl() {
    if (!(await this.confirm.ask('Save the WhatsApp messages?', '', 'Save'))) return;
    try { const r = await this.api.put<Record<string, string>>('/spa/templates', this.tpl); this.wa.saved.set(r); this.terr.set(false); this.tmsg.set('Messages saved.'); }
    catch (e) { this.terr.set(true); this.tmsg.set(errorText(e)); }
  }
  prof = blankProfile(); profileOk = signal(true); pmsg = signal(''); perr = signal(false);
  async loadProfile() {
    const r = await this.api.get<Record<string, unknown> & { complete: boolean }>('/spa/profile');
    const b = blankProfile() as unknown as Record<string, unknown>;
    for (const k of Object.keys(b)) if (r[k] !== null && r[k] !== undefined) b[k] = r[k];
    this.prof = b as unknown as SpaProfile; this.profileOk.set(r.complete);
  }
  async saveProfile() {
    const miss = profileMissing(this.prof);
    if (miss.length) { this.perr.set(true); this.pmsg.set('Please fill: ' + miss.join(', ')); return; }
    try { await this.api.put('/spa/profile', profileBody(this.prof)); this.perr.set(false); this.pmsg.set('Spa profile saved.'); this.profileOk.set(true); }
    catch (e) { this.perr.set(true); this.pmsg.set(errorText(e)); }
  }
  logoPreview = signal<string | null>(null);
  logoDirty = signal(false); logoBusy = signal(false);
  logoMsg = signal(''); logoErr = signal(false);
  receiptAddress = '';
  addressDirty = signal(false); addressBusy = signal(false);
  addressMsg = signal(''); addressErr = signal(false);
  private logoValue: string | null = null;

  async ngOnInit() {
    if (!this.auth.isAdmin() || !this.auth.hasSpa()) return;
    this.api.get<Record<string, string>>('/spa/templates').then((t) => (this.tpl = { ...t })).catch(() => undefined);
    void this.loadProfile().catch(() => undefined);
    try {
      const [logo, details] = await Promise.all([
        this.api.get<{ logo_data_url: string | null }>('/spa/logo'),
        this.api.get<{ address: string | null }>('/spa/receipt-details'),
      ]);
      this.logoValue = logo.logo_data_url;
      this.logoPreview.set(this.logoValue);
      this.receiptAddress = details.address ?? '';
    } catch (e) { this.logoMsg.set(errorText(e)); this.logoErr.set(true); }
  }

  async chooseLogo(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.logoMsg.set('Choose a PNG, JPEG or WebP image'); this.logoErr.set(true); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logoMsg.set('Image must be smaller than 5 MB'); this.logoErr.set(true); return;
    }
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = source;
      });
      const scale = Math.min(1, 512 / image.width, 256 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image resizing is not supported in this browser');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const resized = canvas.toDataURL('image/png');
      if (resized.length > 1_500_000) throw new Error('Resized logo is too large; choose a simpler image');
      this.logoValue = resized;
      this.logoPreview.set(resized);
      this.logoDirty.set(true);
      this.logoMsg.set('Preview ready. Save to apply this logo.'); this.logoErr.set(false);
    } catch (e) { this.logoMsg.set(errorText(e)); this.logoErr.set(true); }
  }

  async saveReceiptAddress() {
    this.addressBusy.set(true);
    try {
      const result = await this.api.put<{ address: string | null }>('/spa/receipt-details', {
        address: this.receiptAddress.trim() || null,
      });
      this.receiptAddress = result.address ?? '';
      this.addressDirty.set(false);
      this.addressMsg.set('Receipt address saved'); this.addressErr.set(false);
    } catch (e) { this.addressMsg.set(errorText(e)); this.addressErr.set(true); }
    finally { this.addressBusy.set(false); }
  }

  async saveLogo() {
    this.logoBusy.set(true);
    try {
      await this.api.put('/spa/logo', { logo_data_url: this.logoValue });
      this.auth.spaLogo.set(this.logoValue);
      this.logoDirty.set(false);
      this.logoMsg.set('Spa logo saved'); this.logoErr.set(false);
    } catch (e) { this.logoMsg.set(errorText(e)); this.logoErr.set(true); }
    finally { this.logoBusy.set(false); }
  }

  removeLogo() {
    this.logoValue = null; this.logoPreview.set(null); this.logoDirty.set(true);
    this.logoMsg.set('Logo removal is ready. Save to apply it.'); this.logoErr.set(false);
  }

  async save() {
    try {
      if (this.next !== this.again) throw new Error('The new passwords do not match');
      await this.api.post('/auth/password', { current_password: this.cur, new_password: this.next });
      this.msg.set('Password changed'); this.isErr.set(false); this.cur = this.next = this.again = '';
    } catch (e) { this.msg.set(errorText(e)); this.isErr.set(true); }
  }
}