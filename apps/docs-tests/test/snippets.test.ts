import { expect, test } from 'bun:test';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';

const workspace = fileURLToPath(new URL('..', import.meta.url));
const root = fileURLToPath(new URL('../../..', import.meta.url));
const directory = workspace + '/.snippets';
const sources = ['README.md', 'docs/INTEGRATION.md', 'docs/PROMPTING.md'];
const locations = new Map<string, { file: string; line: number }>();
await mkdir(directory, { recursive: true });
for (const file of await readdir(directory)) await unlink(directory + '/' + file);
let skipped = 0;
for (const file of sources) {
  const markdown = await readFile(root + '/' + file, 'utf8');
  let index = 0;
  for (const match of markdown.matchAll(/^(<!-- snippet: ([\w-]+) -->\n)?```(ts|tsx)\n([\s\S]*?)^```\s*$/gm)) {
    const preceding = markdown.slice(0, match.index);
    if (/<!-- snippet: no-check -->\s*$/.test(preceding) || match[2] === 'no-check') { skipped++; continue; }
    const name = (match[2] ?? file.replace(/\W/g, '-') + '-' + ++index) + '.' + match[3];
    if (locations.has(name)) throw Error('Duplicate snippet name: ' + name);
    const line = markdown.slice(0, match.index! + match[0].indexOf(match[4])).split('\n').length;
    locations.set(name, { file, line });
    await writeFile(directory + '/' + name, match[4]);
  }
}

test('every README, INTEGRATION and PROMPTING TS/TSX module compiles against real SDKs', async () => {
  expect(locations.size).toBeGreaterThanOrEqual(12);
  expect(skipped).toBe(0);
  const process = Bun.spawn(['bun', 'x', 'tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: workspace, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
  const output = (stdout + stderr).replace(/\.snippets\/([^ (]+)\((\d+),(\d+)\)/g, (_, name: string, line: string, column: string) => {
    const original = locations.get(name);
    return original ? original.file + ':' + (original.line + Number(line) - 1) + ':' + column : name + ':' + line;
  });
  if (code !== 0) throw Error(output);
  console.log('DOC_SNIPPETS ' + locations.size + ' compiled; no-check=' + skipped);
}, 60000);

async function* events<T>(values: T[]) { yield* values; }
async function collect(stream: AsyncIterable<string>) { let text = ''; for await (const delta of stream) text += delta; return text; }

test('documented SDK adapters yield text, ignore non-text deltas and propagate errors', async () => {
  const { openAIText } = await import(pathToFileURL(directory + '/openai-server.ts').href);
  const { anthropicText } = await import(pathToFileURL(directory + '/anthropic-server.ts').href);
  const chunk = (text: string | null): OpenAI.Chat.Completions.ChatCompletionChunk => ({
    id: 'chunk', object: 'chat.completion.chunk', created: 0, model: 'test',
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  });
  const anthropic: Anthropic.RawMessageStreamEvent[] = [
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{}' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
  ];
  expect(await collect(openAIText(events([chunk('Hello'), chunk(null), chunk(' world')])))).toBe('Hello world');
  expect(await collect(anthropicText(events(anthropic)))).toBe('Hello world');
  expect(await collect(openAIText(events([])))).toBe('');
  expect(await collect(anthropicText(events([])))).toBe('');
  async function* failed(): AsyncGenerator<never> { throw Error('SDK failed'); }
  await expect(collect(openAIText(failed()))).rejects.toThrow('SDK failed');
  await expect(collect(anthropicText(failed()))).rejects.toThrow('SDK failed');
});
