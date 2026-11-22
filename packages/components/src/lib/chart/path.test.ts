import { expect, test } from 'bun:test';
import { areaPath, barPath, defined, formatCoord, linePath, type PathOptions, type Point } from './path';

function referencePath(points: readonly (readonly [number, number])[], options: PathOptions): string {
  if (!points.length) return '';
  const f = (value: number) => formatCoord(value, options.precision);
  const slopes = points.slice(1).map(([x, y], i) => x !== points[i][0] ? (y - points[i][1]) / (x - points[i][0]) : 0);
  const tangents = points.map((_, i) => !i ? slopes[0] : i === points.length - 1 ? slopes[i - 1] : slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  for (let i = 0; i < slopes.length; i++) {
    if (!slopes[i]) { tangents[i] = tangents[i + 1] = 0; continue; }
    const a = tangents[i] / slopes[i], b = tangents[i + 1] / slopes[i], norm = Math.hypot(a, b);
    if (norm > 3) { const factor = 3 / norm; tangents[i] = factor * a * slopes[i]; tangents[i + 1] = factor * b * slopes[i]; }
  }
  return points.map(([x, y], i) => {
    if (!i) return `M${f(x)},${f(y)}`;
    const [x0, y0] = points[i - 1], dx = (x - x0) / 3;
    if (options.curve === 'step') return `H${f((x0 + x) / 2)}V${f(y)}H${f(x)}`;
    if (options.curve === 'monotone') return `C${f(x0 + dx)},${f(y0 + tangents[i - 1] * dx)},${f(x - dx)},${f(y - tangents[i] * dx)},${f(x)},${f(y)}`;
    return `L${f(x)},${f(y)}`;
  }).join('');
}

test('packed paths preserve fixed precision, binary rounding ties and exponent notation', () => {
  const values = [0, -0, NaN, Infinity, -Infinity, 0.005, -0.005, 1.005, 1.015, 1.335, -1.335, 0.125, -0.125, 9.999, 99.999, 999.999, 9999.999, -9999.999, 999999.995, 1e-7, -1e-7, Number.MIN_VALUE, Number.MAX_VALUE];
  let seed = 3;
  for (let i = 0; i < 2000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = (seed / 2 ** 32 - 0.5) * 10 ** (i % 40 - 16);
    values.push(value, (Math.floor(value * 100) + 0.5) / 100);
  }
  const points = values.map(value => [value, value] as const);
  for (const precision of [-3, 0, 0.9, 1, 2, 3, 6, 7, 10, 12, 20, NaN, Infinity]) {
    let move = true;
    const expected = values.map(value => {
      if (!Number.isFinite(value)) { move = true; return ''; }
      const text = `${move ? 'M' : 'L'}${formatCoord(value, precision)},${formatCoord(value, precision)}`;
      move = false; return text;
    }).join('');
    expect(linePath(points, { precision })).toBe(expected);
  }
});

test('line and area buffers match the original geometry for all curves and reversed baselines', () => {
  const points = Array.from({ length: 1200 }, (_, i) => [i / 10, Math.sin(i / 7) * 100] as const);
  const lower = points.map(([x, y]) => [x, y / 3 - 100] as const);
  const objects = points.map(([x, y]) => ({ x, y }));
  for (const curve of ['linear', 'step', 'monotone'] as const) for (const precision of [0, 2, 6, 12]) {
    const options = { curve, precision }, expected = referencePath(points, options);
    expect(linePath(objects, options)).toBe(expected);
    expect(areaPath(points, lower, options)).toBe(expected + referencePath([...lower].reverse(), options).replace(/^M/, 'L') + 'Z');
    expect(areaPath(points, -5, options)).toBe(expected + referencePath(points.map(([x]) => [x, -5] as const).reverse(), options).replace(/^M/, 'L') + 'Z');
  }
  const options = { curve: 'monotone' } as const;
  const withGaps = [...points.slice(0, 7), null, ...points.slice(9, 13)];
  expect(linePath(withGaps, options)).toBe(referencePath(points.slice(0, 7), options) + referencePath(points.slice(9, 13), options));
  expect(areaPath(points, lower.slice(0, 5), options)).toBe(referencePath(points.slice(0, 5), options) + referencePath(lower.slice(0, 5).reverse(), options).replace(/^M/, 'L') + 'Z');
});

test('pooled buffers tolerate nested calls, throwing predicates and shorter reused baselines', () => {
  const points = [[0, 1], [1, 2], [2, 3]] as const;
  expect(linePath(points, { defined: () => { expect(areaPath([[0, 1]])).toBe('M0,1L0,0Z'); return true; } })).toBe('M0,1L1,2L2,3');
  expect(() => areaPath(points, 0, { defined: () => { throw new Error('stop'); } })).toThrow('stop');
  expect(areaPath(points, points)).toBe('M0,1L1,2L2,3L2,3L1,2L0,1Z');
  expect(areaPath(points, [[0, -1]])).toBe('M0,1L0,-1Z');
  expect(areaPath(points, [], { defined: () => { throw new Error('invalid bottom'); } })).toBe('');
  expect(linePath(points)).toBe('M0,1L1,2L2,3');
});

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
