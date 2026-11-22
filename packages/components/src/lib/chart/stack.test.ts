import { expect, test } from 'bun:test';
import { stack } from './stack';

test('stack produces per-key tuples with cumulative baselines', () => {
  const rows = [{ a: 2, b: 3 }, { a: 4, b: 1 }];
  const result = stack(rows, ['a', 'b']);
  expect(result.map(series => series.key)).toEqual(['a', 'b']);
  expect([...result[0]]).toEqual([[0, 2], [0, 4]]); expect([...result[1]]).toEqual([[2, 5], [4, 5]]);
  expect(rows).toEqual([{ a: 2, b: 3 }, { a: 4, b: 1 }]);
});
test('stack normalizes positive and signed values and separates diverging values', () => {
  const normalized = stack([{ a: 2, b: 6 }, { a: 0, b: 0 }], ['a', 'b'], { offset: 'expand' });
  expect(normalized[0][0]).toEqual([0, 0.25]); expect(normalized[1][0]).toEqual([0.25, 1]); expect(normalized[1][1]).toEqual([0, 0]);
  const result = stack([{ a: -3, b: 2, c: -4 }], ['a', 'b', 'c'], { offset: 'diverging' });
  expect(result.map(series => series[0])).toEqual([[0, -3], [0, 2], [-3, -7]]);
  const signed = stack([{ a: -2, b: 6 }], ['a', 'b'], { offset: 'expand' }); expect(signed[1][0]).toEqual([-0.25, 0.5]);
});
test('empty stacks, missing values and non-finite inputs are safe', () => {
  expect(stack([], ['a'])).toHaveLength(1); expect(stack([{ a: 2 }], [])).toEqual([]);
  expect(stack([{ a: null, b: NaN }, { a: 2, b: Infinity }], ['a', 'b']).map(series => [...series])).toEqual([[[0, 0], [0, 2]], [[0, 0], [2, 2]]]);
});
