import { expect, test } from 'bun:test';
import { arcCentroid, arcLabel, arcPath, pie } from './pie';

test('pie preserves input order, optional sorting, proportions and padding', () => {
  const arcs = pie([1, 3]);
  expect(arcs[0].startAngle).toBe(0); expect(arcs[0].endAngle).toBeCloseTo(Math.PI / 2); expect(arcs[1].endAngle).toBeCloseTo(Math.PI * 2);
  const sorted = pie([1, 3, 2], { sort: true, padAngle: 0.1 });
  expect(sorted.map(arc => arc.index)).toEqual([0, 1, 2]); expect(sorted.map(arc => arc.order)).toEqual([2, 0, 1]);
  expect(sorted[1].startAngle).toBeCloseTo(0.05);
  expect(sorted.reduce((sum, arc) => sum + arc.endAngle - arc.startAngle + arc.padAngle, 0)).toBeCloseTo(Math.PI * 2);
  expect(pie([3, 1], { sort: (a, b) => a - b })[1].order).toBe(0);
  expect(pie([1, 1], { startAngle: 0, endAngle: -Math.PI })[1].endAngle).toBeCloseTo(-Math.PI);
});
test('pie handles empty, zero, negative, invalid and very large values', () => {
  expect(pie([])).toEqual([]); expect(pie([null, NaN, -2, 0]).every(arc => arc.startAngle === arc.endAngle)).toBe(true);
  expect(pie([1], { startAngle: NaN })).toEqual([]);
  expect(pie([Number.MAX_VALUE, Number.MAX_VALUE])[0].endAngle).toBeCloseTo(Math.PI);
  expect(pie([1, 1], { padAngle: 20 }).every(arc => Math.abs(arc.endAngle - arc.startAngle) < 1e-10)).toBe(true);
});
test('arc paths support wedges, full circles, donuts, reversed angles and rounding', () => {
  const arc = { outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 };
  expect(arcPath(arc)).toBe('M0,-10A10,10,0,0,1,10,0L0,0Z');
  expect(arcPath({ ...arc, endAngle: Math.PI * 2 }).match(/A/g)).toHaveLength(2);
  const donut = arcPath({ ...arc, innerRadius: 5, endAngle: Math.PI * 2 });
  expect(donut.match(/A/g)).toHaveLength(4); expect(donut.match(/Z/g)).toHaveLength(2);
  expect(arcPath({ ...arc, endAngle: -Math.PI / 2 })).toContain('0,0,0,-10,0');
  expect(arcPath({ ...arc, innerRadius: 4, cornerRadius: 2 }).match(/Q/g)).toHaveLength(4);
  expect(arcPath({ ...arc, innerRadius: 10 })).toBe(''); expect(arcPath({ ...arc, outerRadius: NaN })).toBe('');
  expect(arcPath({ ...arc, endAngle: 0 })).toBe('');
  expect(arcPath({ ...arc, outerRadius: 4, innerRadius: 10 })).toBe(arcPath({ ...arc, innerRadius: 4 }));
});
test('centroid and outside labels expose leader line and anchor geometry', () => {
  const arc = { innerRadius: 10, outerRadius: 20, startAngle: 0, endAngle: Math.PI };
  const [x, y] = arcCentroid(arc); expect(x).toBeCloseTo(15); expect(y).toBeCloseTo(0);
  const label = arcLabel(arc, { offset: 5, labelOffset: 10 });
  expect(label.x).toBe(35); expect(label.y).toBeCloseTo(0); expect(label.anchor).toBe('start'); expect(label.leader[0][0]).toBeCloseTo(20);
  expect(arcLabel({ ...arc, startAngle: Math.PI, endAngle: Math.PI * 2 }).anchor).toBe('end');
});
