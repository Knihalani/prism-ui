import React, { useState, type InputHTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism } from '@prism-ui/react';
import '@prism-ui/components';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/codeblock.css';
import '@prism-ui/components/datatable.css';
import '@prism-ui/components/callout.css';
import '@prism-ui/components/tabs.css';
import '@prism-ui/components/card.css';
import '@prism-ui/components/badge.css';
import '@prism-ui/components/grid.css';
import '../../src/lib/highlight/highlight.css';
import { AdviceExample, ChecklistPanel, CodeActions } from './controls';
import { samples } from './samples';
import './example.css';

function TeamFilter({ as: _as, ...attrs }: InputHTMLAttributes<HTMLInputElement> & { as?: string }) {
  return <input {...attrs} aria-label="Filter teams" placeholder="Find a team…" />;
}

type Sample = keyof typeof samples;
const names: Record<Sample, string> = {
  'code-block': 'Code block',
  'data-table': 'Data table',
  callout: 'Callout',
  tabs: 'Tabs',
  'card-grid': 'Cards & badges',
};
const components = { callout: AdviceExample };
const omitAsk = () => null;
const slots = {
  callout: { ask: omitAsk },
  tabs: { body: ChecklistPanel },
  codeblock: { actions: CodeActions, ask: omitAsk },
  datatable: { filter: TeamFilter },
};
const acceptAction = () => {};

async function* replay(source: string) {
  for (let start = 0; start < source.length; start += 11) {
    await new Promise(resolve => setTimeout(resolve, 65));
    yield source.slice(start, start + 11);
  }
}

function App() {
  const [sample, setSample] = useState<Sample>('code-block');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [stream, setStream] = useState<AsyncIterable<string>>();
  const [revision, setRevision] = useState(0);
  return <main data-fixture-theme={theme}>
    <div className="example-controls">
      <nav aria-label="Comparison samples">
        {(Object.keys(names) as Sample[]).map(key => <button key={key} type="button" aria-pressed={sample === key}
          onClick={() => { setSample(key); setStream(undefined); setRevision(value => value + 1); }}>{names[key]}</button>)}
      </nav>
      <button type="button" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
      <button type="button" onClick={() => { setStream(replay(samples[sample])); setRevision(value => value + 1); }}>Replay fixture</button>
    </div>
    <article aria-label="Package reply" data-example={sample}>
      <Prism key={revision} theme={theme} locale="en-US" components={components} slots={slots}
        source={stream ? undefined : samples[sample]} stream={stream} onAction={acceptAction} />
    </article>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
