import { expect, test } from 'bun:test';
import { aggregate, pivotLongToWide, pivotWideToLong, sortBy, switchX, topN } from './pivot';

const rows = [{ month: 'Jan', series: 'a', value: 2 }, { month: 'Jan', series: 'b', value: 3 }, { month: 'Feb', series: 'a', value: 4 }];
test('long/wide pivots preserve order, numeric values and missing cells', () => {
  const wide = pivotLongToWide(rows, { x: 'month', series: 'series', value: 'value' });
  expect(wide).toEqual([{ month: 'Jan', a: 2, b: 3 }, { month: 'Feb', a: 4 }]);
  expect(pivotWideToLong(wide, { x: 'month', keys: ['a', 'b'] })).toEqual(rows);
  expect(pivotLongToWide([...rows, rows[0]], { x: 'month', series: 'series', value: 'value' })[0].a).toBe(4);
  expect(pivotLongToWide([], { x: 'x', series: 's', value: 'v' })).toEqual([]);
  expect(pivotWideToLong([], { x: 'x', keys: [] })).toEqual([]);
});
test('aggregation supports every reducer and invalid/missing values', () => {
  const input = [{ x: 1, s: 'a', v: 2 }, { x: 1, s: 'a', v: 6 }, { x: 1, s: 'a', v: null }, { x: 1, s: 'b', v: NaN }];
  for (const [op, expected] of [['sum', 8], ['avg', 4], ['min', 2], ['max', 6], ['count', 3]] as const) {
    const result = aggregate(input, { x: 'x', series: 's', value: 'v', op });
    expect(result[0].v).toBe(expected); expect(result[1].v).toBe(op === 'count' ? 1 : op === 'sum' ? 0 : null);
  }
  expect(aggregate(input, { x: 'x', value: 'v', op: 'avg' })).toEqual([{ x: 1, v: 4 }]);
  expect(aggregate([], { x: 'x', value: 'v' })).toEqual([]);
});
test('pivot protects object prototypes and rejects colliding columns', () => {
  const result = pivotLongToWide([{ x: 1, s: '__proto__', v: 2 }, { x: 1, s: 'constructor', v: 3 }], { x: 'x', series: 's', value: 'v' });
  expect(Object.getPrototypeOf(result[0])).toBe(Object.prototype); expect(Object.hasOwn(result[0], '__proto__')).toBe(true); expect(result[0].__proto__).toBe(2);
  expect(() => pivotLongToWide([{ x: 1, s: 'x', v: 2 }], { x: 'x', series: 's', value: 'v' })).toThrow('collides');
});
test('switching x, ranking Other and sorting are immutable and stable', () => {
  expect(switchX(rows, 'series').map(row => row.x)).toEqual(['a', 'b', 'a']); expect('x' in rows[0]).toBe(false);
  expect(topN(rows, 'value', 1, { labelKey: 'month' })).toEqual([{ month: 'Feb', series: 'a', value: 4 }, { month: 'Other', value: 5 }]);
  expect(topN(rows, 'value', 0)).toEqual([{ label: 'Other', value: 9 }]); expect(topN([], 'value', 10)).toEqual([]);
  expect(topN(rows, 'value', 100)).toHaveLength(3);
  expect(sortBy(rows, 'value', 'desc').map(row => row.value)).toEqual([4, 3, 2]);
  expect(sortBy([{ v: null }, { v: 2 }, { v: NaN }, { v: 1 }], 'v').map(row => row.v)).toEqual([1, 2, null, NaN]);
  expect(sortBy(rows, row => row.series).map(row => row.value)).toEqual([2, 4, 3]); expect(rows[0].value).toBe(2);
});
