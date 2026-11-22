import type { Store } from '@prism-ui/state';
import { SANDBOX } from '../mockup/engine/frame';
import type { HostPayload } from '../mockup/engine/protocol';
import { allowedPath } from './policy';
import { artifactDocument, markup, type FrameMessage, type HostMessage, type Render } from './runtime';

const pools = new WeakMap<Document, HTMLIFrameElement[]>();
const MAX_IDLE = 4;

function acquire(document: Document) {
  let pool = pools.get(document);
  if (!pool) pools.set(document, pool = []);
  const frame = pool.pop() ?? document.createElement('iframe');
  frame.setAttribute('sandbox', SANDBOX);
  frame.referrerPolicy = 'no-referrer';
  return {
    frame,
    release() {
      frame.remove();
      frame.removeAttribute('srcdoc');
      frame.removeAttribute('title');
      frame.removeAttribute('style');
      if (pool.length < MAX_IDLE) pool.push(frame);
    },
  };
}

type FrameEvents = {
  height(height: number): void;
  rendered(revision: number): void;
  error(error: string, revision: number): void;
  send(action: string, payload: unknown): void;
  exitFullscreen(): void;
};

function jsonValue(input: unknown): boolean {
  const stack = [{ value: input, depth: 0 }];
  let budget = 65_536;
  while (stack.length && budget > 0) {
    const { value, depth } = stack.pop()!;
    budget--;
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number' && Number.isFinite(value)) continue;
    if (typeof value === 'string') { budget -= value.length; continue; }
    if (typeof value !== 'object' || !value || depth >= 32 || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) return false;
    for (const key of Object.keys(value)) {
      budget -= key.length;
      if (budget < 0 || !allowedPath(key, [key])) return false;
      stack.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 });
    }
  }
  return budget > 0;
}

export function mountArtifactFrame(container: HTMLElement, imports: Record<string, string>, store: Store, grants: readonly string[], taskPath: string, events: FrameEvents) {
  const { ownerDocument: doc } = container;
  const win = doc.defaultView!;
  const id = `artifact-${globalThis.crypto.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))).join('-')}`;
  const { frame, release } = acquire(doc);
  const subscriptions = new Map<string, () => void>();
  let render: Render | undefined;
  let theme: Extract<HostMessage, { type: 'theme' }> | undefined;
  let maxHeight: number | undefined;
  let ready = false;
  let unsubscribeTasks: (() => void) | undefined;
  const post = (message: HostMessage) => frame.contentWindow?.postMessage({ ...message, ns: 'prism-artifact', id }, '*');
  const engine = (message: HostPayload) => frame.contentWindow?.postMessage({ ...message, ns: 'prism-mockup', id, v: 1 }, '*');
  const publish = (path: string) => post({ type: 'value', path, value: store.get(path) });
  const watch = (path: string) => {
    if (!subscriptions.has(path) && subscriptions.size < 128) subscriptions.set(path, store.subscribe(path, () => publish(path)));
  };
  const sendTheme = () => {
    if (theme) { engine({ type: 'config', theme: theme.tokens }); post(theme); }
  };
  const taskValues = (defaults: Record<string, boolean>) => {
    const saved = store.get(taskPath);
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
      key, saved && Object.hasOwn(saved, key) && typeof saved[key] === 'boolean' ? saved[key] : fallback,
    ]));
  };
  const publishTasks = () => {
    if (render?.tasks) post({ type: 'task-values', revision: render.revision, values: taskValues(render.tasks) });
  };
  const sendRender = () => {
    if (!render) return;
    if (markup(render.kind)) engine({ type: 'render', html: render.source, done: render.complete });
    const current = render.tasks ? { ...render, tasks: taskValues(render.tasks) } : render;
    post({ type: 'render', render: current, values: Object.fromEntries(grants.map(path => [path, store.get(path)])) });
  };
  const receive = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return;
    const data = event.data as (FrameMessage | { type: 'error'; message: string } | { type: 'ready' }) & { ns?: string; id?: string };
    if (!data || data.id !== id) return;
    if (data.ns === 'prism-mockup') {
      if (data.type === 'ready' && !ready) {
        ready = true;
        for (const path of grants) watch(path);
        post({ type: 'size-mode', maxHeight });
        sendTheme(); sendRender();
      } else if (data.type === 'error' && 'message' in data && typeof data.message === 'string') events.error(data.message, render?.revision ?? 0);
      return;
    }
    if (data.ns !== 'prism-artifact' || !ready) return;
    if (data.type === 'size' && Number.isFinite(data.height) && data.height >= 0) events.height(data.height);
    else if (data.type === 'rendered' && data.revision === render?.revision) events.rendered(data.revision);
    else if (data.type === 'error' && 'revision' in data && data.revision === render?.revision && typeof data.error === 'string') events.error(data.error, data.revision);
    else if (data.type === 'subscribe' && allowedPath(data.path, grants)) { watch(data.path); publish(data.path); }
    else if (data.type === 'unsubscribe' && !grants.includes(data.path)) { subscriptions.get(data.path)?.(); subscriptions.delete(data.path); }
    else if (data.type === 'set' && allowedPath(data.path, grants) && jsonValue(data.value)) store.set(data.path, data.value);
    else if (data.type === 'task-toggle' && render?.kind === 'markdown' && data.revision === render.revision &&
      render.tasks && typeof data.task === 'string' && Object.hasOwn(render.tasks, data.task) && typeof data.checked === 'boolean') {
      const path = `${taskPath}.${data.task}`, saved = store.get(path);
      if ((typeof saved === 'boolean' ? saved : render.tasks[data.task]) === data.checked) return;
      store.set(path, data.checked);
      events.send('toggle', { task: data.task, checked: data.checked });
    }
    else if (data.type === 'send' && typeof data.action === 'string' && /^[\w:-]{1,80}$/.test(data.action) && (data.payload === undefined || jsonValue(data.payload))) events.send(data.action, data.payload);
    else if (data.type === 'exitFullscreen') events.exitFullscreen();
  };
  win.addEventListener('message', receive);
  frame.srcdoc = artifactDocument(id, imports);
  container.append(frame);
  return {
    frame,
    render(value: Render) {
      render = value;
      if (value.tasks && !unsubscribeTasks) unsubscribeTasks = store.subscribe(taskPath, publishTasks);
      if (!value.tasks && unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = undefined; }
      if (ready) sendRender();
    },
    sizeMode(value: number | undefined) {
      if (maxHeight === value) return;
      maxHeight = value;
      if (ready) post({ type: 'size-mode', maxHeight });
    },
    theme(tokens: Record<string, string>, dark: boolean) { theme = { type: 'theme', tokens, dark }; if (ready) sendTheme(); },
    destroy() {
      win.removeEventListener('message', receive);
      unsubscribeTasks?.();
      for (const off of subscriptions.values()) off();
      release();
    },
  };
}
