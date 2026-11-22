import { expect, test } from 'bun:test';
import { createStore } from '../src';

test('namespace moves rewrite both history stacks without recording migration', () => {
  const store = createStore({ initial: { provisional: { a: false, b: false }, unrelated: 1 } });
  store.set('provisional.a', true); store.set('provisional.b', true); store.undo();
  store.move('provisional', 'final');
  expect(store.snapshot()).toEqual({ final: { a: true, b: false }, unrelated: 1 });
  expect(store.canUndo('provisional')).toBe(false); expect(store.canRedo('final')).toBe(true);
  store.undo('final'); expect(store.get('final')).toEqual({ a: false, b: false });
  store.redo('final'); store.redo('final'); expect(store.get('final')).toEqual({ a: true, b: true });
  store.undo(); expect(store.get('final')).toEqual({ a: true, b: false });
  expect(store.get('provisional')).toBeUndefined();
});

test('moves fill missing destination fields, prune ancestors, and reject unsafe namespaces', () => {
  const store = createStore({ initial: { old: { child: { value: 1, fresh: true } }, final: { value: 9 } } });
  store.move('old.child', 'final');
  expect(store.snapshot()).toEqual({ final: { value: 9, fresh: true } });
  store.move('final', '__proto__.polluted'); store.move('missing', 'other'); store.move('final', 'final');
  expect(store.snapshot()).toEqual({ final: { value: 9, fresh: true } });
  expect(store.canUndo()).toBe(false);
});
