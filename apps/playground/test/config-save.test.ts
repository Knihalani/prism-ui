import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { forgetAgentKey, loadAgentConfig, saveAgentConfig } from '../src/agent/config';
import { modelPresets } from '../src/agent/policy';

afterEach(() => localStorage.clear());

test('a stale tab saves only its selected provider without overwriting newer keys', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'old-a' } });
  const stale = loadAgentConfig();
  saveAgentConfig({ provider: 'openai', keys: { openai: 'new-a' } });
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'new-router' } });
  expect(saveAgentConfig({ ...stale, provider: 'anthropic', model: 'chosen-model', keys: { ...stale.keys, anthropic: 'new-b' } })).toBe(true);
  expect(loadAgentConfig()).toEqual({ provider: 'anthropic', model: 'chosen-model', models: { anthropic: 'chosen-model' }, apiKey: 'new-b', keys: { openai: 'new-a', openrouter: 'new-router', anthropic: 'new-b' } });
});

test('scripted saves preserve stored keys and malformed storage can be replaced', () => {
  localStorage.setItem('prism-agent', '{broken');
  expect(saveAgentConfig({ provider: 'openai', keys: { openai: 'saved-a' } })).toBe(true);
  expect(saveAgentConfig({ provider: 'scripted', keys: {} })).toBe(true);
  expect(loadAgentConfig().keys).toEqual({ openai: 'saved-a' });
});

test('saving another provider preserves an unmigrated legacy key', () => {
  localStorage.setItem('prism-agent', JSON.stringify({ provider: 'openai', apiKey: 'legacy-a' }));
  expect(saveAgentConfig({ provider: 'anthropic', keys: { anthropic: 'new-b' } })).toBe(true);
  expect(loadAgentConfig().keys).toEqual({ openai: 'legacy-a', anthropic: 'new-b' });
});

test('forgetting an inactive key preserves the active provider, model and newest other keys', () => {
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'router-key' } });
  saveAgentConfig({ provider: 'openai', model: 'active-model', keys: { openai: 'latest-a' } });
  expect(forgetAgentKey('openrouter')).toBe(true);
  expect(loadAgentConfig()).toEqual({ provider: 'openai', model: 'active-model', models: { openai: 'active-model' }, apiKey: 'latest-a', keys: { openai: 'latest-a' } });
  expect(forgetAgentKey('anthropic')).toBe(true);
  expect(loadAgentConfig().provider).toBe('openai');
  expect(forgetAgentKey('openai')).toBe(true);
  expect(loadAgentConfig()).toEqual({ provider: 'scripted', model: 'active-model', models: { openai: 'active-model' }, apiKey: '', keys: {} });
});

test('all edited provider drafts merge against the open-time snapshot while untouched providers stay fresh', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'old-a' }, model: 'old-model-a' });
  saveAgentConfig({ provider: 'anthropic', keys: { anthropic: 'old-b' }, model: 'old-model-b' });
  const baseline = loadAgentConfig();
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'other-tab-key' }, model: 'other-tab-model' });
  expect(saveAgentConfig({ ...baseline, provider: 'anthropic', keys: { ...baseline.keys, openai: 'edited-a', anthropic: 'edited-b' }, model: 'edited-model-b', models: { ...baseline.models, openai: 'edited-model-a', anthropic: 'edited-model-b' } }, baseline)).toBe(true);
  expect(loadAgentConfig()).toEqual({ provider: 'anthropic', keys: { openai: 'edited-a', anthropic: 'edited-b', openrouter: 'other-tab-key' }, models: { openai: 'edited-model-a', anthropic: 'edited-model-b', openrouter: 'other-tab-model' }, model: 'edited-model-b', apiKey: 'edited-b' });
});

test('a model-only edit preserves a newer key and a key-only edit preserves a newer model', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'old-key' }, model: 'old-model' });
  const baseline = loadAgentConfig();
  saveAgentConfig({ provider: 'openai', keys: { openai: 'remote-key' }, model: 'old-model' });
  expect(saveAgentConfig({ ...baseline, model: 'local-model', models: { openai: 'local-model' } }, baseline)).toBe(true);
  expect(loadAgentConfig().apiKey).toBe('remote-key');
  const next = loadAgentConfig();
  saveAgentConfig({ ...next, model: 'remote-model', models: { openai: 'remote-model' } });
  expect(saveAgentConfig({ ...next, keys: { openai: 'local-key' } }, next)).toBe(true);
  expect(loadAgentConfig().model).toBe('remote-model');
  expect(loadAgentConfig().apiKey).toBe('local-key');
});

test('a deliberately cleared provider key is removed without touching other providers', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'old-a' } });
  saveAgentConfig({ provider: 'anthropic', keys: { anthropic: 'kept-b' } });
  const baseline = loadAgentConfig();
  expect(saveAgentConfig({ ...baseline, keys: { ...baseline.keys, openai: '' } }, baseline)).toBe(true);
  expect(loadAgentConfig().keys).toEqual({ anthropic: 'kept-b' });
});

test('an unchanged empty key draft preserves a key later added in another tab', () => {
  const baseline = loadAgentConfig();
  saveAgentConfig({ provider: 'openai', keys: { openai: 'other-tab-key' } });
  expect(saveAgentConfig({ ...baseline, keys: { openai: '' } }, baseline)).toBe(true);
  expect(loadAgentConfig().apiKey).toBe('other-tab-key');
});

test.each(['openai', 'anthropic'] as const)('blank model drafts preserve the newest saved model while saving %s', provider => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'saved-key' }, model: 'original-model' });
  const baseline = loadAgentConfig();
  saveAgentConfig({ ...baseline, model: 'newer-model', models: { openai: 'newer-model' } });
  expect(saveAgentConfig({ ...baseline, provider, model: ' \t\n ', models: { ...baseline.models, openai: ' \t\n ' } }, baseline)).toBe(true);
  expect(loadAgentConfig().models).toEqual({ openai: 'newer-model' });
  expect(loadAgentConfig().model).toBe(provider === 'openai' ? 'newer-model' : modelPresets.anthropic[0]);
});
