export interface Format {
  locale: string | undefined; currency: (value: number, code?: string) => string;
  currencyCode: string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  percent(value: number): string;
  date(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
  compact(value: number): string;
}
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
export function createFormat(locale?: string, currency = 'USD'): Format {
  function formatter(date: boolean, options: object) {
    const key = JSON.stringify([locale, date, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
    let value = cache.get(key);
    if (!value) {
      value = date ? new Intl.DateTimeFormat(locale, options) : new Intl.NumberFormat(locale, options);
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, value);
    }
    return value;
  }
  const number = (value: number, options: Intl.NumberFormatOptions = {}) => (formatter(false, options) as Intl.NumberFormat).format(value);
  return { locale, currencyCode: currency, number, currency: (v, code = currency) => number(v, { style: 'currency', currency: code }), percent: v => number(v, { style: 'percent' }), compact: v => number(v, { notation: 'compact' }), date: (v, options = {}) => (formatter(true, options) as Intl.DateTimeFormat).format(v instanceof Date ? v : new Date(v)) };
}
