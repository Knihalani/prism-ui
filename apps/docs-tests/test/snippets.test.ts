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

test('AI route removes remote file parts before model conversion', async () => {
  const { safeChatMessages } = await import(pathToFileURL(directory + '/ai-route.ts').href);
  const file = { type: 'file', mediaType: 'application/pdf', url: 'https://example.test/private.pdf' };
  const text = { type: 'text', text: 'Explain this' };
  expect(await safeChatMessages([
    { id: 'mixed', role: 'user', parts: [file, text] },
    { id: 'file-only', role: 'user', parts: [file] },
    { id: 'system', role: 'system', parts: [text] },
  ])).toEqual([{ id: 'mixed', role: 'user', parts: [text] }]);
  expect(await safeChatMessages([])).toEqual([]);
  await expect(safeChatMessages([{ id: 'invalid', role: 'user', parts: [{ type: 'text', text: 42 }] }])).rejects.toThrow();
});

test('Anthropic history excludes failed and whitespace-only assistant replies', async () => {
  const { anthropicBodySchema } = await import(pathToFileURL(directory + '/anthropic-server.ts').href);
  const user = { role: 'user', content: 'Hello' }, assistant = { role: 'assistant', content: 'Hi' };
  expect(anthropicBodySchema.parse({ history: [
    user, { role: 'assistant', content: '' }, { role: 'assistant', content: '  \n' }, assistant,
  ], text: 'Continue' }).history).toEqual([user, assistant]);
  expect(anthropicBodySchema.parse({ history: [], text: 'Hello' }).history).toEqual([]);
  expect(() => anthropicBodySchema.parse({ history: [{ role: 'assistant', content: null }], text: 'Hello' })).toThrow();
});

test('AI history retains applyState calls and results but removes file and source parts', async () => {
  const { safeChatMessages } = await import(pathToFileURL(directory + '/ai-route.ts').href);
  const { convertToModelMessages } = await import('ai');
  const patch = { set: { 'planning.room': 'north' } };
  const tool = { type: 'tool-applyState', toolCallId: 'apply-1', state: 'output-available', input: patch, output: patch };
  const text = { type: 'text', text: 'Updated the room.' };
  const messages = await safeChatMessages([{ id: 'assistant', role: 'assistant', parts: [
    tool, text,
    { type: 'file', mediaType: 'application/pdf', url: 'https://example.test/private.pdf' },
    { type: 'source-url', sourceId: 'link', url: 'https://example.test/source' },
    { type: 'source-document', sourceId: 'document', mediaType: 'application/pdf', title: 'Document' },
  ] }]);
  expect(messages).toEqual([{ id: 'assistant', role: 'assistant', parts: [tool, text] }]);
  const converted = convertToModelMessages(messages);
  expect(converted).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: 'assistant', content: expect.arrayContaining([
      expect.objectContaining({ type: 'tool-call', toolName: 'applyState', input: patch }),
    ]) }),
    expect.objectContaining({ role: 'tool', content: expect.arrayContaining([
      expect.objectContaining({ type: 'tool-result', toolName: 'applyState', output: { type: 'json', value: patch } }),
    ]) }),
  ]));
  const pending = { type: 'tool-applyState', toolCallId: 'apply-2', state: 'input-available', input: patch };
  expect(await safeChatMessages([{ id: 'pending', role: 'assistant', parts: [pending] }]))
    .toEqual([{ id: 'pending', role: 'assistant', parts: [pending] }]);
});

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
