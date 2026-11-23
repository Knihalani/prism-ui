import { createLlmAgent, type LlmOptions } from './llm';
import { createScriptedAgent } from './scripted';
import type { Agent } from './types';
import { modelPresets, type Provider } from './policy';

export type AgentConfig = { provider?: LlmOptions['provider'] | 'scripted'; apiKey?: string; model?: string; keys?: Partial<Record<Provider, string>>; models?: Partial<Record<Provider, string>> };
export function loadAgentConfig(): AgentConfig {
  let stored: AgentConfig = {};
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem('prism-agent') ?? '{}');
    if (value && typeof value === 'object') stored = value;
  } catch {}
  const provider = stored.provider === 'scripted' || Object.hasOwn(modelPresets, stored.provider ?? '') ? stored.provider! : 'openai';
  const keys: Partial<Record<Provider, string>> = {};
  const models: Partial<Record<Provider, string>> = {};
  for (const name of Object.keys(modelPresets) as Provider[]) {
    if (typeof stored.keys?.[name] === 'string') keys[name] = stored.keys[name];
    if (typeof stored.models?.[name] === 'string') models[name] = stored.models[name];
  }
  if (provider !== 'scripted' && models[provider] === undefined && typeof stored.model === 'string' && stored.model) models[provider] = stored.model;
  if (!stored.keys && provider !== 'scripted' && typeof stored.apiKey === 'string') {
    keys[provider] = stored.apiKey;
    saveAgentConfig({ provider, keys, model: stored.model });
  }
  return { provider, keys, models, apiKey: provider === 'scripted' ? '' : keys[provider] ?? '', model: provider === 'scripted' ? typeof stored.model === 'string' ? stored.model : '' : models[provider] ?? '' };
}
export function createAgent(config: AgentConfig = loadAgentConfig()): Agent {
  const provider = config.provider ?? 'openai';
  const apiKey = provider === 'scripted' ? '' : config.keys ? config.keys[provider] : config.apiKey;
  return provider !== 'scripted' && apiKey?.trim() ? createLlmAgent({ provider, apiKey: apiKey.trim(), model: config.model }) : createScriptedAgent();
}
export function saveAgentConfig(config: AgentConfig, baseline?: AgentConfig): boolean { return updateAgentConfig(config, undefined, baseline); }
export function forgetAgentKey(provider: Provider): boolean { return updateAgentConfig(undefined, provider); }
function updateAgentConfig(config?: AgentConfig, forgotten?: Provider, baseline?: AgentConfig): boolean {
  try {
    let stored: AgentConfig = {};
    const raw = globalThis.localStorage.getItem('prism-agent');
    try { stored = JSON.parse(raw ?? '{}') ?? {}; } catch {}
    const keys: Partial<Record<Provider, string>> = {};
    const models: Partial<Record<Provider, string>> = {};
    for (const name of Object.keys(modelPresets) as Provider[]) {
      if (typeof stored.keys?.[name] === 'string') keys[name] = stored.keys[name];
      if (typeof stored.models?.[name] === 'string') models[name] = stored.models[name];
    }
    const previous = stored.provider ?? 'openai';
    if (!stored.keys && previous !== 'scripted' && Object.hasOwn(modelPresets, previous) && typeof stored.apiKey === 'string') keys[previous] = stored.apiKey;
    if (previous !== 'scripted' && Object.hasOwn(modelPresets, previous) && models[previous] === undefined && typeof stored.model === 'string' && stored.model) models[previous] = stored.model;
    const provider = config ? config.provider ?? 'openai' : previous === forgotten ? 'scripted' : previous;
    if (forgotten) delete keys[forgotten];
    else if (config) {
      for (const name of Object.keys(modelPresets) as Provider[]) {
        const key = config.keys ? config.keys[name] : name === provider ? config.apiKey : undefined;
        if (baseline ? (key ?? '') !== (baseline.keys?.[name] ?? '') : name === provider) {
          if (key) keys[name] = key;
          else delete keys[name];
        }
        const model = config.models?.[name] ?? (name === provider ? config.model : undefined);
        const before = baseline?.models?.[name] ?? (name === baseline?.provider ? baseline.model : undefined);
        const nextModel = model?.trim();
        if ((baseline ? model !== before : name === provider) && nextModel) models[name] = nextModel;
      }
    }
    const model = config ? provider === 'scripted' ? config.model : models[provider] : stored.model;
    globalThis.localStorage.setItem('prism-agent', JSON.stringify({ provider, keys, models, model }));
    return true;
  } catch { return false; }
}
