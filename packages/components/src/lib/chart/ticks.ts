export function niceNum(value: number, round = true): number {
  if (!(value > 0) || !Number.isFinite(value)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  if (!power) return value;
  const fraction = value / power;
  const step = round ? fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10 : fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * power;
}
export function numericDomain(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min > max) [min, max] = [max, min];
  if (min === max) { const pad = Math.abs(min) * 0.5 || 1; return [Math.max(-Number.MAX_VALUE, min - pad), Math.min(Number.MAX_VALUE, max + pad)]; }
  return [min, max];
}
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(count > 0)) return [];
  const reverse = min > max;
  [min, max] = numericDomain(min, max);
  const step = niceNum((max - min) / Math.min(10000, Math.max(1, count - 1)), false);
  if (!step || !Number.isFinite(step)) return reverse ? [max, min] : [min, max];
  const first = Math.floor(min / step + 1e-10);
  const last = Math.ceil(max / step - 1e-10);
  const ticks: number[] = [];
  for (let offset = 0; offset <= last - first && ticks.length < 10002; offset++) {
    const raw = (first + offset) * step;
    const value = Number.isFinite(raw) ? Number(raw.toPrecision(15)) || 0 : Math.sign(raw) * Number.MAX_VALUE;
    if (!ticks.length || value > ticks[ticks.length - 1]) ticks.push(value);
    if (first + offset + 1 === first + offset) break;
  }
  if (ticks[0] > min) ticks.unshift(min);
  if (ticks[ticks.length - 1] < max) ticks.push(max);
  return reverse ? ticks.reverse() : ticks;
}
export function tickFormat(step: number, precision?: number): (value: number) => string {
  let decimals = Math.max(0, Math.min(15, precision ?? (step > 0 ? -Math.floor(Math.log10(step)) : 0)));
  if (precision === undefined && Number.isFinite(step)) while (decimals < 15 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-8) decimals++;
  return value => Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value).toFixed(decimals) : '';
}

export type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export interface TimeInterval { unit: TimeUnit; step: number }
export interface TimeTickOptions { utc?: boolean }
const intervals: readonly (readonly [TimeUnit, number, number])[] = [
  ['millisecond', 1, 1], ['millisecond', 5, 5], ['millisecond', 10, 10], ['millisecond', 50, 50], ['millisecond', 100, 100], ['millisecond', 500, 500],
  ['second', 1, 1000], ['second', 5, 5000], ['second', 15, 15000], ['second', 30, 30000],
  ['minute', 1, 60000], ['minute', 5, 300000], ['minute', 15, 900000], ['minute', 30, 1800000],
  ['hour', 1, 3600000], ['hour', 3, 10800000], ['hour', 6, 21600000], ['hour', 12, 43200000],
  ['day', 1, 86400000], ['week', 1, 604800000], ['month', 1, 2629800000], ['month', 3, 7889400000], ['month', 6, 15778800000], ['year', 1, 31557600000],
];
export function timeInterval(min: Date | number, max: Date | number, count = 5): TimeInterval {
  const target = Math.abs(+max - +min) / Math.max(1, count - 1);
  for (let i = 0; i < intervals.length; i++) {
    const candidate = intervals[i];
    if (candidate[2] >= target) {
      const previous = intervals[i - 1];
      const selected = previous && target / previous[2] < candidate[2] / target ? previous : candidate;
      return { unit: selected[0], step: selected[1] };
    }
  }
  return { unit: 'year', step: niceNum(target / 31557600000, false) || 1 };
}
type DateField = 'Milliseconds' | 'Seconds' | 'Minutes' | 'Hours' | 'Date' | 'Day' | 'Month' | 'FullYear';
export function floorTime(value: Date | number, interval: TimeInterval, utc = true): Date {
  const date = new Date(+value);
  const { unit, step } = interval;
  if (unit === 'millisecond') { date.setTime(Math.floor(+date / step) * step); return date; }
  const get = (field: DateField) => date[`get${utc ? 'UTC' : ''}${field}` as const]();
  const set = (field: Exclude<DateField, 'Day'>, value: number) => date[`set${utc ? 'UTC' : ''}${field}` as const](value);
  set('Milliseconds', 0);
  if (unit === 'second') set('Seconds', Math.floor(get('Seconds') / step) * step);
  else {
    set('Seconds', 0);
    if (unit === 'minute') set('Minutes', Math.floor(get('Minutes') / step) * step);
    else {
      set('Minutes', 0);
      if (unit === 'hour') set('Hours', Math.floor(get('Hours') / step) * step);
      else {
        set('Hours', 0);
        if (unit === 'week') set('Date', get('Date') - get('Day'));
        else if (unit === 'day') set('Date', Math.floor((get('Date') - 1) / step) * step + 1);
        else { set('Date', 1); set('Month', unit === 'year' ? 0 : Math.floor(get('Month') / step) * step); if (unit === 'year') set('FullYear', Math.floor(get('FullYear') / step) * step); }
      }
    }
  }
  return date;
}
export function offsetTime(value: Date | number, { unit, step }: TimeInterval, utc = true): Date {
  const date = new Date(+value);
  if (unit === 'millisecond') date.setTime(+date + step);
  else if (unit === 'second') date.setTime(+date + step * 1000);
  else if (unit === 'minute') date.setTime(+date + step * 60000);
  else if (unit === 'hour') { if (utc) date.setTime(+date + step * 3600000); else date.setHours(date.getHours() + step); }
  else {
    const field = unit === 'day' || unit === 'week' ? 'Date' : unit === 'month' ? 'Month' : 'FullYear';
    const current = date[`get${utc ? 'UTC' : ''}${field}` as const]();
    date[`set${utc ? 'UTC' : ''}${field}` as const](current + step * (unit === 'week' ? 7 : 1));
  }
  return date;
}
export function timeTicks(min: Date | number, max: Date | number, count = 5, { utc = true }: TimeTickOptions = {}): Date[] {
  if (!Number.isFinite(+min) || !Number.isFinite(+max) || !(count > 0)) return [];
  const reverse = +min > +max;
  let lo = Math.min(+min, +max), hi = Math.max(+min, +max);
  if (lo === hi) return [new Date(lo)];
  const interval = timeInterval(lo, hi, count);
  let current = floorTime(lo, interval, utc);
  if (+current < lo) current = offsetTime(current, interval, utc);
  const ticks: Date[] = [];
  while (+current <= hi && ticks.length < 10000) {
    ticks.push(current);
    const next = offsetTime(current, interval, utc);
    if (!(+next > +current)) break;
    current = next;
  }
  return reverse ? ticks.reverse() : ticks;
}
