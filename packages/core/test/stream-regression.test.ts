import { expect, test } from 'bun:test';
import { createParser, parse, type Node, type Plugin } from '../src';
import { mixedStream } from './stream-fixture';

function checkKeys(node: Node) {
  const children = node.children ?? [];
  expect(new Set(children.map(child => child.key)).size).toBe(children.length);
  children.forEach(checkKeys);
}
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
