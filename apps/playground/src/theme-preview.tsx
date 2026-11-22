import { useEffect, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism, type Mode } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import '@prism-ui/components/pick';
import '@prism-ui/components/mockup';
import '@prism-ui/components/view';
import '@prism-ui/components/codeblock';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/estimate.css';
import '@prism-ui/components/pick.css';
import '@prism-ui/components/mockup.css';
import '@prism-ui/components/view.css';
import '@prism-ui/components/codeblock.css';
import '@prism-ui/components/runbook';
import '@prism-ui/components/runbook.css';
import '@prism-ui/components/troubleshoot';
import '@prism-ui/components/troubleshoot.css';
import '@prism-ui/components/summary';
import '@prism-ui/components/summary.css';
import '@prism-ui/components/tabs';
import '@prism-ui/components/tabs.css';
import '@prism-ui/components/callout';
import '@prism-ui/components/callout.css';
import '@prism-ui/components/card';
import '@prism-ui/components/card.css';
import '@prism-ui/components/grid';
import '@prism-ui/components/grid.css';
import '@prism-ui/components/badge';
import '@prism-ui/components/badge.css';
import { previewOptions, previewSource, previewThemes } from './theme-preview-data';
import './theme-preview.css';

const initial = previewOptions(window.location.search);
const animate = new URLSearchParams(window.location.search).get('animate') === 'true';
function Preview() {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [selected, setSelected] = useState(initial.theme);
  const [width, setWidth] = useState(initial.width);
  const [lastAction, setLastAction] = useState('');
  useEffect(() => {
    const params = new URLSearchParams();
    if (selected !== 'all') params.set('theme', selected);
    params.set('mode', mode);
    if (animate) params.set('animate', 'true');
    if (width) params.set('width', String(width));
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }, [selected, mode, width]);
  return <main data-preview-mode={mode}>
    <header className="preview-header"><div><p>PRISM / THEME SYSTEM</p><h1>Same intelligence. Your interface.</h1></div>
      <div className="preview-controls">
        <label>Theme<select aria-label="Theme" value={selected} onChange={event => setSelected(event.target.value)}><option value="all">All themes</option>{previewThemes.map(({ theme }) => <option key={theme.name} value={theme.name}>{theme.name}</option>)}</select></label>
        <label>Container width<select aria-label="Container width" value={width ?? ''} onChange={event => setWidth(event.target.value ? Number(event.target.value) : undefined)}><option value="">Responsive</option>{[...new Set([280, 300, 760, ...(width ? [width] : [])])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value}px</option>)}</select></label>
        <button type="button" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark mode' : 'Light mode'}</button>
      </div>
    </header>
    <p className="preview-intro">One reply. Independent stores. Five theme surfaces.</p>
    <div className="preview-grid" data-single={selected !== 'all' ? '' : undefined} style={width ? { '--preview-width': `${width}px` } as CSSProperties : undefined}>
      {previewThemes.filter(({ theme }) => selected === 'all' || theme.name === selected).map(({ theme, description, caption }) => <section className={`preview-example preview-${theme.name}`} key={theme.name} data-preview-theme={theme.name}>
        <div className="preview-label"><h2>{theme.name}</h2><small>{description}</small></div>
        <div className="preview-stage"><Prism theme={theme} mode={mode} source={previewSource} animate={animate} locale="en-US" onAction={action => setLastAction(`${theme.name}: ${action.type}`)} /></div>
        <p className="preview-caption">{caption}</p>
      </section>)}
    </div>
    <p className="preview-status" role="status">{lastAction}</p>
    <footer className="preview-footer"><span>Independent stores · Scoped CSS · Replaceable parts</span><span>@prism-ui/react + @prism-ui/themes</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
