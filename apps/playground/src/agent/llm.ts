import '@prism-ui/components';
import { createSystemPrompt } from '@prism-ui/react';
import type { Agent, AgentEvent } from './types';
import { describeActionTurn } from './interaction';
import { artifactStatePaths, resolveModel, type Provider } from './policy';

export interface LlmOptions { provider: Provider; apiKey: string; model?: string; baseUrl?: string; referer?: string; title?: string; fetch?: typeof globalThis.fetch }
class ProviderRequestError extends Error {
  constructor(status: number) { super(`Provider request failed (${status})`); }
}
function withoutFontData(text: string) {
  return text.replace(/data:(?:font\/[\w.+-]+|application\/(?:x-font-[\w.+-]+|font-[\w.+-]+|vnd\.ms-fontobject));base64,[a-z0-9+/=]+/gi, '[embedded font omitted]');
}
export function systemPrompt() {
  return createSystemPrompt({ instructions: 'You are a thoughtful premium assistant. Weave concise prose with interactive Prism components when useful. Do not claim to perform external actions.', artifacts: { statePaths: artifactStatePaths } });
}
async function* sse(response: Response, signal: AbortSignal): AsyncIterable<any> {
  if (!response.body) throw Error('Provider returned an empty response body');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  let buffer = '';
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data === '[DONE]') return;
        if (data && !signal.aborted) yield JSON.parse(data);
      }
      if (done) break;
    }
  } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createLlmAgent(options: LlmOptions): Agent {
  const anthropic = options.provider === 'anthropic';
  return {
    id: options.provider, label: anthropic ? 'Claude' : 'OpenAI',
    async *respond(input, signal): AsyncIterable<AgentEvent> {
      if (signal.aborted || (input.kind === 'action' && input.action.type === 'copy')) return;
      yield { type: 'thinking' };
      const content = withoutFontData(input.kind === 'message' ? input.text : describeActionTurn(input));
      const messages = [...input.history.filter(turn => turn.role !== 'assistant' || turn.text.trim()).map(turn => ({ role: turn.role, content: withoutFontData(turn.text) })), { role: 'user', content }];
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (anthropic) Object.assign(headers, { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
      else headers.Authorization = 'Bearer ' + options.apiKey;
      if (options.provider === 'openrouter') {
        if (options.referer) headers['HTTP-Referer'] = options.referer;
        if (options.title) headers['X-Title'] = options.title;
      }
      try {
        const base = options.baseUrl ?? (anthropic ? 'https://api.anthropic.com/v1' : options.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
        const response = await (options.fetch ?? globalThis.fetch)(base.replace(/\/$/, '') + (anthropic ? '/messages' : '/chat/completions'), {
          method: 'POST', signal, headers,
          body: JSON.stringify({ model: resolveModel(options.provider, options.model), stream: true, ...(anthropic ? { system: systemPrompt(), max_tokens: 8192, messages } : { ...(options.provider === 'openrouter' ? { max_tokens: 8192 } : {}), messages: [{ role: 'system', content: systemPrompt() }, ...messages] }) }),
        });
        if (!response.ok) throw new ProviderRequestError(response.status);
        for await (const event of sse(response, signal)) {
          if (event.type === 'error' || event.error) throw Error('Provider reported a streaming error');
          const delta = anthropic ? event.type === 'content_block_delta' && event.delta?.type === 'text_delta' ? event.delta.text : undefined : event.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta && !signal.aborted) yield { type: 'text', delta };
        }
      } catch (error) { if (!signal.aborted) throw error instanceof ProviderRequestError ? error : Error('Provider connection failed. Check your model settings and try again.'); }
    },
  };
}
