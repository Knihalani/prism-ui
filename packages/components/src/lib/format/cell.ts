import type { PrismContextValue } from '@prism-ui/react';
import type { DataTableColumn } from '../../datatable/use-datatable';
import { format } from './index';

export function inferType(values: unknown[]): DataTableColumn['type'] {
  const present = values.filter(value => value != null && value !== '');
  if (!present.length) return 'text';
  if (present.every(value => typeof value === 'number' || /^-?(?:\d[\d,]*)(?:\.\d+)?%?$/.test(String(value)))) return 'number';
  if (present.every(value => /^[$€£¥]-?[\d,]+(?:\.\d+)?$/.test(String(value)))) return 'currency';
  if (present.every(value => /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value)) && Number.isFinite(Date.parse(String(value))))) return 'date';
  return 'text';
}
export function numeric(value: unknown) { return typeof value === 'number' ? value : Number(String(value).replace(/[$€£¥,%\s]/g, '')); }
export function scalar(value: unknown) { return value == null || ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined; }
function inferCurrency(value: unknown) { return ({ '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' } as Record<string, string>)[String(value)[0]]; }
export function numericCell(input: unknown, column: DataTableColumn): number | undefined {
  const value = scalar(input);
  const kind = column.format ?? column.type ?? 'text';
  if (!['number', 'currency', 'compact', 'percent'].includes(kind) || value == null || value === '') return;
  return numeric(value);
}
export function formatCell(input: unknown, column: DataTableColumn, context: Pick<PrismContextValue['format'], 'locale' | 'currencyCode'>, intermediate?: number) {
  const value = scalar(input);
  return format(intermediate ?? numericCell(value, column) ?? value, column.format ?? column.type ?? 'text', {
    locale: context.locale, currency: column.currency ?? (column.type === 'currency' ? inferCurrency(value) : undefined) ?? context.currencyCode,
    fallback: value == null ? '' : String(value),
  });
}
