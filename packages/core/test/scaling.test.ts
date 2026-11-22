import { expect, test } from 'bun:test';
import { createParser } from '../src';

function stream(text: string) {
  const parser = createParser();
  for (let i = 0; i < text.length; i += 4) { parser.push(text.slice(i, i + 4)); void parser.root; }
  return parser.end().root;
}
function minimum(text: string) {
  let best = Infinity;
  for (let run = 0; run < 7; run++) {
    const start = performance.now(); stream(text); const elapsed = performance.now() - start;
    if (elapsed < best) best = elapsed;
  }
  return best;
}
test('four-character streaming scales linearly for long open blocks (minimum of seven runs)', () => {
  const bodies = [
    (n: number) => 'plain streaming text '.repeat(n),
    (n: number) => '**' + 'bold streaming text '.repeat(n),
    (n: number) => '```js\n' + 'const x = 123; '.repeat(n),
    (n: number) => ':::card\n' + 'nested streaming text '.repeat(n),
    (n: number) => '```ui:table\n{"rows":[' + '{"x":1,"s":"live"},'.repeat(n).slice(0, -1) + ']}\n```',
  ];
  for (const body of bodies) {
    const small = body(5000); const large = body(10000);
    stream(small); stream(large);
    const a = minimum(small); const b = minimum(large);
    console.log(`scaling ${small.length} -> ${large.length} bytes: ${a.toFixed(2)} -> ${b.toFixed(2)} ms (${(b / a).toFixed(2)}x)`);
    expect(b / a).toBeLessThanOrEqual(2.6);
  }
}, 30000);
