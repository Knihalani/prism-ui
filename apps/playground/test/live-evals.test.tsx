import '../../../packages/react/test/setup';
import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayFixture } from './live-fixture';

test('fixture replay accepts streamed output and rejects empty, mismatched and unsafe artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'prism-eval-'));
  const path = join(directory, 'handmade.json');
  const fixture = { version: 1, provider: 'hand-made harness test', model: 'none', date: '2026-01-01', records: [{ id: 'smoke', prompt: 'Show a notice', output: ':::callout{title="Ready"}\nA useful reply.\n:::' }] };
  try {
    await writeFile(path, JSON.stringify(fixture));
    expect(await replayFixture(path, [{ id: 'smoke', anyOf: ['callout'] }])).toBe(1);
    await expect(replayFixture(path, [{ id: 'smoke', anyOf: ['pick'] }])).rejects.toThrow('expected pick');
    fixture.records[0].output = '';
    await writeFile(path, JSON.stringify(fixture));
    await expect(replayFixture(path, [{ id: 'smoke', anyOf: ['callout'] }])).rejects.toThrow('incomplete');
    fixture.records[0].output = '```artifact:html {id=unsafe}\n<script>fetch("https://example.test")</script>\n```';
    await writeFile(path, JSON.stringify(fixture));
    await expect(replayFixture(path, [{ id: 'smoke', anyOf: ['artifact'] }])).rejects.toThrow('disallowed artifact capability');
    fixture.records[0].output = '```artifact:html {id=safe}\n<style>main{color:var(--prism-text);min-width:0}@container(max-width:320px){main{display:block}}</style><main>Ready</main>\n```';
    await writeFile(path, JSON.stringify(fixture));
    expect(await replayFixture(path, [{ id: 'smoke', anyOf: ['artifact'] }])).toBe(1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const recording = fileURLToPath(new URL('./fixtures/live-evals.json', import.meta.url));
const exists = await access(recording).then(() => true, () => false);
test.skipIf(!exists)('recorded live evals parse, pass artifact policy and replay through Prism', async () => {
  expect(await replayFixture(recording)).toBe(10);
}, 60000);
