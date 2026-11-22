import { createLlmAgent, type LlmOptions } from './llm';
import { createScriptedAgent } from './scripted';
import type { Agent } from './types';

export type AgentConfig = { provider?: LlmOptions['provider']; apiKey?: string; model?: string };
export function loadAgentConfig(): AgentConfig {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
  let stored: AgentConfig = {};
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem('prism-agent') ?? '{}');
    if (value && typeof value === 'object') stored = value;
  } catch {}
  const provider = stored.provider === 'anthropic' || stored.provider === 'openai' ? stored.provider : env.VITE_PRISM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai';
  return { provider, apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : (provider === 'anthropic' ? env.VITE_ANTHROPIC_API_KEY : env.VITE_OPENAI_API_KEY), model: typeof stored.model === 'string' ? stored.model : env.VITE_PRISM_MODEL };
}
export function createAgent(config: AgentConfig = loadAgentConfig()): Agent {
  return config.apiKey?.trim() ? createLlmAgent({ ...config, provider: config.provider ?? 'openai', apiKey: config.apiKey }) : createScriptedAgent();
}
