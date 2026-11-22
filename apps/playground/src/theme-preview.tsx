import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism, host, type Mode } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/estimate.css';
import { instrument, refraction } from '@prism-ui/themes';
import './theme-preview.css';

const source = '```ui:estimate\n' + JSON.stringify({
  id: 'pilot', title: 'Pilot estimate', currency: 'USD', submit: 'Send estimate',
  items: [
    { id: 'seats', label: 'Pilot seats', description: 'A week with real teams.', price: 36, qty: 6, min: 1, max: 20, unit: 'seat' },
    { id: 'thanks', label: 'Thank-yous', description: 'For six honest conversations.', price: 12, qty: 6, min: 0, max: 20, unit: 'person' },
    { id: 'notes', label: 'Shared notes', description: 'One home for every insight.', price: 36, qty: 1, optional: true, enabled: true },
  ],
}) + '\n```';
function Preview() {
  const [mode, setMode] = useState<Mode>('light');
  return <main data-preview-mode={mode}><header className="preview-header"><div><p>PRISM / THEME SYSTEM</p><h1>Same intelligence. Your interface.</h1></div><button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark mode' : 'Light mode'}</button></header>
    <p className="preview-intro">One component. One data model. Three independent design systems, rendered together.</p>
    <div className="preview-grid">{[host, refraction, instrument].map((theme, index) => <section className={`preview-example preview-${theme.name}`} key={theme.name}>
      <div className="preview-label"><span>0{index + 1}</span><h2>{theme.name}</h2><small>{['Native to the host', 'The original material', 'Structure, not just skin'][index]}</small></div>
      <div className="preview-stage"><Prism theme={theme} mode={mode} source={source} animate={false} locale="en-US" onAction={() => {}} /></div>
      <p className="preview-caption">{['Inherits this page’s DM Sans and forest-green ink. No theme tokens supplied.', 'An opt-in theme. Paper, serif display type, soft edges and spectral detail.', 'Slots replace the row, switch, chassis and total. A real segmented display.'][index]}</p>
    </section>)}</div><footer className="preview-footer"><span>Independent stores · Scoped CSS · Replaceable parts</span><span>@prism-ui/react + @prism-ui/themes</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
