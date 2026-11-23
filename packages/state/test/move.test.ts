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

test.each(['007', 'group.007', '7'])('record moves preserve numeric key %s through serialization and both history stacks', id => {
  const store = createStore({ initial: { old: { overall: 'Initial', items: [] } } });
  store.set('old.overall', 'Edited'); store.set('old.overall', 'Future'); store.undo();
  const path = `__prism.feedback.${id}`;
  store.move('old', path, { record: true });
  const restored = () => createStore({ initial: JSON.parse(JSON.stringify(store.snapshot())) });
  expect(Array.isArray(store.get('__prism.feedback'))).toBe(false);
  expect(restored().get(`${path}.overall`)).toBe('Edited');
  expect(store.get('old')).toBeUndefined();
  store.undo(path); expect(restored().get(`${path}.overall`)).toBe('Initial');
  store.redo(path); store.redo(path); expect(restored().get(`${path}.overall`)).toBe('Future');
  store.undo(); expect(restored().get(`${path}.overall`)).toBe('Edited');
});

test('record moves normalize array ancestors even when the destination value already matches', () => {
  const values = Object.assign([], { '007': 5 });
  const store = createStore({ initial: { old: 5, __prism: { feedback: values } } });
  store.move('old', '__prism.feedback.007', { record: true });
  expect(store.snapshot()).toEqual({ __prism: { feedback: { '007': 5 } } });
  expect(store.canUndo()).toBe(false);
});
