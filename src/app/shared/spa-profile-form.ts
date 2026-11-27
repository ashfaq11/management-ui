import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SpaProfile {
  contact_phone: string; contact_email: string; address: string; city: string; pincode: string; rooms: number | null;
  therapist_count: number | null; license_number: string; gstin: string; owner_name: string; owner_phone: string;
  manager_name: string; manager_phone: string;
}
export const blankProfile = (): SpaProfile => ({ contact_phone: '', contact_email: '', address: '', city: '', pincode: '', rooms: null,
  therapist_count: null, license_number: '', gstin: '', owner_name: '', owner_phone: '', manager_name: '', manager_phone: '' });
/** What is still missing before a profile can be saved. */
export const profileMissing = (p: SpaProfile) => [
  [!/^[0-9+ -]{10,20}$/.test(p.contact_phone.trim()), 'spa phone'], [p.address.trim().length < 5, 'address'],
  [!(Number(p.rooms) >= 1), 'rooms'], [p.therapist_count === null || String(p.therapist_count) === '', 'therapist count'],
  [p.owner_name.trim().length < 2, 'owner name'], [!/^[0-9+ -]{10,20}$/.test(p.owner_phone.trim()), 'owner phone'],
].filter(([miss]) => miss).map(([, n]) => n as string);
/** Body for the API: empty optional fields become null, counts become numbers. */
export const profileBody = (p: SpaProfile) => Object.fromEntries(Object.entries(p).map(([k, v]) =>
  [k, k === 'rooms' || k === 'therapist_count' ? Number(v) : (typeof v === 'string' ? v.trim() || null : v)]));

/** The spa's audit details: one form for sign-up, new spa and the admin's settings. */
@Component({
  selector: 'app-spa-profile-form', imports: [FormsModule],
  template: `
  <div class="row">
    <div><label>Spa phone *</label><input [(ngModel)]="p().contact_phone" inputmode="tel"></div>
    <div><label>Spa email</label><input type="email" [(ngModel)]="p().contact_email"></div>
  </div>
  <div class="row">
    <div style="flex:3"><label>Address *</label><input [(ngModel)]="p().address" placeholder="Shop no, street, area"></div>
    <div><label>City</label><input [(ngModel)]="p().city"></div>
    <div style="flex:0 0 120px"><label>PIN code</label><input [(ngModel)]="p().pincode" inputmode="numeric"></div>
  </div>
  <div class="row">
    <div><label>Number of rooms *</label><input type="number" min="1" [(ngModel)]="p().rooms"></div>
    <div><label>Number of therapists *</label><input type="number" min="0" [(ngModel)]="p().therapist_count"></div>
    <div><label>Licence number</label><input [(ngModel)]="p().license_number" placeholder="optional"></div>
    <div><label>GSTIN</label><input [(ngModel)]="p().gstin" placeholder="optional"></div>
  </div>
  <div class="row">
    <div><label>Owner name *</label><input [(ngModel)]="p().owner_name"></div>
    <div><label>Owner phone *</label><input [(ngModel)]="p().owner_phone" inputmode="tel"></div>
    <div><label>Manager name</label><input [(ngModel)]="p().manager_name"></div>
    <div><label>Manager phone</label><input [(ngModel)]="p().manager_phone" inputmode="tel"></div>
  </div>`,
})
export class SpaProfileForm { p = model.required<SpaProfile>({ alias: 'profile' }); }
