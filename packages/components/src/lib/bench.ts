import hljs from 'highlight.js/lib/core';
import hljsTS from 'highlight.js/lib/languages/typescript';
import hljsPython from 'highlight.js/lib/languages/python';
import hljsJSON from 'highlight.js/lib/languages/json';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { createHighlighter } from './highlight';
import { linePath, nearestX, stack, type Point } from './chart';

hljs.registerLanguage('typescript', hljsTS);
hljs.registerLanguage('python', hljsPython);
hljs.registerLanguage('json', hljsJSON);
const ours = createHighlighter({ cacheSize: 0 });
const profiling = process.argv.includes('--profile');
function corpus(make: (index: number) => string): string {
  const parts: string[] = [];
  let length = 0;
  for (let i = 0; length < 100 * 1024; i++) { const part = make(i); parts.push(part); length += part.length; }
  return parts.join('');
}
const datasets = [
  { lang: 'typescript', code: corpus(i => `// A typed streaming component ${i}\ninterface Item${i} { id: number; label: string; enabled?: boolean }\nexport async function rank${i}(items: Item${i}[]): Promise<string[]> {\n  const pattern = /[a-z]+/gi;\n  const title = \`Results: \${items.length}\`;\n  /* Stable sorting with a numeric score. */\n  return items.filter(item => item.enabled && pattern.test(item.label))\n    .map((item, index) => \`\${title}: \${index} - \${item.label}\`);\n}\n`) },
  { lang: 'python', code: corpus(i => `# A streamed record ${i}\n@cache\ndef rank_${i}(items: list[str]) -> dict:\n    """Rank the items.\n    Keep stable labels and preserve Unicode.\n    """\n    scores = {name: len(name) / 2.5 for name in items}\n    return {"title": f"Results: {len(items)}", "scores": scores, "ok": True}\n`) },
  { lang: 'json', code: JSON.stringify(Array.from({ length: 465 }, (_, id) => ({ id, title: `Record ${id}`, enabled: id % 2 === 0, value: 123.45, tags: ['stream', 'table'], metadata: { count: id, note: '<safe & escaped>' } })), null, 2) },
];
let checksum = 0;
function median(run: () => string, iterations = 7): number {
  Bun.gc(true);
  const warmup = performance.now();
  for (let i = 0; i < 3 || performance.now() - warmup < 100; i++) checksum += run().length;
  Bun.gc(true);
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) { const start = performance.now(); checksum += run().length; times.push(performance.now() - start); }
  return times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
}
console.log('# Highlighter benchmark');
console.log(`Bun ${Bun.version}; median of ${profiling ? 200 : 7} runs after >=100ms warmup (minimum 3 runs); GC before warmup and sampling; HTML output, caches disabled; decimal MB/s.`);
console.log('\n| Language | KiB | Engine | One-shot ms | MB/s |');
console.log('|---|---:|---|---:|---:|');
for (const { lang, code } of datasets) {
  const engines = [
    ['ours', () => ours.highlight(code, lang)],
    ['highlight.js', () => hljs.highlight(code, { language: lang }).value],
    ['prismjs', () => Prism.highlight(code, Prism.languages[lang], lang)],
  ] as const;
  for (const [name, run] of engines) {
    if (profiling && name !== 'ours') continue;
    const ms = median(run, profiling ? 200 : 7);
    console.log(`| ${lang} | ${(code.length / 1024).toFixed(1)} | ${name} | ${ms.toFixed(2)} | ${(code.length / ms / 1000).toFixed(2)} |`);
  }
}
if (!process.argv.includes('--oneshot') && !profiling) {
  console.log('\nStreaming: append 16 characters and request HTML after every append. Naive uses our same scanner with caching disabled. Includes full-code prefix checks; strings are not flattened on every update.');
  console.log('\n| Language | Updates | Incremental ms | Naive full ms | Speedup |');
  console.log('|---|---:|---:|---:|---:|');
  for (const { lang, code } of datasets) {
    const incremental = ours.createIncremental(lang);
    let last = '';
    let start = performance.now();
    for (let end = 16; end < code.length + 16; end += 16) last = incremental.update(code.slice(0, Math.min(end, code.length)));
    const incrementalMs = performance.now() - start;
    const incrementalHTML = last;
    start = performance.now();
    for (let end = 16; end < code.length + 16; end += 16) last = ours.highlight(code.slice(0, Math.min(end, code.length)), lang);
    const naiveMs = performance.now() - start;
    if (last !== incrementalHTML) throw new Error(`Incremental mismatch: ${lang}`);
    checksum += last.length;
    console.log(`| ${lang} | ${Math.ceil(code.length / 16)} | ${incrementalMs.toFixed(2)} | ${naiveMs.toFixed(2)} | ${(naiveMs / incrementalMs).toFixed(1)}x |`);
  }
}
console.log(`\nOutput checksum: ${checksum}`);

if (!profiling) {
  console.log('\n# Chart geometry benchmark');
  const points: Point[] = Array.from({ length: 100000 }, (_, i) => [i / 10, Math.sin(i / 100) * 100 + i / 1000]);
  const xs = Float64Array.from({ length: 100000 }, (_, i) => i / 10);
  const keys = Array.from({ length: 50 }, (_, i) => `series${i}`);
  const rows = Array.from({ length: 1000 }, (_, i) => Object.fromEntries(keys.map((key, k) => [key, Math.sin(i + k) * 10])));
  const pathMs = median(() => linePath(points, { curve: 'monotone' }));
  let lookupChecksum = 0;
  const lookup = () => { for (let i = 0; i < 100000; i++) lookupChecksum += nearestX(xs, (Math.imul(i, 16807) >>> 0) % 100000 / 10); return ''; };
  const nearestMs = median(lookup);
  const stackMs = median(() => { const result = stack(rows, keys, { offset: 'diverging' }); checksum += result[49][999][1]; return ''; });
  console.log('| Operation | Size | Median ms | Throughput |');
  console.log('|---|---:|---:|---:|');
  console.log(`| Monotone SVG path | 100000 points | ${pathMs.toFixed(2)} | ${(100000 / pathMs * 1000).toFixed(0)} points/s |`);
  console.log(`| Binary nearest x | 100000 lookups / 100000 points | ${nearestMs.toFixed(2)} | ${(100000 / nearestMs * 1000).toFixed(0)} ops/s |`);
  console.log(`| Diverging stack | 50 series × 1000 rows | ${stackMs.toFixed(2)} | ${(50000 / stackMs * 1000).toFixed(0)} cells/s |`);
  console.log(`Chart checksum: ${checksum + lookupChecksum}`);
}
