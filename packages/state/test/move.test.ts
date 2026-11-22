import { expect, test } from 'bun:test';
import { createStore } from '../src';

test.each(['undo', 'redo'])('moves split ancestor writes across destination and remaining %s history', travel => {
  const store = createStore({ initial: { outer: { keep: 0 } } });
  store.set('outer', { branch: { child: { value: 1 }, sibling: 3 }, keep: 2 });
  if (travel === 'redo') store.undo();
  store.move('outer.branch.child', 'final');
  if (travel === 'undo') {
    expect(store.canUndo('final')).toBe(true); store.undo('final');
    expect(store.snapshot()).toEqual({ outer: { branch: { sibling: 3 }, keep: 2 } });
    store.undo('outer'); expect(store.snapshot()).toEqual({ outer: { keep: 0 } });
  } else expect(store.canRedo('final')).toBe(true);
  store.redo('final');
  expect(store.snapshot()).toEqual({ outer: { keep: 0 }, final: { value: 1 } });
  store.redo('outer');
  expect(store.snapshot()).toEqual({ outer: { branch: { sibling: 3 }, keep: 2 }, final: { value: 1 } });
});

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
