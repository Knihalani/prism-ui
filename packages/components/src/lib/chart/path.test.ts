import { expect, test } from 'bun:test';
import { areaPath, barPath, defined, formatCoord, linePath, type Point } from './path';

test('line, step, gaps, singleton, custom defined and compact precision', () => {
  expect(linePath([[0, 1], [2, 3], null, [4, 5], [5, null], [6, NaN]])).toBe('M0,1L2,3M4,5');
  expect(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }], { curve: 'step' })).toBe('M0,1H1V3H2');
  expect(linePath([[0, 1], [1, 2], [2, 3]], { defined: (_, index) => index !== 1 })).toBe('M0,1M2,3');
  expect(linePath([])).toBe(''); expect(linePath([null, [NaN, 1]])).toBe('');
  expect(formatCoord(-0.0001)).toBe('0'); expect(formatCoord(1.23456)).toBe('1.23'); expect(defined([0, null])).toBe(false);
});
test('Fritsch–Carlson cubic segments never overshoot endpoint y bounds', () => {
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let sample = 0; sample < 100; sample++) {
    const points: Point[] = []; let x = 0;
    for (let i = 0; i < 20; i++) { x += random() * 10 + 0.01; points.push([x, Math.round(random() * 100) - 50]); }
    const path = linePath(points, { curve: 'monotone', precision: 10 });
    const segments = [...path.matchAll(/C([^C]+)/g)];
    expect(segments).toHaveLength(points.length - 1);
    for (let i = 0; i < segments.length; i++) {
      const [, c1, , c2, , end] = segments[i][1].split(',').map(Number);
      const begin = (points[i] as readonly [number, number])[1];
      for (let step = 0; step <= 20; step++) {
        const t = step / 20, u = 1 - t;
        const y = u ** 3 * begin + 3 * u ** 2 * t * c1 + 3 * u * t ** 2 * c2 + t ** 3 * end;
        expect(y).toBeGreaterThanOrEqual(Math.min(begin, end) - 1e-8);
        expect(y).toBeLessThanOrEqual(Math.max(begin, end) + 1e-8);
      }
    }
  }
  for (const points of [[[0, 2], [0, 5], [1, 5]], [[3, 8], [2, 2], [0, -1]]] as const) expect(linePath(points, { curve: 'monotone' })).not.toMatch(/NaN|Infinity/);
});
test('areas close each gap independently using constant or varying baselines', () => {
  expect(areaPath([[0, 2], [1, 3]], 0)).toBe('M0,2L1,3L1,0L0,0Z');
  expect(areaPath([[0, 2], null, [2, 4]], [[0, 1], [1, 0], [2, 2]])).toBe('M0,2L0,1ZM2,4L2,2Z');
  expect(areaPath([[0, 2]], NaN)).toBe(''); expect(areaPath([])).toBe('');
});
test('rounded bars clamp radius, support top-only corners and negative dimensions', () => {
  const options = { x: 1, y: 2, width: 10, height: 20, radius: 99 };
  expect(barPath(options)).toBe('M6,2H6Q11,2,11,7V17Q11,22,6,22H6Q1,22,1,17V7Q1,2,6,2Z');
  expect(barPath({ ...options, topOnly: true })).toContain('V22H1V7');
  expect(barPath({ x: 11, y: 22, width: -10, height: -20, radius: 99 })).toBe(barPath(options));
  expect(barPath({ ...options, width: 0 })).toBe(''); expect(barPath({ ...options, x: NaN })).toBe('');
});
