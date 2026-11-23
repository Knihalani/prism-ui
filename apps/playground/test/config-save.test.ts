import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { loadAgentConfig, saveAgentConfig } from '../src/agent/config';

afterEach(() => localStorage.clear());

test('a stale tab saves only its selected provider without overwriting newer keys', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'old-a' } });
  const stale = loadAgentConfig();
  saveAgentConfig({ provider: 'openai', keys: { openai: 'new-a' } });
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'new-router' } });
  expect(saveAgentConfig({ ...stale, provider: 'anthropic', model: 'chosen-model', keys: { ...stale.keys, anthropic: 'new-b' } })).toBe(true);
  expect(loadAgentConfig()).toEqual({ provider: 'anthropic', model: 'chosen-model', apiKey: 'new-b', keys: { openai: 'new-a', openrouter: 'new-router', anthropic: 'new-b' } });
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
