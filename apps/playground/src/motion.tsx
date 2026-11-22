import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Prism } from '@prism-ui/react';
import '@prism-ui/components/styles.css';
import { demoSource, type Demo } from './catalogue';
import { motionDemos as demos, motionRenderers } from './motion-demos';
import { createReplay } from './replay';
import { playgroundPlugins } from './plugins';
import './motion.css';

import.meta.glob(['../../../packages/components/src/*/*.css', '!../../../packages/components/src/styles/*.css'], { eager: true });

const query = new URLSearchParams(location.search);
const width = query.get('width') === '320' ? 320 : 760;
const mode = query.get('mode') === 'dark' ? 'dark' : 'light';
const instant = query.get('instant') === '1';
document.documentElement.dataset.mode = mode;
document.documentElement.dataset.width = String(width);

class ReplyBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <p role="alert">{this.state.error}</p> : this.props.children; }
}

function Reply({ demo, immediate }: { demo: Demo; immediate: boolean }) {
  const source = useMemo(() => demoSource(demo, `motion-${demo.id}`), [demo]);
  const [replay] = useState(() => createReplay(source, () => ({ chars: 6, delay: 16 }), () => {}));
  useEffect(() => () => replay.stop(), [replay]);
  return <ReplyBoundary><Prism source={immediate ? source : undefined} stream={immediate ? undefined : replay.stream} plugins={playgroundPlugins} renderers={motionRenderers} feedback={demo.id === 'feedback'} mode={mode} locale="en-US" /></ReplyBoundary>;
}

function Section({ demo, generation }: { demo: Demo; generation: number }) {
  const [local, setLocal] = useState(0);
  return <section data-demo={demo.id} aria-label={demo.label}>
    <header className="motion-label"><h2>{demo.label}</h2><button onClick={() => setLocal(value => value + 1)}>Replay</button></header>
    <Reply key={`${generation}-${local}`} demo={demo} immediate={instant && generation === 0 && local === 0} />
  </section>;
}

function Motion() {
  const [generation, setGeneration] = useState(0);
  const selected = demos.filter(demo => !query.has('only') || demo.id === query.get('only'));
  return <main className="motion-page" style={{ width }}>
    <div className="motion-toolbar"><button onClick={() => setGeneration(value => value + 1)}>Replay all</button></div>
    {selected.length ? selected.map(demo => <Section key={demo.id} demo={demo} generation={generation} />) : <p role="alert">Unknown demo: {query.get('only')}</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Motion />);
