import { expect, test } from 'bun:test';
import { createParser, parse, type Plugin } from '../src';

const token: Plugin = { name: 'token', inline: [{ trigger: '@', parse(src, pos) {
  const value = /^@foo_bar\*/.exec(src.slice(pos));
  return value ? { node: { type: 'component', name: 'token', props: { value: value[0] } }, end: pos + value[0].length } : null;
} }] };

test('a streamed leaf directive prefix cannot finalize before its attributes arrive', () => {
  const parser = createParser({ plugins: [token] });
  parser.push('::mockup');
  expect(parser.root.children[0].complete).toBe(false);
  expect(parser.root.children[0].idComplete).toBe(false);
  parser.push('{id="rev');
  expect(parser.root.children[0].complete).toBe(false);
  parser.push('iew"}\n');
  expect(parser.root.children[0].complete).toBe(true);
  expect(parser.root.children[0].props?.id).toBe('review');
});

test('emphasis cannot close inside an inline plugin token', () => {
  const source = '*before @foo_bar* after*';
  const root = parse(source, { plugins: [token] }), emphasis = root.children[0].children![0];
  expect(emphasis.type).toBe('emphasis');
  expect(emphasis.children!.map(node => node.type)).toEqual(['text', 'component', 'text']);
  expect(emphasis.children![1].props).toEqual({ value: '@foo_bar*' });
  expect(emphasis.children![2].value).toBe(' after');
  for (let size = 1; size <= 7; size++) {
    const parser = createParser({ plugins: [token] });
    for (let i = 0; i < source.length; i += size) parser.push(source.slice(i, i + size));
    expect(parser.end().root).toEqual(root);
  }
});

test('rejected plugin matches still allow ordinary emphasis closers', () => {
  const root = parse('*before @unknown*', { plugins: [token] });
  expect(root.children[0].children![0].type).toBe('emphasis');
  expect(root.children[0].children![0].children![0].value).toBe('before @unknown');
});
