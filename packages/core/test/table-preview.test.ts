import { expect, test } from 'bun:test';
import { createParser, parse } from '../src';

test('incremental table rows preserve alignment, cell keys, escaping and missing cells', () => {
  for (const header of ['| A | B | C |', 'A | B | C']) {
    const source = `${header}\n| :--- | :---: | ---: |\n| a\\|b | **bold** | [link](/url) |\n| only |\n| a | b | c | ignored |\n`;
    for (const size of [1, 4, 64]) {
      const parser = createParser();
      for (let end = size; end < source.length + size; end += size) {
        parser.push(source.slice(end - size, end));
        const table = parser.root.children[0];
        if (table?.type !== 'table') continue;
        table.children?.forEach((row, i) => {
          expect(row.key).toBe(`0.${i}`);
          expect(row.children).toHaveLength(3);
          row.children?.forEach((cell, c) => expect(cell.key).toBe(`0.${i}.${c}`));
        });
      }
      expect(parser.end().root).toEqual(parse(source));
    }
  }
});

test('empty streams and unfinished tables remain valid previews', () => {
  for (const source of ['', 'A | B\n--- | ---\n', 'A | B\n--- | ---\n| left |']) {
    const parser = createParser();
    parser.push(source); void parser.root.children;
    expect(parser.end().root).toEqual(parse(source));
    expect(() => parser.push('extra')).toThrow('Parser has ended');
  }
});

test('tables following an unterminated paragraph retain their provisional header until completion', () => {
  const source = 'intro\nA | B\n--- | ---\n| a | b |\n';
  const parser = createParser();
  parser.push(source);
  expect(parser.root.children[0]).toMatchObject({ type: 'table', key: '1' });
  expect(parser.root.children[0].children).toHaveLength(1);
  expect(parser.end().root).toEqual(parse(source));
});
