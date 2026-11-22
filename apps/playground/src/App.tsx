import { Component, Profiler, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react';
import { Prism, ThemeScope, defaultRegistry, toPromptDocs, type Action, type Density } from '@prism-ui/react';
import type { Store } from '@prism-ui/state';
import { makeStore } from './store';
import { examples, kitchenSink } from './fixtures';
import { metrics, resetMetrics } from './metrics';
import { parsePatch } from './patch';
import { createReplay } from './replay';
import { playgroundPlugins } from './plugins';

const catalogue = examples();
const promptDocs = toPromptDocs(defaultRegistry);
type Tab = 'actions' | 'state' | 'prompt';
type Status = 'ready' | 'streaming' | 'paused' | 'stopped' | 'complete';
type Log = { number: number; time: string; action: Action; json: string };

function Mark() {
  return <svg width="32" height="36" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="m16 2 14 25-14 7L2 27 16 2Z" fill="currentColor" opacity=".13"/><path d="m16 2 14 25-14 7L2 27 16 2Zm0 0v32M2 27l14-9 14 9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function Icon({ name }: { name: 'play' | 'pause' | 'stop' | 'close' | 'copy' | 'arrow' }) {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{name === 'play' ? <path d="m6 3 10 7-10 7V3Z" fill="currentColor" stroke="none"/> : name === 'pause' ? <path d="M7 4v12M13 4v12" strokeWidth="3"/> : name === 'stop' ? <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" stroke="none"/> : name === 'close' ? <path d="m5 5 10 10M15 5 5 15"/> : name === 'copy' ? <><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 7V3H3v9h4"/></> : <path d="M3 10h14m-5-5 5 5-5 5"/>}</svg>;
}
class PreviewBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Prism preview failed', error, info); }
  render() { return this.state.error ? <div className="preview-error" role="alert"><strong>The preview hit an error</strong><pre>{this.state.error}</pre><p>Edit the source and replay, or select another example to recover.</p></div> : this.props.children; }
}

function Stats({ status, length }: { status: Status; length: number }) {
  const [value, setValue] = useState({ ...metrics });
  useEffect(() => { const timer = setInterval(() => setValue({ ...metrics }), 100); return () => clearInterval(timer); }, []);
  const progress = status === 'ready' ? 100 : Math.min(100, length ? value.bytes / length * 100 : 100);
  return <section className="stats" aria-label="Live parse statistics">
    <div><span>Chunks</span><strong>{value.chunks.toLocaleString()}</strong></div>
    <div title="Actual Prism parser push/end/root API time. Excludes React rendering and lazy descendant reads."><span>Parse time <small>API</small></span><strong>{value.parseMs.toFixed(2)} <em>ms</em></strong></div>
    <div><span>Per chunk</span><strong>{value.chunks ? (value.parseMs / value.chunks).toFixed(3) : '0.000'} <em>ms</em></strong></div>
    <div title="React Profiler commits, including component interactions. Available in the development build."><span>Render commits</span><strong>{import.meta.env.DEV ? value.commits : 'Dev only'}</strong></div>
    <div className="stream-progress"><span><i className={status === 'streaming' ? 'status-dot pulse' : 'status-dot'}/>{status === 'ready' ? 'Live preview' : status === 'streaming' ? 'Receiving tokens' : status === 'paused' ? 'Stream paused' : status === 'stopped' ? 'Stream stopped' : 'Stream complete'}<b>{Math.round(progress)}%</b></span><progress aria-label="Replay progress" max="100" value={progress}/></div>
  </section>;
}

function StatePanel({ store, reset, notify }: { store: Store; reset: () => void; notify: (text: string) => void }) {
  const subscribe = useCallback((fn: () => void) => store.subscribe('*', fn), [store]);
  const snapshot = useSyncExternalStore(subscribe, store.get, store.get);
  const [patch, setPatch] = useState('{\n  "set": { "rent": 1800 }\n}');
  const [error, setError] = useState('');
  const apply = () => { try { store.apply(parsePatch(patch)); setError(''); notify('State patch applied.'); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } };
  return <><div className="drawer-section-title"><h3>Shared store</h3><button className="text-button" onClick={() => { makeStore(true); reset(); }}>Reset state</button></div><p className="hint">Live values shared by every component, saved locally across reloads.</p><pre className="json snapshot" aria-label="Live store snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    <div className="drawer-section-title"><h3>Simulate an agent patch</h3><span className="tiny-tag">ui:state</span></div><p className="hint">Same set / merge / delete semantics as a finalized <code>ui:state</code> block.</p>
    <label className="sr-only" htmlFor="state-patch">State patch JSON</label><textarea id="state-patch" className="patch-editor" value={patch} spellCheck={false} onChange={event => setPatch(event.target.value)} aria-invalid={!!error}/>
    {error && <p className="error-text" role="alert">{error}</p>}<button className="chrome-button primary full" onClick={apply}>Apply patch <Icon name="arrow"/></button></>;
}

export function App() {
  const [source, setSource] = useState(kitchenSink), [example, setExample] = useState('kitchen');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [density, setDensity] = useState<Density>('comfortable');
  const [animate, setAnimate] = useState(true), [unstyled, setUnstyled] = useState(false);
  const [locale, setLocale] = useState('en-US'), [currency, setCurrency] = useState('USD');
  const [chars, setChars] = useState(4), [delay, setDelay] = useState(8);
  const options = useRef({ chars, delay }); options.current = { chars, delay };
  const [status, setStatus] = useState<Status>('ready');
  const [stream, setStream] = useState<AsyncIterable<string>>();
  const active = useRef<ReturnType<typeof createReplay> | null>(null), run = useRef(0);
  const [revision, setRevision] = useState(0), [store, setStore] = useState(makeStore);
  const [drawer, setDrawer] = useState<Tab | null>(null), [logs, setLogs] = useState<Log[]>([]);
  const sequence = useRef(0);
  const [notice, setNotice] = useState('');
  useEffect(() => () => { run.current++; active.current?.stop(); }, []);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); } }, [notice]);
  const busy = status === 'streaming' || status === 'paused';
  const resetReply = () => { run.current++; active.current?.stop(); setStream(undefined); setStatus('ready'); setRevision(v => v + 1); resetMetrics(); };
  const selectExample = (id: string) => {
    resetReply(); setExample(id); setSource(id === 'kitchen' ? kitchenSink : catalogue.find(entry => entry.id === id)!.source); setStore(makeStore()); setLogs([]);
  };
  const start = () => {
    active.current?.stop(); const id = ++run.current;
    resetMetrics(); setRevision(v => v + 1);
    const replay = createReplay(source, () => options.current, () => { if (run.current === id) setStatus(value => value === 'stopped' ? 'stopped' : 'complete'); });
    active.current = replay; setStream(replay.stream); setStatus('streaming');
  };
  const onAction = useCallback((action: Action) => {
    setLogs(previous => [...previous, { number: ++sequence.current, time: new Date().toLocaleTimeString(), action, json: JSON.stringify(action, null, 2) }]); setDrawer('actions');
  }, []);
  const copyDocs = async () => { try { await navigator.clipboard.writeText(promptDocs); setNotice('Prompt docs copied.'); } catch { setNotice('Clipboard unavailable. Select and copy the prompt text below.'); } };
  const toggleDrawer = (tab: Tab) => setDrawer(previous => previous === tab ? null : tab);
  return <ThemeScope theme={theme} density={density} animate={animate} className="playground">
    <header className="app-header"><div className="brand"><span className="brand-mark"><Mark/></span><span>prism<span className="brand-divider">/</span><span className="brand-page">playground</span></span><span className="tiny-tag version">EARLY PREVIEW</span></div><button className="text-button" onClick={() => setDrawer('prompt')}>Build with Prism <Icon name="arrow"/></button></header>
    <div className="intro"><div><span className="eyebrow">THE GENERATIVE UI WORKBENCH</span><h1>From a stream of text.<br className="mobile-break"/> To something you can use.</h1><p>Edit the source, replay the tokens, and make the interface your own.</p></div><div className="catalogue-count"><strong>{catalogue.length}</strong><span>registered<br/>components</span></div></div>
    <section className="settings" aria-label="Preview settings">
      <label className="example-select">Example<select aria-label="Example" value={example} onChange={event => selectExample(event.target.value)}><option value="custom" disabled>Custom source</option><option value="kitchen">✦ Kitchen sink · launch assistant</option><optgroup label="Component registry">{catalogue.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</optgroup></select></label>
      <label>Theme<select aria-label="Theme" value={theme} onChange={event => setTheme(event.target.value as typeof theme)}><option value="light">Light</option><option value="dark">Dark</option><option value="auto">Auto</option></select></label>
      <label>Density<select aria-label="Density" value={density} onChange={event => setDensity(event.target.value as Density)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
      <label>Locale<select aria-label="Locale" value={locale} onChange={event => setLocale(event.target.value)}><option>en-US</option><option>en-GB</option><option>de-DE</option><option>fr-FR</option><option>ja-JP</option></select></label>
      <label>Currency<select aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value)}>{['USD', 'EUR', 'GBP', 'JPY', 'INR'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="toggle"><input type="checkbox" checked={animate} onChange={event => setAnimate(event.target.checked)}/>Animate</label><label className="toggle"><input type="checkbox" checked={unstyled} onChange={event => setUnstyled(event.target.checked)}/>Unstyled</label>
    </section>
    <section className="workbench">
      <div className="runner"><div className="runner-title"><span className="signal">⌁</span><strong>Token playback</strong><span className="runner-hint">Simulate an LLM response</span></div><div className="runner-controls"><label><input aria-label="Characters per tick" type="number" min="1" max="500" value={chars} onChange={event => setChars(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}/>chars</label><span className="muted">every</span><label><input aria-label="Milliseconds per tick" type="number" min="1" max="1000" value={delay} onChange={event => setDelay(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))}/>ms</label>
        <button className="chrome-button primary" disabled={busy || !source} onClick={start}><Icon name="play"/>Stream</button><button className="chrome-button icon-button" aria-label={status === 'paused' ? 'Resume stream' : 'Pause stream'} disabled={!busy} onClick={() => { const paused = status !== 'paused'; active.current?.pause(paused); setStatus(paused ? 'paused' : 'streaming'); }}><Icon name={status === 'paused' ? 'play' : 'pause'}/></button><button className="chrome-button icon-button" aria-label="Stop stream" disabled={!busy} onClick={() => { active.current?.stop(); setStatus('stopped'); }}><Icon name="stop"/></button>
      </div></div>
      <Stats status={status} length={source.length}/>
      <div className="pane-tabs"><span><i className="pane-number">01</i> Source <span className="tiny-tag">MARKDOWN + UI</span></span><div className="inspector-tabs" role="group" aria-label="Inspector panels">{(['actions', 'state', 'prompt'] as const).map(tab => <button className={drawer === tab ? 'selected' : ''} aria-expanded={drawer === tab} aria-controls="inspector" key={tab} onClick={() => toggleDrawer(tab)}>{tab === 'actions' ? <>Actions <b>{logs.length}</b></> : tab === 'state' ? 'State' : 'Prompt docs'}</button>)}</div></div>
      <div className="workspace" data-drawer={!!drawer}>
        <section className="editor-pane" aria-label="Source editor"><div className="file-bar"><span className="file-dot"/>response.md<span>{source.length.toLocaleString()} chars</span></div><textarea aria-label="Markdown source" className="source-editor" spellCheck={false} readOnly={busy} value={source} onChange={event => { resetReply(); setSource(event.target.value); setExample('custom'); }}/><div className="pane-footer">{busy ? 'Stop playback to edit the source' : 'Plain text in. Possibilities out.'}<span>UTF-8</span></div></section>
        <section className="preview-pane" aria-label="Live Prism preview"><div className="preview-heading"><span><i className="status-dot"/>LIVE RENDER</span><span>React + Prism</span></div><div className="preview-scroll"><div className="assistant"><span className="assistant-avatar"><Mark/></span><div><strong>Prism Assistant</strong><span>Interactive by design</span></div><span className="tiny-tag">{stream && busy ? 'STREAMING' : 'PREVIEW'}</span></div><PreviewBoundary key={revision}><Profiler id="prism" onRender={() => { metrics.commits++; }}><Prism plugins={playgroundPlugins} source={stream ? '' : source} stream={stream} store={store} onAction={onAction} theme={theme} density={density} animate={animate} unstyled={unstyled} locale={locale} currency={currency}/></Profiler></PreviewBoundary>{!source && <div className="empty-state"><Mark/><h3>A blank canvas.</h3><p>Write some Markdown or choose a registry example to get started.</p></div>}</div><div className="pane-footer"><span>Powered by @prism-ui/react</span><span className="preview-hint">Try an interaction ↗</span></div></section>
        {drawer && <aside id="inspector" className="drawer" aria-label={`${drawer} inspector`}><div className="drawer-heading"><span>INSPECTOR / {drawer === 'prompt' ? 'PROMPT DOCS' : drawer.toUpperCase()}</span><button className="text-button" aria-label="Close inspector" onClick={() => setDrawer(null)}><Icon name="close"/></button></div><div className="drawer-body">
          {drawer === 'actions' ? <><div className="drawer-section-title"><h3>Action log <span className="count">{logs.length}</span></h3><button className="text-button" disabled={!logs.length} onClick={() => setLogs([])}>Clear</button></div><p className="hint">Every interaction, newest first. Payloads include the generated <code>message</code>.</p>{logs.length ? logs.slice().reverse().map(log => <details className="action-entry" key={log.number} open><summary><span className="event-type">{log.action.type}</span><span>{log.action.id}</span><time>{log.time}</time></summary><p>{log.action.message}</p><pre className="json">{log.json}</pre></details>) : <div className="empty-state"><span className="empty-glyph">↗</span><h3>Your next move, captured.</h3><p>Choose an option, update an estimate, or click a component action in the preview.</p></div>}</> : drawer === 'state' ? <StatePanel store={store} reset={() => { setStore(makeStore()); setNotice('Shared store reset.'); }} notify={setNotice}/> : <><div className="drawer-section-title"><h3>Teach your model</h3><button className="text-button" onClick={copyDocs}><Icon name="copy"/>Copy</button></div><p className="hint">Generated by <code>toPromptDocs()</code> from all {catalogue.length} registered definitions. New registry components appear automatically.</p><pre className="prompt-docs" tabIndex={0}>{promptDocs}</pre></>}
        </div></aside>}
      </div>
    </section><footer className="app-footer"><span><i className="status-dot"/>Local sandbox · no model or API key needed</span><span>Built with Prism tokens</span></footer><div className="toast" role="status" aria-live="polite">{notice}</div>
  </ThemeScope>;
}
