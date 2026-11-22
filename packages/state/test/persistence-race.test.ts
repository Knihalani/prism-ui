import { expect, test } from 'bun:test';
import { createStore } from '../src';

test('pending loads do not save incomplete state and preserve local edits over loaded data', async () => {
  let resolve!: (data: object) => void;
  const saves: object[] = [];
  const store = createStore({ initial: { defaults: true, profile: { name: 'initial' }, removed: 0 }, persist: {
    load: () => new Promise<object>(done => { resolve = done; }), save: (_, data) => { saves.push(data); },
  } });
  store.set('profile.name', 'edited'); store.set('local', 2); store.apply({ delete: ['removed'] });
  expect(saves).toEqual([]);
  resolve({ profile: { name: 'persisted', city: 'London' }, remote: 3, removed: 1 }); await store.ready;
  expect(store.snapshot()).toEqual({ defaults: true, profile: { name: 'edited', city: 'London' }, local: 2, remote: 3 });
  expect(saves).toEqual([store.snapshot()]);
  store.set('remote', 4); expect(saves).toHaveLength(2);
});

test('pending parent replacement wins and undo before load restores the current local value', async () => {
  let resolve!: (data: object) => void;
  const store = createStore({ initial: { count: 0 }, persist: { load: () => new Promise<object>(done => { resolve = done; }), save() {} } });
  store.set('object', { local: 1 }); store.set('count', 1); store.undo();
  resolve({ object: { remote: 2 }, count: 9, untouched: true }); await store.ready;
  expect(store.snapshot()).toEqual({ object: { local: 1 }, count: 0, untouched: true });
});
