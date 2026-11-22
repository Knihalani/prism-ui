import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism, defineRenderer, defineTheme, type Action, type RendererProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/artifact.css';
import './adaptive-preview.css';

const common = `<style>
body{font:inherit;line-height:1.5;color:var(--prism-text)}main{padding:20px 0}h2{font-size:22px;letter-spacing:-.035em;margin:0 0 6px}p{margin:0;color:var(--prism-text-muted)}small{font-size:12px;color:var(--prism-text-muted)}button{border:1px solid var(--prism-border);background:transparent;color:inherit;border-radius:var(--prism-radius-sm);padding:8px 12px;cursor:pointer}button:focus-visible{outline:2px solid var(--prism-focus)}button[aria-pressed=true]{background:var(--prism-accent);color:var(--prism-on-accent);border-color:transparent}strong{font-variant-numeric:tabular-nums} @container(min-width:520px){main{padding-block:28px}h2{font-size:28px}}
</style>`;
const dashboard = common + `<main><small>WORKSPACE / THIS WEEK</small><h2>A little more momentum.</h2><p>The work is moving. Here’s the shape of your week.</p>
<style>.stats{display:grid;grid-template-columns:1fr;gap:16px;margin-top:24px}.stat{padding-block:14px;border-top:1px solid var(--prism-border)}.stat strong{display:block;font-size:36px;letter-spacing:-.05em}.chart{display:flex;align-items:end;gap:8px;height:112px;margin-block:24px 10px}.bar{flex:1;border-radius:4px 4px 0 0;background:color-mix(in srgb,var(--prism-accent) 28%,transparent)}.bar:last-child{background:var(--prism-accent)}.caption{display:flex;justify-content:space-between;font-size:12px;color:var(--prism-text-muted)}@container(min-width:520px){.stats{grid-template-columns:repeat(3,minmax(0,1fr))}.chart{height:142px;gap:14px}}</style>
<div class="stats"><div class="stat"><small>Projects shipped</small><strong>12</strong><small>↑ 3 from last week</small></div><div class="stat"><small>Focus hours</small><strong>86.5</strong><small>Across your team</small></div><div class="stat"><small>Open decisions</small><strong>4</strong><small>Ready when you are</small></div></div>
<div class="chart" aria-label="Team activity increased through Friday">${[32, 64, 48, 79, 60, 88, 100].map(n => `<div class="bar" style="height:${n}%"></div>`).join('')}</div><div class="caption"><span>Monday</span><span>Team activity · +24%</span><span>Sunday</span></div></main>`;
const input = common + `<main><small>YOUR CALL</small><h2>What should we tackle first?</h2><p>Place the next idea by impact and effort.</p><style>.matrix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:20px}.matrix button{aspect-ratio:1.5;font-size:13px;padding:6px}.axis{display:flex;justify-content:space-between;font-size:12px;margin-top:8px;color:var(--prism-text-muted)}output{display:block;margin-top:16px;font-size:14px}@container(min-width:520px){.matrix button{aspect-ratio:3.2}}</style>
<div class="matrix" role="group" aria-label="Priority and effort">${['Quick win', 'Worth a look', 'Big bet', 'Small lift', 'Steady work', 'Plan ahead', 'Nice to have', 'Later', 'Not now'].map((label, i) => `<button data-index="${i}" aria-pressed="false">${label}</button>`).join('')}</div><div class="axis"><span>← Less effort</span><span>More effort →</span></div><output aria-live="polite">Choose a position.</output></main><script>
const buttons=[...document.querySelectorAll('.matrix button')];
function update(value){buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===value?.index)));document.querySelector('output').textContent=value?'Selected: '+value.label:'Choose a position.'}
update(prism.state.get('planning.selection'));prism.state.subscribe('planning.selection',update);
buttons.forEach((button,index)=>button.onclick=()=>{const value={index,label:button.textContent,effort:index%3,impact:2-Math.floor(index/3)};prism.state.set('planning.selection',value);prism.emit('select',value);update(value)});
</script>`;
const fence = (id: string, source: string) => '```artifact:html {id=' + id + ' height=auto}\n' + source + '\n```';
const agentSource = 'Here’s your team’s week, at a glance. This dashboard and the input below are entirely agent-authored HTML — Prism supplies the host context, not a fixed layout.\n\n' + fence('adaptive-dashboard', dashboard) + '\n\nLet’s turn that into a decision.\n\n' + fence('adaptive-input', input);
const options = { statePaths: ['planning'] };
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
    timer.current = setInterval(() => { n = Math.min(text.length, n + 54); write(text.slice(0, n)); if (n === text.length) { clearInterval(timer.current); finish(true); } }, 24);
  }
  return <div className="adaptive-page" data-dark={dark}>
    <header className="host-tools"><a href="/">← Prism</a><span>Inline artifacts</span><div><button onClick={() => setWidth(width === 760 ? 300 : 760)}>{width}px</button><button onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'}</button><button onClick={() => setTheme(1 - theme)}>Switch theme</button><button onClick={() => stream()}>Replay stream</button></div></header>
    <main className="host-thread" style={{ width, maxWidth: 'calc(100% - 32px)' }}>
      <div className="host-user">How’s our team doing? Build me something useful, and let me choose what’s next.</div>
      <div className="host-avatar">P <span>Prism</span></div>
      <ArtifactProvider options={options}><Prism source={source} done={done} plugins={plugins} theme={themes[theme]} mode={dark ? 'dark' : 'light'} store={store} onAction={action} /></ArtifactProvider>
      <details className="developer-examples" open><summary>Developer renderers · the small escape hatch</summary><p>Or bring an existing React component. Same streaming, state and feedback.</p><button onClick={() => stream(true)}>Stream custom renderer</button><Prism source={custom} done={customDone} renderers={{ heatmap: Heatmap, priority }} feedback theme={themes[theme]} mode={dark ? 'dark' : 'light'} store={store} onAction={action} /></details>
      <details className="event-log"><summary>Actions ({actions.length})</summary><pre data-testid="actions">{JSON.stringify(actions.map(({ type, component, id, payload }) => ({ type, component, id, payload })), null, 2)}</pre></details>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
