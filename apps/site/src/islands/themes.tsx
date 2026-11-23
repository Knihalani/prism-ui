import { useEffect, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { Prism, createRegistry, type Theme } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { num, calc } from '@prism-ui/components/num';
import { pick } from '@prism-ui/components/pick';
import { chartDefinition } from '@prism-ui/components/chart';
import { tableDef } from '@prism-ui/components/table';
import { refraction } from '@prism-ui/themes/refraction';
import { instrument } from '@prism-ui/themes/instrument';
import { print } from '@prism-ui/themes/print';
import { objects } from '@prism-ui/themes/objects';
import '../preview-styles';

export const comparisonSource = [
  'Here’s a starting point for your team.', '',
  'With :num[12]{id=seats min=1 max=50 label="Team size"} people, budget **:calc[seats * 18]{format=currency decimals=0} per month**. Adjust the number to explore.', '',
  '```ui:pick',
  '{"id":"plan","question":"Choose your workspace","criteria":[{"id":"fit","label":"Team fit"}],"options":[{"id":"team","title":"Team","description":"Shared projects and room to grow.","scores":{"fit":0.95}},{"id":"starter","title":"Starter","description":"A lighter place to begin.","scores":{"fit":0.7}}]}',
  '```', '', '```ui:chart',
  '{"type":"bar","title":"Room to grow","x":"month","height":150,"series":[{"key":"people","label":"People"}],"data":[{"month":"Apr","people":8},{"month":"May","people":10},{"month":"Jun","people":12}]}',
  '```', '', 'Your first month, at a glance:', '',
  '| Included | Amount |', '| --- | ---: |', '| Seats | :calc[seats] |', '| Per seat | $18 |', '| Monthly | :calc[seats * 18]{format=currency decimals=0} |',
].join('\n');

const variants = [
  { name: 'Host', description: 'Quiet, native, yours.', theme: undefined },
  { name: 'Refraction', description: 'Editorial warmth and soft depth.', theme: refraction },
  { name: 'Instrument', description: 'Precise tools, visible evidence.', theme: instrument },
  { name: 'Print', description: 'Bold type and a paper sensibility.', theme: print },
  { name: 'Objects', description: 'Tactile, friendly, a little playful.', theme: objects },
];
const registry = createRegistry([num, calc, pick, chartDefinition, tableDef]);
const fontFamilies = ['Inter:wght@400;500;600&family=Instrument+Serif&family=JetBrains+Mono', 'IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono', 'Inter+Tight:wght@400;500;600;700;800;900&family=IBM+Plex+Mono', 'DM+Sans:wght@400;500;600&family=Caveat:wght@400;600'];

function Reply({ theme, mode, index }: { theme: Theme | undefined; mode: 'auto' | 'light' | 'dark'; index: number }) {
  const [store] = useState(() => createStore({ initial: { seats: 12 } }));
  const [, acknowledge] = useState('');
  return <Prism source={comparisonSource} registry={registry} store={store} theme={theme} mode={mode} scope={`comparison-${index}`} animate={false} onAction={action => acknowledge(action.message)} />;
}

export function Themes() {
  const [mode, setMode] = useState<'auto' | 'light' | 'dark'>('auto');
  useEffect(() => {
    for (const [i, family] of fontFamilies.entries()) {
      if (document.querySelector(`[data-comparison-font="${i}"]`)) continue;
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.comparisonFont = String(i); link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`; document.head.append(link);
    }
    document.querySelector('[data-island="themes"]')?.setAttribute('data-live', '');
  }, []);
  return <><div className="theme-controls"><p>Same reply. Different design languages.</p><label>Example mode <select aria-label="Comparison color mode" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="auto">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="theme-comparison">{variants.map((variant, index) => <section className="theme-column" key={variant.name} aria-labelledby={`theme-${index}`}><header><span className="eyebrow">0{index + 1}</span><h2 id={`theme-${index}`}>{variant.name}</h2><p>{variant.description}</p></header><Reply theme={variant.theme} mode={mode} index={index} /></section>)}</div></>;
}

export function mount(element: HTMLElement) { return hydrateRoot(element, <Themes />, { identifierPrefix: 'themes-' }); }
