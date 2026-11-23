import { createRoot } from 'react-dom/client';
import '@prism-ui/components/styles.css';
import '../src/app.css';
import { App } from '../src/App';
import { kitchen, demoSource } from '../src/catalogue';
import type { Agent } from '../src/agent/types';

import.meta.glob(['../../../packages/components/src/*/*.css', '!../../../packages/components/src/styles/*.css'], { eager: true });
const source = demoSource(kitchen, 'perf');
const replay = { sourceLength: source.length, chunks: 0, done: false, chunkSize: 16 };
Object.assign(window, { __perfReplay: replay });
const agent: Agent = {
  id: 'perf-replay', label: 'Performance replay',
  async *respond(_input, signal) {
    performance.mark('perf-send');
    for (let offset = 0; offset < source.length; offset += replay.chunkSize) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      signal.throwIfAborted();
      replay.chunks++;
      yield { type: 'text', delta: source.slice(offset, offset + replay.chunkSize) };
    }
    replay.done = true;
    performance.mark('perf-done');
  },
};
createRoot(document.getElementById('root')!).render(<App agentFactory={() => agent} />);
