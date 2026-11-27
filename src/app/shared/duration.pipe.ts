import { Pipe, PipeTransform } from '@angular/core';

/** 90 -> "1 h 30 min", 60 -> "1 h", 45 -> "45 min". */
@Pipe({ name: 'dur' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | string | null | undefined): string {
    const m = Math.round(Number(minutes ?? 0));
    if (!m) return '—';
    const h = Math.floor(m / 60), r = m % 60;
    return [h ? `${h} h` : '', r ? `${r} min` : ''].filter(Boolean).join(' ');
  }
}
