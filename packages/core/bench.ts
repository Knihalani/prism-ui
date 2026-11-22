import { marked } from 'marked';
import MarkdownIt from 'markdown-it';
import { createParser, parse } from './src';

const md = new MarkdownIt();
const section = '# Report\n\nA **streaming** paragraph with [links](https://example.com) and `code`.\n\n- [x] Fast\n- [ ] Small\n\n|Name|Value|\n|:---|---:|\n|One|42|\n\n```ts meta\nconst x = 42;\n```\n\n:::card{tone="info"}\nLive :badge[New]{tone=success}\n:::\n\n```ui:chart\n{series:[1,2,3], label:"Demo"}\n```\n\n';
const cases = {
  mixed: section.repeat(Math.ceil(204800 / section.length)),
  paragraph: 'Streaming plain text grows without a newline. '.repeat(Math.ceil(204800 / 45)),
  json: '```ui:table\n{"rows":[' + '{"x":1,"y":"live"},'.repeat(11378).slice(0, -1) + ']}\n```\n',
};
console.log('| Case | Engine | Bytes | One-shot ms | MB/s | Stream ms | Stream MB/s |');
console.log('|---|---|---:|---:|---:|---:|---:|');
for (const [name, text] of Object.entries(cases)) {
  if (Bun.argv[3] && name !== Bun.argv[3]) continue;
  const chunks: string[] = []; for (let i = 0; i < text.length; i += 4) chunks.push(text.slice(i, i + 4));
  for (const engine of ['prism-ui', 'marked', 'markdown-it']) {
    if (Bun.argv[2] && Bun.argv[2] !== 'all' && engine !== Bun.argv[2]) continue;
    const once = engine === 'prism-ui' ? parse : engine === 'marked' ? (s: string) => marked.lexer(s) : (s: string) => md.parse(s, {});
    for (let i = 0; i < 3; i++) once(text);
    let start = performance.now(); for (let i = 0; i < 10; i++) once(text); const ms = (performance.now() - start) / 10;
    // Batch parsing does not warm prism's distinct streaming state machines.
    if (engine === 'prism-ui') for (let i = 0; i < 3; i++) { const p = createParser(); for (const chunk of chunks) { p.push(chunk); void p.root; } p.end(); }
    start = performance.now();
    if (engine === 'prism-ui') { const p = createParser(); for (const chunk of chunks) { p.push(chunk); void p.root; } p.end(); }
    else { let input = ''; for (const chunk of chunks) { input += chunk; once(input); } }
    const stream = performance.now() - start;
    console.log(`| ${name} | ${engine} | ${text.length} | ${ms.toFixed(2)} | ${(text.length / ms / 1000).toFixed(2)} | ${stream.toFixed(2)} | ${(text.length / stream / 1000).toFixed(6)} |`);
  }
}
