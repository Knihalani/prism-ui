import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism, defineRenderer, defineTheme, type Action, type RendererProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/artifact.css';
import './adaptive-preview.css';

import { agentSource, adaptiveArtifactOptions } from './adaptive-source';
const plugins = [artifactPlugin];
const themes = [defineTheme({ name: 'adaptive-sage', tokens: { accent: '#387663', accentText: '#387663' } }), defineTheme({ name: 'adaptive-blue', tokens: { accent: '#4169bc', accentText: '#4169bc' } })];
function Heatmap({ data, complete, tokens }: RendererProps<{ values: number[] }>) {
  return <div className="heatmap" aria-label="Custom activity heatmap" data-complete={complete} style={{ color: tokens.text }}>{Array.from({ length: 35 }, (_, i) => <span key={i} title={'Activity ' + (data.values?.[i] ?? 0)} style={{ background: `color-mix(in srgb,var(--prism-accent) ${20 + (data.values?.[i] ?? 0) * 8}%,transparent)` }} />)}</div>;
}
function Priority({ useState, emit }: RendererProps) {
  const [value, setValue] = useState(0);
  return <div className="priority" role="group" aria-label="Developer priority picker">{['Low effort', 'Balanced', 'High impact'].map((label, i) => <button key={label} aria-pressed={value === i} onClick={() => { setValue(i); emit({ type: 'select', payload: { value: i, label } }); }}>{label}</button>)}</div>;
}
const priority = defineRenderer('priority', Priority, { feedback: true, prompt: 'A compact priority input. No data required.' });
const customSource = '```ui:heatmap\n' + JSON.stringify({ id: 'custom-heatmap', values: Array.from({ length: 35 }, (_, i) => (i * 7 + 3) % 10) }) + '\n```\n\n```ui:priority\n{"id":"custom-priority"}\n```';
function App() {
  const [width, setWidth] = useState(760), [dark, setDark] = useState(false), [theme, setTheme] = useState(0), [source, setSource] = useState(agentSource), [custom, setCustom] = useState(customSource), [done, setDone] = useState(true), [customDone, setCustomDone] = useState(true), [actions, setActions] = useState<Action[]>([]);
  const [store] = useState(() => createStore()), timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [events] = useState<Action[]>([]);
  useEffect(() => () => clearInterval(timer.current), []);
  Object.assign(window, { __actions: events, __store: store });
  const action = (value: Action) => { events.push(value); setActions([...events]); };
  function stream(customRender = false) {
    clearInterval(timer.current); let n = 0; const text = customRender ? customSource : agentSource;
    const write = customRender ? setCustom : setSource, finish = customRender ? setCustomDone : setDone;
    setDone(true); setCustomDone(true); write(''); finish(false);
    timer.current = setInterval(() => { n = Math.min(text.length, n + Math.max(54, Math.ceil(text.length / 100))); write(text.slice(0, n)); if (n === text.length) { clearInterval(timer.current); finish(true); } }, 24);
  }
  return <div className="adaptive-page" data-dark={dark}>
    <header className="host-tools"><a href="/">← Prism</a><span>Inline artifacts</span><div><button onClick={() => setWidth(width === 760 ? 300 : 760)}>{width}px</button><button onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'}</button><button onClick={() => setTheme(1 - theme)}>Switch theme</button><button onClick={() => stream()}>Replay stream</button></div></header>
    <main className="host-thread" style={{ width, maxWidth: 'calc(100% - 32px)' }}>
      <div className="host-user">How’s our team doing? Build me something useful, and let me choose what’s next.</div>
      <div className="host-avatar">P <span>Prism</span></div>
      <ArtifactProvider options={adaptiveArtifactOptions}><Prism source={source} done={done} plugins={plugins} theme={themes[theme]} mode={dark ? 'dark' : 'light'} store={store} onAction={action} /></ArtifactProvider>
      <details className="developer-examples" open><summary>Developer renderers · the small escape hatch</summary><p>Or bring an existing React component. Same streaming, state and feedback.</p><button onClick={() => stream(true)}>Stream custom renderer</button><Prism source={custom} done={customDone} renderers={{ heatmap: Heatmap, priority }} feedback theme={themes[theme]} mode={dark ? 'dark' : 'light'} store={store} onAction={action} /></details>
      <details className="event-log"><summary>Actions ({actions.length})</summary><pre data-testid="actions">{JSON.stringify(actions.map(({ type, component, id, payload }) => ({ type, component, id, payload })), null, 2)}</pre></details>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
