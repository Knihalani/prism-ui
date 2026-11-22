import { expect, test } from 'bun:test';
import { createStore } from '../src';

test.each(['items.2', 'items.2.label'])('scoped undo restores array length after an indexed append at %s', path => {
  const store = createStore({ initial: { items: ['a', 'b'], other: 0 } });
  store.set(path, 'c'); store.set('other', 1);
  store.undo('items');
  expect(store.get('items')).toEqual(['a', 'b']); expect(store.get('items.length')).toBe(2);
  expect(store.snapshot()).toEqual({ items: ['a', 'b'], other: 1 });
  store.undo(); expect(store.snapshot()).toEqual({ items: ['a', 'b'], other: 0 });
  store.redo(); store.redo('items'); expect(store.get('items.length')).toBe(3);
  expect(store.get(path)).toBe('c');
});

test('undoing an earlier array index preserves a later unrelated index', () => {
  const store = createStore({ initial: { items: ['a', 'b'] } });
  store.set('items.2', 'c'); store.set('items.3', 'd'); store.undo('items.2');
  expect(store.get('items.length')).toBe(4); expect(store.get('items.3')).toBe('d');
  store.redo('items.2'); expect(store.get('items')).toEqual(['a', 'b', 'c', 'd']);
});

test('scoped undo skips unrelated entries and rebases their snapshots for global travel', () => {
  const store = createStore({ initial: { first: { qty: 5 }, second: { qty: 5 } } });
  store.set('first.qty', 6); store.set('second.qty', 7);
  store.undo('first');
  expect(store.snapshot()).toEqual({ first: { qty: 5 }, second: { qty: 7 } });
  expect(store.canUndo('first')).toBe(false); expect(store.canUndo('second')).toBe(true);
  store.undo();
  expect(store.snapshot()).toEqual({ first: { qty: 5 }, second: { qty: 5 } });
  store.redo(); store.redo('first');
  expect(store.snapshot()).toEqual({ first: { qty: 6 }, second: { qty: 7 } });
});

test('scoped redo can skip unrelated redo entries without resurrecting their values', () => {
  const store = createStore({ initial: { a: 0, b: 0 } });
  store.set('a', 1); store.set('b', 2); store.undo(); store.undo();
  store.redo('b');
  expect(store.snapshot()).toEqual({ a: 0, b: 2 });
  store.redo(); expect(store.snapshot()).toEqual({ a: 1, b: 2 });
  store.undo(); store.undo(); expect(store.snapshot()).toEqual({ a: 0, b: 0 });
});

test('scoped travel splits a mixed batch and matches only exact path segments', () => {
  const store = createStore({ initial: { a: { x: 0 }, ab: 0 } });
  store.batch(() => { store.set('a.x', 1); store.set('ab', 2); });
  store.undo('a'); expect(store.snapshot()).toEqual({ a: { x: 0 }, ab: 2 });
  expect(store.canUndo('a')).toBe(false); expect(store.canRedo('a')).toBe(true);
  store.undo('ab'); store.redo('a');
  expect(store.snapshot()).toEqual({ a: { x: 1 }, ab: 0 });
  store.redo(); expect(store.get('ab')).toBe(2);
});

test('scoped travel is inert without matching history and preserves unscoped snapshots', () => {
  const store = createStore({ initial: { a: 0 } });
  store.undo('missing'); store.redo('missing');
  expect(store.canUndo()).toBe(false); expect(store.canRedo('missing')).toBe(false);
  store.set('a', 1); store.set('derived', 2, { history: false });
  store.undo(); expect(store.snapshot()).toEqual({ a: 0 });
  store.redo(); expect(store.snapshot()).toEqual({ a: 1, derived: 2 });
});
