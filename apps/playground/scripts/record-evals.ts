import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createLlmAgent, systemPrompt } from '../src/agent/llm';
import { evals, type EvalRecording } from '../src/agent/evals';
import { modelPresets, resolveModel, type Provider } from '../src/agent/policy';
import type { Agent } from '../src/agent/types';

async function main() {
  const provider = process.env.EVAL_PROVIDER ?? 'openrouter';
  if (!Object.hasOwn(modelPresets, provider)) throw Error('Choose a supported EVAL_PROVIDER.');
  const keyNames = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
  const apiKey = process.env[keyNames[provider as Provider]];
  if (!apiKey) throw Error('The selected provider key is not configured.');
  const model = resolveModel(provider as Provider, process.env.EVAL_MODEL);
  const baseUrl = process.env.EVAL_BASE_URL;
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && url.hostname !== 'localhost')) throw Error('Use a credential-free HTTPS base URL.');
  }
  const path = fileURLToPath(new URL('../test/fixtures/live-evals.json', import.meta.url));
  await mkdir(fileURLToPath(new URL('../test/fixtures', import.meta.url)), { recursive: true });
  const recording: EvalRecording = { version: 1, provider, model, date: new Date().toISOString(), baseUrl, systemPrompt: systemPrompt(), records: [] };
  const agent = createLlmAgent({ provider: provider as Provider, apiKey, model, baseUrl, title: 'Prism evals' });
  if (!await recordEvals(agent, recording, path)) process.exitCode = 1;
}

export async function recordEvals(agent: Agent, recording: EvalRecording, path: string, log: (message: string) => void = console.log): Promise<boolean> {
  for (const evaluation of evals) {
    let output = '', error: string | undefined;
    const signal = AbortSignal.timeout(180000);
    try {
      for await (const event of agent.respond({ kind: 'message', text: evaluation.prompt, history: [] }, signal)) {
        if (event.type === 'text') output += event.delta;
      }
      if (signal.aborted) error = 'HTTP unavailable: Provider request timed out.';
      else if (!output.trim()) error = 'HTTP unavailable: No text returned.';
    } catch (cause) {
      const status = cause instanceof Error ? /^Provider request failed \((\d{3})\)$/.exec(cause.message)?.[1] : undefined;
      error = status ? `HTTP ${status}: Provider request failed. Check your key limits and permissions.` : 'HTTP unavailable: Provider request did not complete.';
    }
    recording.records.push({ id: evaluation.id, prompt: evaluation.prompt, output, ...(error ? { error } : {}) });
    await writeFile(path, JSON.stringify(recording, null, 2) + '\n');
    if (error) { log(error); return false; }
  }
  return true;
}

if (import.meta.main) await main();
