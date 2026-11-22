import { expect, test } from 'bun:test';
import { compile, createStore } from '../src';

test('indexed appends notify array length formulas, including undo and redo', () => {
  const store = createStore({ initial: { list: [1], other: [0] } });
  const formula = compile('list.length'), lengths: number[] = [];
  store.subscribe('list.length', () => lengths.push(formula(store.get)));
  store.set('list.3', 4); expect(lengths).toEqual([4]);
  store.undo(); expect(lengths).toEqual([4, 1]); store.redo(); expect(lengths).toEqual([4, 1, 4]);
  store.set('list.0', 2); store.set('other.2', 2); expect(lengths).toEqual([4, 1, 4]);
  store.apply({ delete: ['list.3'] }); expect(lengths).toEqual([4, 1, 4]);
});

test('nested and newly created array lengths notify once per batch', () => {
  const store = createStore(); let outer = 0, inner = 0, unrelated = 0;
  store.subscribe('groups.length', () => outer++); store.subscribe('groups.0.items.length', () => inner++); store.subscribe('other.length', () => unrelated++);
  store.batch(() => { store.set('groups.0.items.2', 3); store.set('groups.0.items.3', 4); });
  expect([outer, inner, unrelated]).toEqual([1, 1, 0]);
  store.undo(); expect([outer, inner, unrelated]).toEqual([2, 2, 0]);
  store.redo(); expect([outer, inner, unrelated]).toEqual([3, 3, 0]);
});
