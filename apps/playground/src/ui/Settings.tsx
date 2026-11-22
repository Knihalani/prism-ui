import { useState } from 'react';
import type { AgentConfig } from '../agent/config';
import { Dialog } from './Dialog';

export function Settings({ config, onSave, onClose }: { config: AgentConfig; onSave(config: AgentConfig): void; onClose(): void }) {
  const [provider, setProvider] = useState(config.apiKey ? config.provider ?? 'openai' : 'scripted');
  const [apiKey, setKey] = useState(config.apiKey ?? ''), [model, setModel] = useState(config.model ?? '');
  return <Dialog title="Settings" onClose={onClose} className="settings-dialog"><h2>Make it your assistant</h2><p>Choose how Prism responds. Changes apply to new turns.</p>
    <form onSubmit={event => { event.preventDefault(); onSave({ provider, apiKey, model }); }}>
      <label>Assistant<select data-autofocus value={provider} onChange={e => { setProvider(e.target.value as typeof provider); setModel(''); }}><option value="scripted">Scripted</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label>
      {provider !== 'scripted' && <><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e => setKey(e.target.value)} placeholder={provider === 'openai' ? 'sk-…' : 'sk-ant-…'} /></label><label>Model<input value={model} onChange={e => setModel(e.target.value)} placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514'} /></label></>}
      <p className="settings-note">Keys stay in this browser and are sent only to your selected provider. Never use a shared or public device.</p>
      <button className="prism-pill save-settings" type="submit">Save changes</button>
    </form>
  </Dialog>;
}
