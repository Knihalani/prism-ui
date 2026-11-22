import { componentStrings } from '../strings';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStrings, Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { num } from '../num';
import '../num/num.css';
import '../styles/styles.css';
import './artifact.css';
import { ArtifactProvider, artifact, artifactPlugin, defaultArtifactImports } from './index';
import { calculator, fence, fixtureSources } from './fixtures';

const store = createStore();
const query = new URLSearchParams(location.search);
const vendor = query.has('vendor');
const options = {
  statePaths: ['monthlyBudget'],
  ...(vendor ? {
    imports: Object.fromEntries(Object.entries(defaultArtifactImports).map(([name, url]) => [name, location.origin + new URL(url).pathname])),
    compilerUrl: location.origin + '/sucrase@3.35.0/es2022/sucrase.bundle.mjs',
  } : {}),
};
const plugins = [artifactPlugin];
const registry = createRegistry([artifact, num]);
const bench = query.has('bench');
const calculatorFence = fixtureSources[0].replace(' id=loan', '');
const partial = (fence: string) => fence.slice(0, fence.indexOf('\n') + 201);
const revision = fence('react', 'title="Loan calculator" id=loan height=290', calculator.replace('24000', '28000').replace('6.5% APR', '6.5% fixed APR'));
const broken = fence('react', 'title="Preview error" id=broken height=210', 'export default function Preview() { throw new Error("Rates service is unavailable"); }');
const full = fixtureSources.join('\n');
type Harness = { actions: Action[]; stream(): void; close(): void; version(): void; demo(): void; error(): void; clear(): void };
const harnessWindow = window as Window & { harness?: Harness };
const actions: Action[] = [];

function HarnessView() {
  const themeStrings = useStrings('artifact', componentStrings.artifact);
  const [theme, setTheme] = useState<'light' | 'dark'>(query.get('theme') === 'dark' ? 'dark' : 'light');
  const [show, setShow] = useState(true);
  const [src, setSrc] = useState({ source: bench ? partial(calculatorFence) : full, done: !bench });
  const sequence = useRef(0), pending = useRef(calculatorFence);
  const begin = (source: string) => { pending.current = source; setShow(true); setSrc({ source: partial(source), done: false }); };
  const stream = () => begin(bench ? calculatorFence : fixtureSources[0].replace('id=loan', `id=stream-loan-${++sequence.current}`));
  const close = () => setSrc({ source: pending.current, done: false });
  const version = () => { setShow(true); setSrc({ source: revision, done: true }); };
  const demo = () => { setShow(true); setSrc({ source: full, done: true }); };
  const error = () => { setShow(true); setSrc({ source: broken, done: true }); };
  useEffect(() => { harnessWindow.harness = { actions, stream, close, version, demo, error, clear: () => setShow(false) }; });
  return <div className="harness-page" data-prism-theme={theme}>
    <header className="harness-header">
      <h1>{themeStrings.inlineArtifacts}</h1>
      <nav aria-label={themeStrings.harness}>
        <button onClick={demo}>{themeStrings.gallery}</button><button onClick={stream}>{themeStrings.stream}</button><button onClick={close}>{themeStrings.finish}</button>
        <button onClick={() => begin(revision)}>{themeStrings.streamUpdate}</button><button onClick={version}>{themeStrings.version2}</button><button onClick={error}>{themeStrings.error}</button>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? themeStrings.dark : themeStrings.light}</button>
      </nav>
    </header>
    {show && <ArtifactProvider options={options}>
      <Prism {...src} store={store} theme={theme} plugins={plugins} registry={registry} onAction={action => actions.push(action)} />
    </ArtifactProvider>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<HarnessView />);
