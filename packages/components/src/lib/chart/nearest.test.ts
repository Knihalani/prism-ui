import { expect, test } from 'bun:test';
import { bandIndex, nearestPoint, nearestX } from './nearest';
import { scaleBand } from './scale';

test('binary nearest x matches a scan for sorted inputs with logarithmic reads', () => {
  const xs = Float64Array.from({ length: 10000 }, (_, i) => i * 2);
  for (let i = -5; i < 20005; i += 173) expect(nearestX(xs, i)).toBe(Math.max(0, Math.min(9999, Math.ceil(i / 2 - 0.5))));
  let reads = 0;
  const proxy = new Proxy({ length: 1_000_000 }, { get: (target, key) => key === 'length' ? target.length : (reads++, Number(key) * 2) });
  expect(nearestX(proxy as unknown as ArrayLike<number>, 12345)).toBe(6172); expect(reads).toBeLessThan(30);
  expect(nearestX([], 1)).toBe(-1); expect(nearestX([1], NaN)).toBe(-1); expect(nearestX([null, 1, NaN, 8], 7)).toBe(3);
  expect(nearestX([NaN, null], 4)).toBe(-1); expect(nearestX([2, 2, 3], 2)).toBe(0);
});
test('2-D nearest scans series, ignores invalid points and respects max distance', () => {
  const result = nearestPoint([[[0, 0], null, [NaN, 3]], [[2, 3], [10, 20]]], 2, 4);
  expect(result).toEqual({ series: 1, index: 0, point: [2, 3], distance: 1 });
  expect(nearestPoint([[[1, 2]]], 1, 2)?.distance).toBe(0);
  expect(nearestPoint([[[1, 2]]], 1, 8, 2)).toBeUndefined(); expect(nearestPoint([], 0, 0)).toBeUndefined();
  expect(nearestPoint([[[1, 2]]], NaN, 0)).toBeUndefined();
});
test('band hover lookup handles reversed ranges, gaps and outside pointers', () => {
  const scale = scaleBand({ domain: ['a', 'b'], range: [100, 0], paddingInner: 0.2 });
  expect(bandIndex(80, scale)).toBe(0); expect(bandIndex(20, scale)).toBe(1); expect(bandIndex(-1, scale)).toBe(-1);
});
