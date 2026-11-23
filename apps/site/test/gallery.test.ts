import { expect, test } from 'bun:test';
import { s } from '../../../packages/schema/src';
import { properties, examples, description, category, slotSnippet } from '../src/gallery-data';
import type { ComponentDef } from '@prism-ui/react';

const empty = { name: 'empty', component: () => null } as ComponentDef;
test('reference metadata handles missing schema, parts, strings and examples', () => {
  expect(properties()).toEqual([]);
  expect(examples(empty)).toEqual(['']);
  expect(description(empty)).toContain('component');
  expect(category('empty')).toBe('Content');
  expect(slotSnippet(empty)).toContain('no replaceable parts');
});
test('schema reference preserves optionality, false/zero defaults and nested item types', () => {
  const schema = s.object({ enabled: s.boolean().default(false), count: s.number().default(0), title: s.string().optional().describe('A title'), nested: s.object({ required: s.string() }), rows: s.array(s.object({ value: s.number() })) });
  const rows = properties(schema);
  expect(rows.find(row => row.name === 'enabled')).toMatchObject({ defaultValue: 'false', required: false });
  expect(rows.find(row => row.name === 'count')).toMatchObject({ defaultValue: '0', required: false });
  expect(rows.find(row => row.name === 'title')).toMatchObject({ required: false, description: 'A title' });
  expect(rows.find(row => row.name === 'nested.required')).toMatchObject({ type: 'string', required: true });
  expect(rows.find(row => row.name === 'rows')?.type).toBe('{ value: number }[]');
});
test('slot overrides use the public component → part API and typed React forwarding', () => {
  const code = slotSnippet({ ...empty, name: 'pick', parts: ['header', 'root'] });
  expect(code).toContain('"pick": { "root": MySlot }');
  expect(code).toContain('satisfies Slots');
  expect(code).toContain('ref={ref}');
});
