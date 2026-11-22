import { describe, expect, test } from 'bun:test';
import { createFormatter, format, formatCompact, formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatRelativeTime, getNumberFormat } from './index';

describe('format', () => {
  test('numbers, currency, percent and compact use Intl', () => {
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
    expect(formatCurrency(12, 'EUR', 'en-US')).toBe('€12.00');
    expect(formatPercent(0.25, 'en-US')).toBe('25%');
    expect(formatCompact(1200, 'en-US')).toBe('1.2K');
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5');
  });
  test('cache keys are stable across option order and distinguish locales', () => {
    expect(getNumberFormat('en', { minimumFractionDigits: 1, maximumFractionDigits: 2 })).toBe(getNumberFormat('en', { maximumFractionDigits: 2, minimumFractionDigits: 1 }));
    expect(getNumberFormat('de')).not.toBe(getNumberFormat('en'));
  });
  test('dates and datetimes have predictable explicit timezone', () => {
    const value = '2024-01-02T13:04:00Z';
    expect(formatDate(value, 'en-US', { timeZone: 'UTC' })).toBe('1/2/2024');
    expect(formatDateTime(value, 'en-US', { timeZone: 'UTC' })).toBe('1/2/2024, 1:04 PM');
  });
  test('relative units, past, future, zero and injectable clock', () => {
    const now = Date.UTC(2024, 0, 1);
    for (const [delta, expected] of [[0, 'now'], [60000, 'in 1 minute'], [-3600000, '1 hour ago'], [86400000, 'tomorrow'], [604800000, 'next week'], [2592000000, 'next month'], [31536000000, 'next year']] as const) {
      expect(formatRelativeTime(new Date(now + delta), 'en', { now })).toBe(expected);
    }
    expect(formatRelativeTime(now - 2000, 'en', { now })).toBe('2 seconds ago');
  });
  test('invalid inputs and invalid Intl options never throw', () => {
    for (const value of [null, undefined, NaN, Infinity, 'bad', {}]) expect(formatNumber(value)).toBe('');
    expect(formatNumber(1, 'not_a_locale', {}, '?')).toBe('?');
    expect(formatCurrency(1, '?', 'en', {}, '-')).toBe('-');
    expect(formatDate(new Date(NaN))).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(0, 'en', { timeZone: 'bad' }, '?')).toBe('?');
    expect(formatRelativeTime('bad')).toBe('');
    expect(formatRelativeTime(0, 'en', { now: NaN }, '?')).toBe('?');
  });
  test('dispatcher and bound functions', () => {
    const bound = createFormatter({ locale: 'en-US', currency: 'GBP' });
    expect(bound.formatCurrency(2)).toBe('£2.00');
    expect(bound.format(2, 'currency', { currency: 'EUR' })).toBe('€2.00');
    expect(bound.formatNumber(1000)).toBe('1,000');
    expect(bound.formatPercent(0.5)).toBe('50%');
    expect(bound.formatCompact(1200)).toBe('1.2K');
    expect(bound.formatDate(0, { timeZone: 'UTC' })).toBe('1/1/1970');
    expect(bound.formatDateTime(0, { timeZone: 'UTC' })).toContain('1970');
    expect(bound.formatRelativeTime(0, { now: 0 })).toBe('now');
    for (const kind of ['number', 'currency', 'percent', 'compact', 'date', 'datetime', 'relative'] as const) expect(format(null, kind, { fallback: '-' })).toBe('-');
    expect(format(42, 'text')).toBe('42');
    expect(format(null, 'text')).toBe('');
    expect(format({ toString() { throw Error(); } }, 'text', { fallback: '?' })).toBe('?');
    expect(format(0, 'relative', { now: 0, locale: 'en' })).toBe('now');
  });
});
