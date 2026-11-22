import { expect, test } from 'bun:test';
import { createStore, type Patch } from '../src';

test('a string delete does not delete character-named state keys', () => {
  const store = createStore({ initial: { a: 1, b: 2 } });
  store.apply({ delete: 'ab' } as unknown as Patch);
  expect(store.snapshot()).toEqual({ a: 1, b: 2 });
});

test('malformed patch operations are ignored without character deletes or writes', () => {
  const store = createStore({ initial: { a: 1, b: 2, keep: true } });
  for (const patch of [null, undefined, 'bad', { delete: 'ab' }, { set: ['wrong'] }, { merge: 'bad' }, { set: new Date() }]) {
    expect(() => store.apply(patch as unknown as Patch)).not.toThrow();
    expect(store.snapshot()).toEqual({ a: 1, b: 2, keep: true });
  }
  expect(store.canUndo()).toBe(false);
  store.apply({ set: { x: 3 }, merge: { object: { y: 4 } }, delete: [null, 0, {}, 'a'] } as unknown as Patch);
  expect(store.snapshot()).toEqual({ b: 2, keep: true, x: 3, object: { y: 4 } });
  store.undo(); expect(store.snapshot()).toEqual({ a: 1, b: 2, keep: true });
});
