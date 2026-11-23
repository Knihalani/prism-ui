export type Locale = string | string[];
export type FormatKind = 'number' | 'currency' | 'percent' | 'compact' | 'date' | 'datetime' | 'relative' | 'text';
export type FormatOptions = Intl.NumberFormatOptions & Intl.DateTimeFormatOptions & {
  locale?: Locale; currency?: string; fallback?: string; now?: Date | number;
};

interface Formatters { number: Intl.NumberFormat; date: Intl.DateTimeFormat; relative: Intl.RelativeTimeFormat }
const formatters = new Map<string, Formatters[keyof Formatters]>();
function key(locale: Locale | undefined, options: object): string {
  return JSON.stringify([locale, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
}
function cached<K extends keyof Formatters>(kind: K, locale: Locale | undefined, options: object): Formatters[K] {
  const id = kind + ':' + key(locale, options);
  let formatter = formatters.get(id);
  if (!formatter) {
    const Constructor = { number: Intl.NumberFormat, date: Intl.DateTimeFormat, relative: Intl.RelativeTimeFormat }[kind] as new (locale?: Locale, options?: object) => Formatters[keyof Formatters];
    formatter = new Constructor(locale, options);
    formatters.set(id, formatter);
  }
  return formatter as Formatters[K];
}
export function getNumberFormat(locale?: Locale, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return cached('number', locale, options);
}
function safe(fallback: string, fn: () => string): string { try { return fn(); } catch { return fallback; } }
function numeric(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
export function formatNumber(value: unknown, locale?: Locale, options: Intl.NumberFormatOptions = {}, fallback = ''): string {
  return numeric(value) ? safe(fallback, () => getNumberFormat(locale, options).format(value)) : fallback;
}
export function formatCurrency(value: unknown, currency = 'USD', locale?: Locale, options: Intl.NumberFormatOptions = {}, fallback = ''): string {
  return formatNumber(value, locale, { ...options, style: 'currency', currency }, fallback);
}
export function formatPercent(value: unknown, locale?: Locale, options: Intl.NumberFormatOptions = {}, fallback = ''): string {
  return formatNumber(value, locale, { ...options, style: 'percent' }, fallback);
}
export function formatCompact(value: unknown, locale?: Locale, options: Intl.NumberFormatOptions = {}, fallback = ''): string {
  return formatNumber(value, locale, { ...options, notation: 'compact' }, fallback);
}
export function dateValue(value: unknown): Date { return value instanceof Date ? value : new Date(typeof value === 'string' || typeof value === 'number' ? value : NaN); }
export function formatDate(value: unknown, locale?: Locale, options: Intl.DateTimeFormatOptions = {}, fallback = ''): string {
  return safe(fallback, () => {
    const date = dateValue(value);
    if (!Number.isFinite(date.getTime())) return fallback;
    return cached('date', locale, options).format(date);
  });
}
export function formatDateTime(value: unknown, locale?: Locale, options: Intl.DateTimeFormatOptions = {}, fallback = ''): string {
  return formatDate(value, locale, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', ...options }, fallback);
}
export function formatRelativeTime(value: unknown, locale?: Locale, options: Intl.RelativeTimeFormatOptions & { now?: Date | number } = {}, fallback = ''): string {
  return safe(fallback, () => {
    const { now = Date.now(), ...intl } = options;
    const seconds = (dateValue(value).getTime() - Number(now)) / 1000;
    if (!Number.isFinite(seconds)) return fallback;
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    const [unit, divisor] = units.find(([, size]) => Math.abs(seconds) >= size) ?? units[units.length - 1];
    const settings = { numeric: 'auto' as const, ...intl };
    return cached('relative', locale, settings).format(Math.round(seconds / divisor), unit);
  });
}
export function format(value: unknown, kind: FormatKind = 'text', options: FormatOptions = {}): string {
  const { locale, currency = 'USD', fallback = '', now, ...intl } = options;
  switch (kind) {
    case 'number': return formatNumber(value, locale, intl, fallback);
    case 'currency': return formatCurrency(value, currency, locale, intl, fallback);
    case 'percent': return formatPercent(value, locale, intl, fallback);
    case 'compact': return formatCompact(value, locale, intl, fallback);
    case 'date': return formatDate(value, locale, intl, fallback);
    case 'datetime': return formatDateTime(value, locale, intl, fallback);
    case 'relative': return formatRelativeTime(value, locale, { now }, fallback);
    case 'text': return value == null ? fallback : safe(fallback, () => String(value));
    default: return fallback;
  }
}
export function createFormatter(defaults: { locale?: Locale; currency?: string } = {}) {
  return {
    format: (value: unknown, kind: FormatKind, options: FormatOptions = {}) => format(value, kind, { ...defaults, ...options }),
    formatNumber: (value: unknown, options: Intl.NumberFormatOptions = {}) => formatNumber(value, defaults.locale, options),
    formatCurrency: (value: unknown, options: Intl.NumberFormatOptions = {}) => formatCurrency(value, defaults.currency, defaults.locale, options),
    formatPercent: (value: unknown, options: Intl.NumberFormatOptions = {}) => formatPercent(value, defaults.locale, options),
    formatCompact: (value: unknown, options: Intl.NumberFormatOptions = {}) => formatCompact(value, defaults.locale, options),
    formatDate: (value: unknown, options: Intl.DateTimeFormatOptions = {}) => formatDate(value, defaults.locale, options),
    formatDateTime: (value: unknown, options: Intl.DateTimeFormatOptions = {}) => formatDateTime(value, defaults.locale, options),
    formatRelativeTime: (value: unknown, options: Intl.RelativeTimeFormatOptions & { now?: Date | number } = {}) => formatRelativeTime(value, defaults.locale, options),
  };
}
