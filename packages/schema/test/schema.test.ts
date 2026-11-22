import { expect, test } from 'bun:test';
import { s, toPromptDocs, type Infer } from '../src';

test('attribute strings, bounds, flags and invalid scalar values', () => {
  expect(s.number().coerce('1e3').value).toBe(1000);
  expect(s.number().coerce('3').value).toBe(3);
  expect(s.string().coerce(3).value).toBe('3');
  for (const [raw, value] of [['true', true], ['false', false], ['', true], [false, false]] as const) expect(s.boolean().coerce(raw).value).toBe(value);
  const bounded = s.number({ min: 0, max: 100, step: 5 });
  expect(bounded.type).toBe('number (0–100, step 5)');
  expect(bounded.coerce(103)).toEqual({ value: 100, issues: [{ path: '', message: 'clamped' }], partial: false });
  expect(bounded.coerce(-3).value).toBe(0); expect(bounded.coerce(7).value).toBe(5);
  for (const raw of ['', 'no', null, Infinity, true]) expect(s.number().coerce(raw).issues.length).toBe(1);
  expect(s.array(s.number()).coerce(1).issues.length).toBe(1);
  expect(s.boolean().coerce('yes').value).toBeUndefined();
});

test('immutable modifiers, defaults and inferred types', () => {
  const base = s.string(), described = base.describe('Name').example('Ada').example('Bo');
  expect(base.description).toBe(''); expect(base.examples).toEqual([]);
  expect(described.description).toBe('Name'); expect(described.examples).toEqual(['Ada', 'Bo']);
  const optional = base.optional(), fallback = optional.default('x');
  expect(base.isOptional).toBe(false); expect(optional.isOptional).toBe(true);
  expect(optional.coerce(undefined)).toEqual({ value: undefined, issues: [], partial: false });
  expect(fallback.coerce(undefined).value).toBe('x'); expect(fallback.coerce(null).value).toBe('x');
  type Optional = Infer<typeof optional>; type Default = Infer<typeof fallback>;
  const a: Optional = undefined, b: Default = 'ok';
  // @ts-expect-error Defaults remove undefined from the inferred type.
  const c: Default = undefined;
  expect([a, b, c]).toEqual([undefined, 'ok', undefined]);
  const schema = s.object({ name: s.string(), n: s.number().optional() });
  const value: Infer<typeof schema> = { name: 'x', n: undefined }; expect(value.name).toBe('x');
});

test('streaming objects, unknown keys, nested arrays and defaults', () => {
  const pick = s.object({ question: s.string(), options: s.array(s.object({ id: s.string(), score: s.number().default(0) })), enabled: s.boolean().default(true) });
  expect<unknown>(pick.coerce({ question: 'Pick one' })).toEqual({ value: { question: 'Pick one', enabled: true }, issues: [{ path: 'options', message: 'missing' }], partial: true });
  const r = pick.coerce('{"question":"Pick","options":[{"id":"a"},{"score":"bad"},false],"unknown":1}');
  expect<unknown>(r.value).toEqual({ question: 'Pick', options: [{ id: 'a', score: 0 }, { score: 0 }], enabled: true });
  expect(r.issues.map(i => i.path)).toEqual(['options.1.id', 'options.1.score', 'options.2']); expect(r.partial).toBe(true);
  expect(s.array(s.number()).coerce('[1,"2","bad",3]').value).toEqual([1, 2, 3]);
  expect<unknown>(s.object({ n: s.number() }).coerce({ n: false, extra: 1 }).value).toEqual({});
  expect<unknown>(s.object({ valid: s.string(), invalid: s.number() }).coerce({ valid: 'yes', invalid() {} }).value).toEqual({ valid: 'yes' });
  expect(s.object({}).coerce({ extra: 1 })).toEqual({ value: {}, issues: [], partial: false });
});

test('enum and union select first issue-free member or best partial', () => {
  const e = s.enum(['a', 'b']);
  type E = Infer<typeof e>; const a: E = 'a'; expect(e.coerce(a).value).toBe('a');
  expect(e.type).toBe('"a" | "b"'); expect(e.coerce('c').issues.length).toBe(1);
  expect(e.default('b').coerce('c').value).toBe('b');
  expect(s.union(s.number(), s.string()).coerce('3').value).toBe(3);
  expect(s.union(s.object({ a: s.string(), b: s.string() }), s.object({ c: s.string() })).coerce({}).issues).toEqual([{ path: 'c', message: 'missing' }]);
  expect(s.union(s.number(), s.boolean()).default(2).coerce({}).value).toBe(2);
});

test('garbage and pollution never throw', () => {
  const bad = JSON.parse('{"__proto__":{"polluted":1},"constructor":4,"prototype":5,"ok":"3"}');
  const shape = s.object({ ...bad, ok: s.number() });
  expect(shape.coerce(bad).value).toEqual({ ok: 3 });
  expect(s.any().coerce(bad).value).toEqual({ ok: '3' });
  expect(({} as any).polluted).toBeUndefined();
  const cyclic: any = {}; cyclic.x = cyclic;
  const proxy = new Proxy({}, { ownKeys() { throw Error(); } });
  for (const raw of [null, () => 1, cyclic, proxy, Symbol(), 1n]) for (const schema of [s.string(), s.object({ x: s.number() }), s.any()]) expect(() => schema.coerce(raw)).not.toThrow();
  expect(s.any().coerce({ nested: [1, 'x'] }).value).toEqual({ nested: [1, 'x'] });
});

test('prompt docs are deterministic and describe syntax, metadata and examples', () => {
  const schema = s.object({ title: s.string().describe('Heading').example('Hello'), count: s.number().default(3).optional(), mode: s.enum(['a', 'b']), rows: s.array(s.object({ id: s.string() })) });
  const defs = [{ name: 'card', schema, docs: 'A card.' }, { name: 'tabs', schema, syntax: 'container' as const }, { name: 'leaf', schema, syntax: 'leaf' as const }, { name: 'num', schema, inline: true }, { name: 'custom', schema, examples: ['CUSTOM', 'IGNORED'] }];
  const docs = toPromptDocs(defs);
  expect(toPromptDocs(defs)).toBe(docs);
  expect(docs).toContain('### card\nA card.\n```ui:card\n{json}\n```');
  expect(docs).toContain('- `title` (string) — Heading');
  expect(docs).toContain('- `count` (number, default `3`, optional)');
  expect(docs).toContain(':::tabs{attrs}\n…\n:::'); expect(docs).toContain('::leaf{attrs}'); expect(docs).toContain(':num[label]{attrs}');
  expect(docs).toContain('"title":"Hello","count":3,"mode":"a","rows":[]');
  expect(docs).toContain(':num[label]{title="Hello" count=3 mode="a" rows=[]}');
  expect(docs).toContain('Example:\nCUSTOM'); expect(docs).not.toContain('IGNORED');
  expect(toPromptDocs([])).toBe('');
});
