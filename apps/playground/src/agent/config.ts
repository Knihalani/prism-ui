import { createLlmAgent, type LlmOptions } from './llm';
import { createScriptedAgent } from './scripted';
import type { Agent } from './types';
import { modelPresets, type Provider } from './policy';

export type AgentConfig = { provider?: LlmOptions['provider'] | 'scripted'; apiKey?: string; model?: string; keys?: Partial<Record<Provider, string>> };
export function loadAgentConfig(): AgentConfig {
  let stored: AgentConfig = {};
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem('prism-agent') ?? '{}');
    if (value && typeof value === 'object') stored = value;
  } catch {}
  const provider = stored.provider === 'scripted' || Object.hasOwn(modelPresets, stored.provider ?? '') ? stored.provider! : 'openai';
  const keys: Partial<Record<Provider, string>> = {};
  for (const name of Object.keys(modelPresets) as Provider[]) {
    if (typeof stored.keys?.[name] === 'string') keys[name] = stored.keys[name];
  }
  if (!stored.keys && provider !== 'scripted' && typeof stored.apiKey === 'string') {
    keys[provider] = stored.apiKey;
    saveAgentConfig({ provider, keys, model: stored.model });
  }
  return { provider, keys, apiKey: provider === 'scripted' ? '' : keys[provider] ?? '', model: typeof stored.model === 'string' ? stored.model : '' };
}
export function createAgent(config: AgentConfig = loadAgentConfig()): Agent {
  const provider = config.provider ?? 'openai';
  const apiKey = provider === 'scripted' ? '' : config.keys ? config.keys[provider] : config.apiKey;
  return provider !== 'scripted' && apiKey?.trim() ? createLlmAgent({ provider, apiKey: apiKey.trim(), model: config.model }) : createScriptedAgent();
}
export function saveAgentConfig(config: AgentConfig): boolean {
  try {
    globalThis.localStorage.setItem('prism-agent', JSON.stringify({ provider: config.provider, keys: config.keys ?? {}, model: config.model }));
    return true;
  } catch { return false; }
}
