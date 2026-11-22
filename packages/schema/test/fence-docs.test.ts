import { expect, test } from 'bun:test';
import { parse } from '../../core/src';
import { s, toPromptDocs } from '../src';

test('generated fence examples put JSON in the body and parse with directive props', () => {
  const docs = toPromptDocs([{ name: 'card', schema: s.object({ title: s.string().example('Hello'), count: s.number().default(3) }) }]);
  const example = docs.split('Example:\n')[1];
  const node = parse(example).children[0];
  expect(node.name).toBe('card'); expect(node.props).toEqual({ title: 'Hello', count: 3 });
  expect(docs).toContain('```ui:card\n{json}\n```');
});
