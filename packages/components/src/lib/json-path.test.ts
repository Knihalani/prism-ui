import { expect, test } from 'bun:test';
import { del, get, has, parsePath, set } from './json-path';

test('parses dotted, bracket, quoted, escaped and array paths with immutable cache', () => {
  expect(parsePath("a[0]['x y']")).toEqual(['a', '0', 'x y']);
  expect(parsePath('a.b.0.c')).toEqual(['a', 'b', '0', 'c']);
  expect(parsePath('a[ "x\\\"y" ]')).toEqual(['a', 'x"y']);
  expect(parsePath(['a', 0])).toEqual(['a', '0']);
  expect(parsePath('a.b')).toBe(parsePath('a.b'));
  expect(Object.isFrozen(parsePath('a.b'))).toBe(true);
  expect(parsePath('')).toEqual([]);
  for (const invalid of ['a.', 'a..b', 'a[', 'a[x]', "a['x]", 'a[0]b']) expect(() => parsePath(invalid)).toThrow();
});
test('get and has distinguish missing, undefined, inherited, null and root', () => {
  const value = { a: [{ 'x y': undefined }], b: null };
  expect(has(value, "a[0]['x y']")).toBe(true);
  expect(get(value, 'a.0.x')).toBeUndefined();
  expect(has(value, 'b.x')).toBe(false);
  expect(get(value, '')).toBe(value);
  expect(has(value, '')).toBe(true);
  expect(has(Object.create({ inherited: true }), 'inherited')).toBe(false);
});
test('immutable set shares unchanged branches, creates containers and replaces root', () => {
  const original = { a: [{ x: 1 }], b: { keep: true } };
  const changed = set(original, 'a[0].x', 2);
  expect(changed).toEqual({ a: [{ x: 2 }], b: { keep: true } });
  expect(changed.b).toBe(original.b);
  expect(changed.a).not.toBe(original.a);
  expect(original.a[0].x).toBe(1);
  expect(set<unknown>(null, 'a.0.x', 1)).toEqual({ a: [{ x: 1 }] });
  expect(set({}, '', 2)).toBe(2);
});
test('delete shares branches, splices arrays and handles missing or root paths', () => {
  const original = { a: [1, 2, 3], b: {} };
  expect(del(original, 'a.1')).toEqual({ a: [1, 3], b: {} });
  expect(del(original, 'a.1').b).toBe(original.b);
  expect(del(original, 'a.8')).toBe(original);
  expect(del(original, 'b.missing.x')).toBe(original);
  expect(del<unknown>(original, 'b')).toEqual({ a: [1, 2, 3] });
  expect(del(original, '')).toBeUndefined();
});
test('all operations reject dangerous segments, including supplied arrays', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    for (const path of [`a.${key}.polluted`, ['a', key, 'polluted']]) {
      expect(() => get({}, path)).toThrow();
      expect(() => has({}, path)).toThrow();
      expect(() => set({}, path, true)).toThrow();
      expect(() => del({}, path)).toThrow();
    }
  }
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});
