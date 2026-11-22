import { expect, test } from 'bun:test';
import { overlaps, placeLabels, relaxPieLabels, thinAxisLabels } from './labels';

test('axis thinning chooses regular strides, keeps ends and supports vertical axes', () => {
  const labels = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0, w: 22, h: 8, id: i }));
  const result = thinAxisLabels(labels, { gap: 0 });
  expect(result.map(label => label.id)).toEqual([0, 3, 6, 9]);
  const vertical = labels.map(label => ({ ...label, y: label.x, x: 0, h: 22 }));
  expect(thinAxisLabels(vertical, { orientation: 'vertical', gap: 0 }).map(label => label.id)).toEqual([0, 3, 6, 9]);
  expect(thinAxisLabels(labels.slice(0, 2))).toHaveLength(2);
  expect(thinAxisLabels(labels.slice(0, 2), { keepEnds: false })).toHaveLength(1);
  expect(thinAxisLabels([])).toEqual([]); expect(thinAxisLabels([{ ...labels[0], x: NaN }])).toEqual([]);
});
test('2-D placement prioritizes important labels, tries offsets and respects bounds', () => {
  const labels = [{ x: 0, y: 0, w: 10, h: 10, priority: 1 }, { x: 0, y: 0, w: 10, h: 10, priority: 10 }];
  const { placed, dropped } = placeLabels(labels, { offsets: [[0, 0]], bounds: { x: 0, y: 0, w: 20, h: 20 } });
  expect(placed.map(label => label.priority)).toEqual([10]); expect(dropped.map(label => label.priority)).toEqual([1]);
  const shifted = placeLabels(labels); expect(shifted.placed).toHaveLength(2); expect(overlaps(...shifted.placed as [typeof labels[0], typeof labels[0]])).toBe(false);
  expect(labels[0].y).toBe(0); expect(placeLabels([{ ...labels[0], h: -1 }]).dropped).toHaveLength(1); expect(placeLabels([]).placed).toEqual([]);
});
test('pie label relaxation separates sides and drops low-priority overflow', () => {
  const labels = Array.from({ length: 8 }, (_, i) => ({ x: i < 4 ? -40 : 40, y: 0, w: 20, h: 10, priority: i, id: i }));
  const result = relaxPieLabels(labels, { minY: -20, maxY: 20, gap: 2 });
  expect(result.placed).toHaveLength(6); expect(result.dropped.map(label => label.id).sort()).toEqual([0, 4]);
  for (const side of [-1, 1]) {
    const group = result.placed.filter(label => Math.sign(label.x) === side).sort((a, b) => a.y - b.y);
    for (let i = 0; i < group.length; i++) { expect(group[i].y).toBeGreaterThanOrEqual(-20); expect(group[i].y + group[i].h).toBeLessThanOrEqual(20); if (i) expect(group[i].y).toBeGreaterThanOrEqual(group[i - 1].y + group[i - 1].h + 2); }
  }
  expect(relaxPieLabels([]).placed).toEqual([]); expect(labels.every(label => label.y === 0)).toBe(true);
});
