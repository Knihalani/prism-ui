import { expect, test } from 'bun:test';
import { createParser } from '../src';

function stream(text: string) {
  const parser = createParser();
  for (let i = 0; i < text.length; i += 4) { parser.push(text.slice(i, i + 4)); void parser.root; }
  return parser.end().root;
}
function sample(text: string) { const start = performance.now(); stream(text); return performance.now() - start; }
function median(values: number[]) { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]; }
test('four-character streaming scales linearly for long open blocks (median of five interleaved minima)', () => {
  const bodies = [
    (n: number) => 'plain streaming text '.repeat(n),
    (n: number) => '**' + 'bold streaming text '.repeat(n),
    (n: number) => '```js\n' + 'const x = 123; '.repeat(n),
    (n: number) => ':::card\n' + 'nested streaming text '.repeat(n),
    (n: number) => '```ui:table\n{"rows":[' + '{"x":1,"s":"live"},'.repeat(n).slice(0, -1) + ']}\n```',
  ];
  for (const body of bodies) {
    const small = body(5000); const large = body(10000);
    for (let warm = 0; warm < 3; warm++) { stream(small); stream(large); }
    const ratios: number[] = [], smallTimes: number[] = [], largeTimes: number[] = [];
    for (let round = 0; round < 5; round++) {
      let a = Infinity, b = Infinity;
      for (let run = 0; run < 7; run++) {
        if ((round + run) % 2) { b = Math.min(b, sample(large)); a = Math.min(a, sample(small)); }
        else { a = Math.min(a, sample(small)); b = Math.min(b, sample(large)); }
      }
      smallTimes.push(a); largeTimes.push(b); ratios.push(b / a);
    }
    console.log(`scaling ${small.length} -> ${large.length} bytes: ${median(smallTimes).toFixed(2)} -> ${median(largeTimes).toFixed(2)} ms (median paired ratio ${median(ratios).toFixed(2)}x; ${ratios.map(value => value.toFixed(2)).join(', ')})`);
    expect(median(ratios)).toBeLessThanOrEqual(2.6);
  }
}, 30000);
