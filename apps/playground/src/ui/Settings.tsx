import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { AgentConfig } from '../agent/config';
import { modelPresets, type Provider } from '../agent/policy';

export function Settings({ config, anchor, onSave, onClose }: { config: AgentConfig; anchor: RefObject<HTMLButtonElement | null>; onSave(config: AgentConfig): boolean; onClose(): void }) {
  const [provider, setProvider] = useState(config.provider ?? 'openai');
  const presets: readonly string[] = provider === 'scripted' ? [] : modelPresets[provider];
  const [keys, setKeys] = useState(config.keys ?? {});
  const [model, setModel] = useState(config.model || (provider === 'scripted' ? '' : modelPresets[provider][0]));
  const [custom, setCustom] = useState(!!config.model && !presets.includes(config.model));
  const [show, setShow] = useState(false), [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const apiKey = provider === 'scripted' ? '' : keys[provider] ?? '';
  useLayoutEffect(() => {
    const place = () => {
      const chip = anchor.current; if (!chip || !ref.current) return;
      const bounds = chip.getBoundingClientRect(), panel = chip.closest('.chat-main')?.getBoundingClientRect();
      const width = Math.min(336, (panel?.width || innerWidth) - 24, innerWidth - 16);
      const height = ref.current.getBoundingClientRect().height || 340;
      const left = Math.max(8, Math.min(bounds.left + bounds.width / 2 - width / 2, innerWidth - width - 8));
      const top = Math.max(8, Math.min(bounds.top >= height + 16 ? bounds.top - height - 8 : bounds.bottom + 8, innerHeight - height - 8));
      setPosition({ width, left, top });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, provider, model, error]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select') ?? []);
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); (previous?.isConnected ? previous : anchor.current)?.focus(); };
  }, [anchor, onClose]);
  function save(nextKeys = keys) {
    setError('');
    if (!onSave({ provider, keys: nextKeys, apiKey: provider === 'scripted' ? '' : nextKeys[provider] ?? '', model: model.trim() })) setError('Browser storage is unavailable. Nothing was saved.');
  }
  const target = anchor.current?.closest('.chat-app') ?? document.body;
  return createPortal(<div ref={ref} id="model-settings" className="model-popover" role="dialog" aria-label="Connect a model" style={position}>
    <header><div><strong>Your model, your key</strong><span>A little more possible.</span></div><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button></header>
    <form onSubmit={event => { event.preventDefault(); save(); }}>
      <div className="provider-segments" role="group" aria-label="Assistant">{(['scripted', 'openai', 'anthropic', 'openrouter'] as const).map(name => <button key={name} type="button" aria-label={name === 'scripted' ? 'Scripted' : name === 'openai' ? 'OpenAI' : name === 'anthropic' ? 'Anthropic' : 'OpenRouter'} aria-pressed={provider === name} onClick={() => { setProvider(name); setModel(name === 'scripted' ? '' : modelPresets[name][0]); setCustom(false); setShow(false); }}>{name === 'scripted' ? 'Demo' : name === 'openai' ? 'OpenAI' : name === 'anthropic' ? 'Claude' : 'Router'}</button>)}</div>
      {provider !== 'scripted' && <><label htmlFor="model-api-key">API key</label><div className="model-key"><input id="model-api-key" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={apiKey} placeholder="Paste your provider key" onChange={event => setKeys({ ...keys, [provider]: event.target.value })} /><button type="button" aria-label={show ? 'Hide key' : 'Show key'} aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
      <label>Model preset<select aria-label="Model preset" value={custom ? 'custom' : model} onChange={event => { setCustom(event.target.value === 'custom'); setModel(event.target.value === 'custom' ? '' : event.target.value); }}>{presets.map(value => <option key={value}>{value}</option>)}<option value="custom">Custom model…</option></select></label>
      {custom && <input aria-label="Model" value={model} placeholder="Model ID" onChange={event => setModel(event.target.value)} />}</>}
      <p className="model-notice">localStorage only · Browser → provider directly</p>
      {error && <p role="status" className="model-storage-error">{error}</p>}
      <footer><button type="button" className="forget-key" disabled={!apiKey} onClick={() => { if (provider !== 'scripted') { const next = { ...keys }; delete next[provider as Provider]; save(next); } }}>Forget key</button><button className="save-model" type="submit">Save changes</button></footer>
    </form>
  </div>, target);
}
