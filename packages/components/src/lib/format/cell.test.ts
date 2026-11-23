import { expect, test } from 'bun:test';
import { formatCell, inferType, numericCell } from './cell';

const context = { locale: 'en-US', currencyCode: 'USD' };
test('cell formatting retains inference, currency parsing and explicit intermediate values', () => {
  expect(inferType(['1,200', 20])).toBe('number');
  expect(inferType(['€1,200'])).toBe('currency');
  expect(inferType(['2026-01-01'])).toBe('date');
  expect(formatCell('€1,200', { key: 'cost', type: 'currency' }, context)).toBe('€1,200.00');
  expect(formatCell(20, { key: 'cost', type: 'number' }, context, 12)).toBe('12');
});
test('empty, non-scalar and invalid cells retain their existing fallbacks', () => {
  expect(inferType([])).toBe('text');
  expect(inferType(['2026-99-99'])).toBe('text');
  expect(numericCell('', { key: 'cost', type: 'number' })).toBeUndefined();
  expect(numericCell({}, { key: 'cost', type: 'number' })).toBeUndefined();
  expect(numericCell('invalid', { key: 'cost', type: 'number' })).toBeNaN();
  expect(formatCell(null, { key: 'cost', type: 'currency' }, context)).toBe('');
});
