import { expect, test } from 'bun:test';
import { createStore, type WriteOptions } from '../src';

const derived: WriteOptions = { history: false };

test('no-history set notifies and persists without creating undo entries', () => {
  const saves: object[] = [];
  const store = createStore({ persist: { load: () => ({}), save: (_, state) => saves.push(state) } });
  let calls = 0;
  store.subscribe('total', () => calls++);
  store.set('total', 20, derived); store.set('total', 20, derived);
  store.set('__proto__.value', 1, derived);
  expect(store.get('total')).toBe(20); expect(calls).toBe(1); expect(saves).toEqual([{ total: 20 }]);
  expect(store.canUndo()).toBe(false); expect(store.canRedo()).toBe(false);
  store.undo(); expect(store.get('total')).toBe(20);
});

test('no-history updates and patches preserve redo, including merges and deletes', () => {
  const store = createStore({ initial: { qty: 2, total: 20, obsolete: true, meta: { a: 1 } } });
  store.set('qty', 3); store.undo();
  store.update('total', value => value + 1, derived);
  store.apply({ set: { initialized: true }, merge: { meta: { b: 2 } }, delete: ['obsolete'] }, derived);
  expect(store.snapshot()).toEqual({ qty: 2, total: 21, initialized: true, meta: { a: 1, b: 2 } });
  expect(store.canUndo()).toBe(false); expect(store.canRedo()).toBe(true);
  store.redo(); expect(store.snapshot()).toEqual({ qty: 3, total: 20, obsolete: true, meta: { a: 1 } });
  store.undo(); expect(store.snapshot()).toEqual({ qty: 2, total: 21, initialized: true, meta: { a: 1, b: 2 } });
});

test('all-no-history batches skip history and mixed nested batches create one entry', () => {
  const store = createStore(); let calls = 0;
  store.subscribe('*', () => calls++);
  store.batch(() => { store.set('a', 1, derived); store.update('b', () => 2, derived); });
  expect(store.canUndo()).toBe(false); expect(calls).toBe(1);
  store.batch(() => { store.set('a', 2, derived); store.batch(() => store.set('b', 3)); });
  expect(calls).toBe(2);
  store.undo(); expect(store.snapshot()).toEqual({ a: 1, b: 2 }); expect(store.canUndo()).toBe(false);
  store.batch(() => { store.set('a', 4); store.batch(() => store.set('b', 5, { history: true })); }, derived);
  expect(store.canUndo()).toBe(false); expect(store.canRedo()).toBe(true);
  store.batch(() => {}); store.set('a', 4); store.apply({}, derived);
  expect(store.canUndo()).toBe(false); expect(store.canRedo()).toBe(true);
});

test('derived writes travel with the preceding change and notify derived subscribers', () => {
  const store = createStore({ initial: { qty: 2, total: 20, stable: true } });
  const totals: number[] = []; let stable = 0;
  store.subscribe('total', () => totals.push(store.get('total')));
  store.subscribe('stable', () => stable++);
  store.set('qty', 3); store.set('total', 30, derived);
  store.undo(); expect(store.snapshot()).toEqual({ qty: 2, total: 20, stable: true });
  expect(store.canUndo()).toBe(false); expect(store.canRedo()).toBe(true);
  store.redo(); expect(store.snapshot()).toEqual({ qty: 3, total: 30, stable: true });
  expect(totals).toEqual([30, 20, 30]); expect(stable).toBe(0);
});

test('reentrant reconciliation after undo preserves redo and restores derived arrays', () => {
  const store = createStore({ initial: { qty: 2, total: 0, rows: [2] } });
  let lengths = 0;
  store.subscribe('rows.length', () => lengths++);
  store.subscribe('qty', () => store.set('total', store.get('qty') * 10, derived));
  store.set('qty', 3); store.set('rows', [3, 3], derived);
  store.undo(); expect(store.get('total')).toBe(20); expect(store.get('rows')).toEqual([2]);
  expect(store.canRedo()).toBe(true);
  store.redo(); expect(store.get('total')).toBe(30); expect(store.get('rows')).toEqual([3, 3]);
  expect(lengths).toBe(3);
});

test('throwing no-history batches restore history mode for subsequent writes', () => {
  const store = createStore();
  expect(() => store.batch(() => { store.set('derived', 1); throw Error('stop'); }, derived)).toThrow('stop');
  expect(store.canUndo()).toBe(false);
  store.set('qty', 1); store.undo();
  expect(store.snapshot()).toEqual({ derived: 1 }); expect(store.canUndo()).toBe(false);
});
