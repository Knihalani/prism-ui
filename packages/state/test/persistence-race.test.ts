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

test('rejected hydration resolves ready, saves pending edits once, and resumes persistence', async () => {
  let reject!: (error: Error) => void;
  const saves: object[] = [];
  const store = createStore({ initial: { kept: true }, persist: {
    load: () => new Promise<object>((_, fail) => { reject = fail; }), save: (_, data) => { saves.push(data); },
  } });
  store.batch(() => { store.set('edited', 1); store.set('second', 2); });
  store.set('third', 3); expect(saves).toEqual([]);
  reject(Error('offline'));
  await expect(store.ready).resolves.toBeUndefined();
  expect(store.snapshot()).toEqual({ kept: true, edited: 1, second: 2, third: 3 });
  expect(saves).toEqual([store.snapshot()]);
  store.set('edited', 4); expect(saves).toHaveLength(2); expect(saves[1]).toEqual(store.snapshot());
});

test('failed hydration without edits resolves ready and saves subsequent changes', async () => {
  for (const load of [() => { throw Error('offline'); }, () => Promise.reject(Error('offline'))]) {
    const saves: object[] = [];
    const store = createStore({ initial: { kept: true }, persist: { load, save: (_, data) => { saves.push(data); } } });
    await expect(store.ready).resolves.toBeUndefined();
    expect(store.snapshot()).toEqual({ kept: true }); expect(saves).toEqual([]);
    store.set('edited', 1); expect(saves).toEqual([{ kept: true, edited: 1 }]);
  }
});
