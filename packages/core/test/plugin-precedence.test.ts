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

test.each(['::name   ', '::name {id="final" title="A name"}'])('spaced leaf headers stay provisional until newline: %s', source => {
  const parser = createParser({ plugins: [token] });
  for (const char of source) {
    parser.push(char);
    if (parser.root.children[0]?.type === 'component') {
      expect(parser.root.children[0].complete).toBe(false);
      expect(parser.root.children[0].idComplete).toBe(false);
    }
  }
  parser.push('\n');
  expect(parser.root.children[0].complete).toBe(true);
  expect(parser.root.children[0].name).toBe('name');
  if (source.includes('{')) expect(parser.root.children[0].props?.id).toBe('final');
  expect(parser.end().root).toEqual(parse(source + '\n', { plugins: [token] }));
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
