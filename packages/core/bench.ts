import { marked } from 'marked';
import MarkdownIt from 'markdown-it';
import { createParser, parse } from './src';

const md = new MarkdownIt();
const section = '# Report\n\nA **streaming** paragraph with [links](https://example.com) and `code`.\n\n- [x] Fast\n- [ ] Small\n\n|Name|Value|\n|:---|---:|\n|One|42|\n\n```ts meta\nconst x = 42;\n```\n\n:::card{tone="info"}\nLive :badge[New]{tone=success}\n:::\n\n```ui:chart\n{series:[1,2,3], label:"Demo"}\n```\n\n';
const text = section.repeat(Math.ceil(204800 / section.length));
const chunks: string[] = []; for (let i = 0; i < text.length; i += 4) chunks.push(text.slice(i, i + 4));
const engines = [
  { name: 'prism-ui', once: (s: string) => parse(s), stream: () => { const p = createParser(); for (const c of chunks) { p.push(c); void p.root; } p.end(); } },
  { name: 'marked', once: (s: string) => marked.lexer(s), stream: () => { let s = ''; for (const c of chunks) { s += c; marked.lexer(s); } } },
  { name: 'markdown-it', once: (s: string) => md.parse(s, {}), stream: () => { let s = ''; for (const c of chunks) { s += c; md.parse(s, {}); } } },
];
console.log(`Input: ${text.length} bytes; ${chunks.length} chunks (4 characters); parser/AST only, no HTML rendering.`);
console.log('| Engine | One-shot ms | One-shot MB/s | Stream ms | Stream MB/s |');
console.log('|---|---:|---:|---:|---:|');
for (const engine of engines) {
  if (Bun.argv[2] && engine.name !== Bun.argv[2]) continue;
  for (let i = 0; i < 3; i++) engine.once(text);
  let start = performance.now(); for (let i = 0; i < 10; i++) engine.once(text); const once = (performance.now() - start) / 10;
  start = performance.now(); engine.stream(); const stream = performance.now() - start;
  console.log(`| ${engine.name} | ${once.toFixed(2)} | ${(text.length / once / 1000).toFixed(2)} | ${stream.toFixed(2)} | ${(text.length / stream / 1000).toFixed(3)} |`);
}
