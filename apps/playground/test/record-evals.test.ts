import '../../../packages/react/test/setup';
import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordEvals } from '../scripts/record-evals';
import { createLlmAgent } from '../src/agent/llm';
import type { EvalRecording } from '../src/agent/evals';
import type { Agent } from '../src/agent/types';

async function record(agent: Agent) {
  const directory = await mkdtemp(join(tmpdir(), 'prism-recorder-'));
  const path = join(directory, 'recording.json'), logs: string[] = [];
  const recording: EvalRecording = { version: 1, provider: 'test-only', model: 'none', date: '2026-01-01', records: [] };
  try {
    const success = await recordEvals(agent, recording, path, message => logs.push(message));
    return { success, logs, saved: JSON.parse(await readFile(path, 'utf8')) as EvalRecording };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('recorder makes one request per prompt on success without logging model output', async () => {
  let calls = 0;
  const result = await record({ id: 'test', label: 'Test', async *respond() { calls++; yield { type: 'text', delta: 'Test output' }; } });
  expect(calls).toBe(10);
  expect(result.success).toBe(true);
  expect(result.saved.records).toHaveLength(10);
  expect(result.logs).toEqual([]);
});

test('recorder stops at the first HTTP 403 and never prints the response body or key', async () => {
  let calls = 0;
  const key = 'private-recorder-canary';
  const agent = createLlmAgent({ provider: 'openrouter', apiKey: key, fetch: (async () => { calls++; return new Response('Key limit exceeded: ' + key, { status: 403 }); }) as unknown as typeof fetch });
  const result = await record(agent);
  expect(calls).toBe(1);
  expect(result.success).toBe(false);
  expect(result.saved.records).toHaveLength(1);
  expect(result.logs).toEqual(['HTTP 403: Provider request failed. Check your key limits and permissions.']);
  expect(JSON.stringify(result)).not.toContain(key);
  expect(JSON.stringify(result)).not.toContain('Key limit exceeded');
});

test.each(['empty', 'error'] as const)('recorder stops on an %s response and preserves preceding successful outputs', async kind => {
  let calls = 0;
  const result = await record({ id: 'test', label: 'Test', async *respond() {
    calls++;
    if (calls === 1) yield { type: 'text', delta: 'Completed output' };
    else if (kind === 'error') throw Error('private-recorder-canary');
  } });
  expect(calls).toBe(2);
  expect(result.success).toBe(false);
  expect(result.saved.records).toHaveLength(2);
  expect(result.saved.records[0].output).toBe('Completed output');
  expect(result.logs).toHaveLength(1);
  expect(result.logs[0]).toStartWith('HTTP unavailable:');
  expect(JSON.stringify(result)).not.toContain('private-recorder-canary');
});
