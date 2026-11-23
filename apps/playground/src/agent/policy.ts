export const artifactStatePaths = ['planning'] as const;
export const modelPresets = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  openrouter: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o-mini'],
} as const;
export type Provider = keyof typeof modelPresets;

export function boundedSnapshot(value: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!value || typeof value !== 'object') return result;
  for (const [key, entry] of Object.entries(value)) {
    if (key.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    try {
      const candidate = JSON.stringify({ ...result, [key]: entry });
      if (new TextEncoder().encode(candidate).length <= 2048) result[key] = JSON.parse(candidate)[key];
    } catch {}
  }
  return result;
}
