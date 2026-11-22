import { expect, test } from 'bun:test';
import { createParser, parse, type Node, type Plugin } from '../src';
import { mixedStream } from './stream-fixture';

function checkKeys(node: Node) {
  const children = node.children ?? [];
  expect(new Set(children.map(child => child.key)).size).toBe(children.length);
  children.forEach(checkKeys);
}

for (const options of [undefined, { plugins: [{ name: 'identity', transform: (node: Node) => node }] }, { plugins: [{ name: 'inline', inline: [{ trigger: '@', parse: () => null }] }] }]) {
  for (const header of ['```ui:x', '```js', '~~~', '   ```js']) {
    test(`unfinished fence headers never preview as inline code: ${header}, ${options?.plugins[0].name ?? 'plain'}`, () => {
      const parser = createParser(options);
      parser.push('Intro\n\n');
      for (const char of header) {
        parser.push(char);
        expect(parser.root.children[0].children?.[0].value).toBe('Intro');
        if (char !== ' ') {
          const tail = parser.root.children[1];
          expect(tail === undefined || tail.type === 'code' || tail.type === 'component').toBe(true);
          if (tail) expect(tail.complete).toBe(false);
        }
      }
      parser.push('\n');
      expect(parser.root.children[1].type).toBe(header.includes('ui:') ? 'component' : 'code');
      expect(parser.end().root).toEqual(parse('Intro\n\n' + header + '\n', options));
    });
  }
  test(`an open fence interrupts an existing paragraph without leaking its header: ${options?.plugins[0].name ?? 'plain'}`, () => {
    const parser = createParser(options);
    parser.push('Intro\n');
    for (const char of '```ui:x') {
      parser.push(char);
      expect(parser.root.children[0].children).toEqual([{ type: 'text', key: '0.0', value: 'Intro' }]);
    }
    parser.push('\n');
    expect(parser.root.children[1].type).toBe('component');
    expect(parser.end().root).toEqual(parse('Intro\n```ui:x\n', options));
  });
  test(`genuine inline code still previews before newline: ${options?.plugins[0].name ?? 'plain'}`, () => {
    const parser = createParser(options), source = '`code` paragraph';
    for (let i = 0; i < source.length; i++) {
      parser.push(source[i]);
      if (i > 0) expect(parser.root.children[0].type).toBe('paragraph');
    }
    expect(parser.root.children[0].children?.[0].type).toBe('inlineCode');
    expect(parser.end().root).toEqual(parse(source, options));
  });
}
test('data identity closure tracks root scalars, not nested ids or open strings', () => {
  const parser = createParser();
  parser.push('```ui:editor\n{"nested":{"id":"closed"},"id":"rev');
  expect(parser.root.children[0].idComplete).toBe(false);
  parser.push('iew\\"');
  expect(parser.root.children[0].idComplete).toBe(false);
  parser.push('draft","tail":[');
  expect(parser.root.children[0].idComplete).toBe(true);
  parser.push('1,2]}\n```');
  expect(parser.end().root).toEqual(parse('```ui:editor\n{"nested":{"id":"closed"},"id":"review\\"draft","tail":[1,2]}\n```'));
});
for (let size = 1; size <= 7; size++) {
  test(`mixed document streamed in ${size}-character chunks matches parse and has unique preview keys`, () => {
    const plugins: Plugin[] = [{ name: 'identity', transform: node => node }];
    for (const options of [undefined, { plugins }]) {
      const parser = createParser(options);
      for (let i = 0; i < mixedStream.length; i += size) {
        parser.push(mixedStream.slice(i, i + size));
        checkKeys(parser.root);
      }
      expect(JSON.parse(JSON.stringify(parser.end().root))).toEqual(JSON.parse(JSON.stringify(parse(mixedStream, options))));
    }
  });
}
