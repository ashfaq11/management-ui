import { Pipe, PipeTransform } from '@angular/core';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/** One short, readable style everywhere: "27 Nov, 3:41 pm" · "27 Nov 2026" · "3:41 pm". Times are already IST. */
export function fmtDt(v: unknown, mode: 'auto' | 'd' | 't' = 'auto'): string {
  if (v === null || v === undefined || v === '') return '';
  let str = String(v);
  if (/T\d{2}:\d{2}.*([zZ]|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(+d)) str = d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }); // "2026-11-27 15:41:00"
  }
  const m = ISO.exec(str);
  if (!m) return String(v);
  const [, y, mo, d, h, mi] = m;
  const time = h !== undefined ? `${+h % 12 || 12}:${mi} ${+h < 12 ? 'am' : 'pm'}` : '';
  if (mode === 't') return time;
  const day = `${+d} ${MON[+mo - 1]}`;
  const yr = +y !== new Date().getFullYear() ? ` ${y}` : '';
  if (mode === 'd' || !time) return `${day}${h === undefined || mode === 'd' ? ' ' + y : yr}`;
  return `${day}${yr}, ${time}`;
}

@Pipe({ name: 'dt' })
export class DtPipe implements PipeTransform {
  transform(v: unknown, mode: 'auto' | 'd' | 't' = 'auto') { return fmtDt(v, mode); }
}
