import { test, expect } from 'bun:test';
import { createStore, memoryAdapter, localStorageAdapter, compile, evaluate, FormulaError } from '../src';

test('paths, arrays, identity, updates and precise subscriptions', () => {
  const s = createStore({ initial: { stable: { x: 1 }, a: { b: 1, c: 2 } } });
  const stable = s.get('stable'), a = s.get('a');
  let all = 0, parent = 0, child = 0, sibling = 0;
  s.subscribe('*', () => all++); s.subscribe('a', () => parent++);
  const off = s.subscribe('a.b', () => child++); s.subscribe('a.c', () => sibling++);
  s.set('a.b', 2); s.set('a.b', 2); s.set('stable', stable);
  expect([all, parent, child, sibling]).toEqual([1, 1, 1, 0]);
  expect(s.get('stable')).toBe(stable); expect(s.get('a')).not.toBe(a);
  s.set('items.0.qty', 4); expect(s.get('items')).toEqual([{ qty: 4 }]);
  s.update('items.0.qty', x => x + 1); expect(s.get('items.0.qty')).toBe(5);
  off(); s.set('a', { b: 3, c: 2 }); expect(child).toBe(1);
  expect(sibling).toBe(1); s.undo(); expect(sibling).toBe(2);
  s.undo(); expect(sibling).toBe(2); s.redo();
  s.set('a.b', 3);
  const snapshot = s.snapshot(); snapshot.a.b = 99; expect(s.get('a.b')).toBe(3);
});

test('nested batches, patches and bounded history', () => {
  const s = createStore(); let n = 0; s.subscribe('*', () => n++);
  s.undo(); s.redo(); s.batch(() => {}); expect(n).toBe(0);
  s.batch(() => { s.set('a', 1); s.batch(() => s.set('b', 2)); });
  expect(n).toBe(1); s.undo(); expect(s.snapshot()).toEqual({}); expect(s.canRedo).toBe(true);
  s.redo(); expect(s.get()).toEqual({ a: 1, b: 2 });
  s.apply({ set: { obj: { a: 1, nested: { x: 1 } } }, merge: { obj: { nested: { y: 2 } } }, delete: ['a'] });
  expect(n).toBe(4); expect(s.get('obj')).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  s.undo(); expect(s.get('a')).toBe(1); expect(s.get('obj')).toBeUndefined();
  s.apply({ merge: { empty: {} } }); expect(s.get('empty')).toEqual({});
  s.set('c', 3); expect(s.canRedo).toBe(false);
  for (let i = 0; i < 110; i++) s.set('x', i);
  for (let i = 0; i < 100; i++) s.undo();
  expect(s.canUndo).toBe(false); expect(s.get('x')).toBe(9);
});

test('pollution is blocked in initial, loaded and all write operations', async () => {
  const bad = JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},"ok":2}');
  const s = createStore({ initial: bad, persist: { load: () => bad, save() {} } });
  s.set('__proto__.polluted', 1); s.set('x.constructor.y', 1);
  s.set('value', bad); s.apply({ set: { 'constructor.prototype.polluted': 1 }, merge: { value: bad, '__proto__': bad } });
  await s.ready;
  expect(s.snapshot()).toEqual({ ok: 2, value: { ok: 2 } });
  expect(({} as any).polluted).toBeUndefined();
});

test('sync persistence, namespaces, batching and async readiness', async () => {
  const adapter = memoryAdapter(), s = createStore({ persist: adapter, namespace: 'a' });
  s.set('x', 3); expect(createStore({ persist: adapter, namespace: 'a' }).get('x')).toBe(3);
  expect(createStore({ persist: adapter, namespace: 'b' }).snapshot()).toEqual({});
  let saves = 0; let resolve!: (data: object) => void;
  const asyncStore = createStore({ persist: { load: () => new Promise<object>(r => { resolve = r; }), save() { saves++; } } });
  resolve({ x: 4 }); await asyncStore.ready; expect(asyncStore.get('x')).toBe(4);
  asyncStore.batch(() => { asyncStore.set('x', 5); asyncStore.set('y', 6); });
  expect(saves).toBe(1); asyncStore.undo(); expect(saves).toBe(2);
  const rejected = createStore({ persist: { load() { throw Error('load'); }, save() {} } });
  await expect(rejected.ready).rejects.toThrow('load');
});

test('localStorage fake, malformed data, unavailable storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v) } });
    const a = localStorageAdapter('key'); a.save('ns', { x: 1 }); expect(data.has('key:ns')).toBe(true); expect(a.load('ns')).toEqual({ x: 1 });
    data.set('key:bad', '{'); expect(a.load('bad')).toEqual({});
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    expect(a.load('ns')).toEqual({}); a.save('ns', {});
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('formula arithmetic, precedence, comparisons, boolean and ternaries', () => {
  for (const [expr, result] of Object.entries({ '2^3^2': 512, '-2^2': -4, '3+4*2%5': 6, '8/2-1': 3, '1<2 && 3>=3': 1, '2<=1 || 3!=4': 1, '2==2 ? 3>4 ? 8 : 9 : 7': 9, '!0': 1 })) expect(evaluate(expr, {})).toBe(result);
  expect(evaluate('missing+obj.x+bad', { obj: { x: '3' }, bad: {} })).toBe(3);
  const f = compile('estimate1.items.0.qty + price + price');
  expect(f.deps).toEqual(['estimate1.items.0.qty', 'price']); expect(f(p => p === 'price' ? 2 : 3)).toBe(7);
  expect(compile('1')).toBe(compile('1'));
});

test('formula functions flatten arrays and coerce values', () => {
  const scope = { xs: [1, [2, '3']] };
  for (const [expr, expected] of Object.entries({ 'sum(xs,4)': 10, 'avg(xs)': 2, 'min(xs)': 1, 'max(xs)': 3, 'round(1.235,2)': 1.24, 'floor(1.8)+ceil(1.2)+abs(-2)': 5, 'if(1,pct(80,25),0)': 20 })) expect(evaluate(expr, scope)).toBe(expected);
});

test('formula rejects malformed and malicious expressions and limits input', () => {
  for (const expr of ['', 'constructor.constructor("x")()', 'this', '"hi"', "'hi'", 'unknown(1)', '1@2', '1+', '(', '1 2', '1'.repeat(4097), '('.repeat(70) + '1' + ')'.repeat(70)]) {
    expect(() => compile(expr)).toThrow(FormulaError); expect(evaluate(expr, {})).toBeNaN();
  }
  expect(evaluate('__proto__.x + constructor.x + prototype.x', () => 99)).toBe(0);
  expect(evaluate('x', Object.create({ x: 9 }))).toBe(0);
  expect(evaluate('x', () => { throw Error(); })).toBeNaN();
  for (let i = 0; i < 105; i++) compile(String(i));
});
