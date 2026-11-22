import { expect, test } from 'bun:test';
import { createParser, parse, type Node, type Plugin } from '../src';

const mention: Plugin = {
  name: 'mentions',
  inline: [{ trigger: '@', parse(src, pos) {
    const match = /^@([a-z]+)/i.exec(src.slice(pos));
    return match ? { node: { type: 'component', name: 'mention', props: { user: match[1] }, children: [] }, end: pos + match[0].length } : null;
  } }],
};
const math: Plugin = {
  name: 'math',
  block: [{
    test: line => line === '$$',
    continue(line, state) {
      if (state.data.closed) return false;
      if (line === '$$') state.data.closed = true;
      return true;
    },
    finish(lines) { return { type: 'component', name: 'math', props: { source: lines.slice(1, lines.at(-1) === '$$' ? -1 : undefined).join('\n') } }; },
  }],
};
const headings: Plugin = { name: 'headings', transform: node => node.type === 'heading' ? { ...node, name: 'renamed', depth: node.depth! + 1 } : node };
function walk(node: Node): Node[] { return [node, ...(node.children ?? []).flatMap(walk)]; }

test('inline triggers interrupt fast text skipping and work throughout inline syntax', () => {
  const root = parse('# Hi @ada\n\nLong ordinary prefix @bob **@cy** [@dan](/x) :badge[@eve]\n\n- @fox\n\n> @gus\n\n| User |\n| --- |\n| @hal |\n', { plugins: [mention] });
  const nodes = walk(root).filter(n => n.name === 'mention');
  expect(nodes.map(n => n.props?.user)).toEqual(['ada', 'bob', 'cy', 'dan', 'eve', 'fox', 'gus', 'hal']);
  expect(nodes.every(n => /^\d+(?:\.\d+)+$/.test(n.key))).toBe(true);
  expect(walk(parse('`@ada` \\@bob @123', { plugins: [mention] })).filter(n => n.name === 'mention')).toEqual([]);
});

test('block extensions retain mutable per-block state and reprocess boundary lines', () => {
  const root = parse('before\n$$\na+b\n$$\n# After\n\n$$\nx\n$$', { plugins: [math] });
  expect(root.children.map(n => n.type)).toEqual(['paragraph', 'component', 'heading', 'component']);
  expect(root.children[1]).toEqual({ type: 'component', name: 'math', key: '1', props: { source: 'a+b' }, complete: true });
  expect(root.children[3].props).toEqual({ source: 'x' });
  expect(root.children.every(Object.isFrozen)).toBe(true);
  expect(parse('', { plugins: [math] }).children).toEqual([]);
});

test('open extension blocks and inline tails publish updated transformed previews', () => {
  let finishes = 0, transforms = 0;
  const plugin: Plugin = { ...math, block: math.block!.map(ext => ({ ...ext, finish(lines) { finishes++; return ext.finish(lines); } })), transform(node) { if (node.name === 'math') { transforms++; return { ...node, name: 'math-preview' }; } return node; } };
  const p = createParser({ plugins: [plugin] });
  p.push('$$\na'); const first = p.root.children[0];
  expect(first.complete).toBe(false); expect(first.name).toBe('math-preview'); expect(first.props).toEqual({ source: 'a' });
  p.push('+b'); const second = p.root.children[0];
  expect(second).not.toBe(first); expect(second.props).toEqual({ source: 'a+b' }); expect(finishes).toBe(2); expect(transforms).toBe(2);
  p.push('\n$$\n\n'); const final = p.root.children[0];
  expect(final.complete).toBe(true); expect(Object.isFrozen(final)).toBe(true); expect(finishes).toBe(3); expect(transforms).toBe(3);
  p.push('tail'); expect(p.root.children[0]).toBe(final); p.end();
  const inline = createParser({ plugins: [mention, headings] });
  inline.push('Hello @a'); expect(walk(inline.root).some(n => n.props?.user === 'a')).toBe(true);
  inline.push('da'); expect(walk(inline.root).some(n => n.props?.user === 'ada')).toBe(true);
  inline.end();
});

test('transforms freeze once and completed references remain stable', () => {
  let count = 0;
  const plugin: Plugin = { name: 'count', transform(node) { if (node.type === 'heading') count++; return headings.transform!(node); } };
  const p = createParser({ plugins: [plugin, mention] });
  p.push('# Hello @ada\n'); const heading = p.root.children[0];
  expect(heading.depth).toBe(2); expect(heading.name).toBe('renamed'); expect(Object.isFrozen(heading)).toBe(true); expect(count).toBe(1);
  p.push('\nMore @bob'); void p.root.children[1]; p.push(' text\n\n'); p.end();
  expect(p.root.children[0]).toBe(heading); expect(count).toBe(1);
  const nested = parse(':::card\n# Nested\n:::\n', { plugins: [plugin] });
  expect(nested.children[0].children![0].depth).toBe(2);
  expect(nested.children[0].children![0].name).toBe('renamed');
});

test('one-shot and streaming plugin results agree across chunk sizes and CRLF', () => {
  const texts = [
    '# Hello @ada\n\nText @bob **@cy**.\n\n- @dan\n- @eve\n\n$$\nx+y\n$$\n# End\n',
    ':::card\n# @ada\n\n$$\nx\n$$\n\n:::\n\nTail @bob',
    'First @ada\r\n\r\nTitle @bob\r\n===\r\n\r\n$$\r\nx\r\n',
    '[@ada][ref]\n\n[ref]: /target\n',
  ];
  for (const text of texts) for (const size of [1, 2, 3, 7, 32, 1000]) {
    const plugins = [mention, math, headings], expected = parse(text, { plugins });
    const p = createParser({ plugins });
    for (let i = 0; i < text.length; i += size) { p.push(text.slice(i, i + size)); for (const node of p.root.children) void node.children; }
    expect(p.end().root).toEqual(expected);
  }
});

test('empty plugins preserve no-plugin output and rejected inline matches make progress', () => {
  const text = '# Heading\n\n**bold** [link](/x)\n\n```js\nx\n```\n\n- one\n';
  expect(parse(text, { plugins: [] })).toEqual(parse(text));
  expect(parse(text, { plugins: [{ name: 'empty' }] })).toEqual(parse(text));
  const p = createParser({ plugins: [] }), normal = createParser();
  for (const chunk of text) { p.push(chunk); normal.push(chunk); }
  expect(p.end().root).toEqual(normal.end().root);
  const bad: Plugin = { name: 'no-match', inline: [{ trigger: '@', parse: (_, pos) => ({ node: { type: 'text', value: 'bad' }, end: pos }) }] };
  expect(parse('plain @x', { plugins: [bad] }).children[0].children?.[0].value).toBe('plain @x');
  expect(() => createParser({ plugins: [{ name: 'bad-trigger', inline: [{ trigger: 'xx', parse: () => null }] }] })).toThrow('one character');
});
