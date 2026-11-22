import '../../../react/test/setup';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRegistry, Prism, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifact, artifactPlugin } from './index';
import { fence } from './fixtures';
import { allowedPath, importMap } from './policy';
import { sourceDiff } from './model';
import { markdownTaskPath, renderArtifactMarkdown } from './markdown';

afterEach(cleanup);
const plugins = [artifactPlugin], registry = createRegistry([artifact]);
const html = '<p>First version</p>';
const snippet = fence('html', 'title="Read-only report" id=report height=180px', html);

test('SSR and schemas expose usable artifact chrome and documented fence metadata', () => {
  const rendered = renderToStaticMarkup(<Prism source={snippet} plugins={plugins} registry={registry} />);
  expect(rendered).toContain('Read-only report');
  expect(rendered).toContain('min-height:180px');
  expect(rendered).not.toContain('<iframe');
  expect(registry.docs()).toContain('```artifact:html');
  expect(registry.docs()).toContain('fixed height in pixels');
});

test('streaming partial React source reserves its preview without a frame or compiler', () => {
  const partial = '```artifact:react {title="A calculator" height=267}\nexport default function A(';
  const view = render(<Prism source={partial} plugins={plugins} registry={registry} done={false} />);
  expect(view.getByRole('status', { name: 'Preparing preview' })).toBeDefined();
  expect(view.container.querySelector('iframe')).toBeNull();
  expect(view.container.querySelector<HTMLElement>('[data-part=preview]')?.style.minHeight).toBe('267px');
});

test('a partial same-id update keeps the previous artifact selected and announces progress', () => {
  const store = createStore();
  const ui = (source: string, done: boolean) => <Prism source={source} done={done} plugins={plugins} registry={registry} store={store} />;
  const view = render(ui(snippet, true));
  const partial = 'cue\n\n```artifact:html {title="Read-only report" id=report height=340}\n<p>Second';
  view.rerender(ui(partial, false));
  expect(view.getByText('Updating…').getAttribute('role')).toBe('status');
  expect(view.container.querySelector<HTMLElement>('[data-part=preview]')?.style.minHeight).toBe('180px');
  expect(view.container.querySelector('[data-part=preview]')?.getAttribute('aria-busy')).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Code' }));
  expect(view.getByLabelText('Artifact source').textContent).toBe(html);
  view.rerender(ui(partial + ' version</p>\n```\n', true));
  expect(view.queryByText('Updating…')).toBeNull();
  expect(view.getByLabelText('Artifact source').textContent).toBe('<p>Second version</p>');
});

function observeFrames() {
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  return () => { globalThis.IntersectionObserver = original; };
}

test('same-id revisions switch and show a line diff; controls are native keyboard controls', () => {
  const store = createStore(), options = { enabled: true };
  const ui = (source: string) => <ArtifactProvider options={options}><Prism source={source} plugins={plugins} registry={registry} store={store} /></ArtifactProvider>;
  const view = render(ui(snippet));
  view.rerender(ui(fence('html', 'title="Read-only report" id=report', '<p>Second version</p>')));
  const selector = view.getByRole('combobox', { name: 'Artifact version' }) as HTMLSelectElement;
  expect(selector.value).toBe('2');
  const diff = view.getByRole('button', { name: 'Changes' });
  diff.focus(); expect(document.activeElement).toBe(diff);
  fireEvent.click(diff);
  expect(view.getByLabelText('Source changes').textContent).toBe('− <p>First version</p>\n+ <p>Second version</p>\n');
  fireEvent.change(selector, { target: { value: '1' } });
  expect(view.getByLabelText('Artifact source').textContent).toBe(html);
  for (const name of ['Code', 'Copy', 'Download source']) {
    const button = view.getByRole('button', { name });
    expect(button.getAttribute('title')).toBe(name);
    expect(button.textContent).toBe('');
  }
  fireEvent.click(view.getByRole('button', { name: 'Code' }));
  expect(view.getByRole('button', { name: 'Preview' }).getAttribute('title')).toBe('Preview');
  fireEvent.click(view.getByRole('button', { name: 'Preview' }));
  expect(view.getByRole('button', { name: 'Download' }).getAttribute('title')).toBe('Download');
});

test('JavaScript preview downloads a runnable HTML document and Code downloads its raw source', async () => {
  const source = 'document.querySelector("#app").textContent = "Ready";';
  const downloads: { blob?: Blob; filename?: string }[] = [];
  const create = spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    if (blob instanceof Blob) downloads.push({ blob });
    return 'blob:artifact-test';
  });
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.at(-1)!.filename = this.download;
  });
  try {
    const view = render(<Prism source={fence('js', 'title="App demo"', source)} plugins={plugins} registry={registry} />);
    fireEvent.click(view.getByRole('button', { name: 'Download' }));
    fireEvent.click(view.getByRole('button', { name: 'Code' }));
    fireEvent.click(view.getByRole('button', { name: 'Download source' }));
    expect(downloads.map(download => download.filename)).toEqual(['app-demo.html', 'app-demo.js']);
    expect(await downloads[0]?.blob?.text()).toContain('type="importmap"');
    expect(await downloads[0]?.blob?.text()).toContain(JSON.stringify(source));
    expect(await downloads[1]?.blob?.text()).toBe(source);
  } finally { create.mockRestore(); click.mockRestore(); }
});

test('standalone HTML embeds the nearest resolved Prism tokens and active color scheme at download time', async () => {
  const create = spyOn(URL, 'createObjectURL').mockReturnValue('blob:artifact-theme-test');
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    const view = render(<Prism source={snippet} plugins={plugins} registry={registry} />);
    const viewport = view.container.querySelector<HTMLElement>('[data-part=viewport]')!;
    const scope = viewport.closest<HTMLElement>('.prism-root')!;
    scope.style.setProperty('--local-accent', '#93b0ff');
    viewport.style.colorScheme = 'dark';
    viewport.style.setProperty('--prism-accent', 'var(--local-accent)');
    viewport.style.setProperty('--prism-border', '#343d4b');
    viewport.style.setProperty('--prism-bg', '#14181f');
    viewport.style.setProperty('--prism-surface', '#1c222c');
    viewport.style.setProperty('--unrelated', 'not-exported');
    fireEvent.click(view.getByRole('button', { name: 'Download' }));
    viewport.style.colorScheme = 'light';
    scope.style.setProperty('--local-accent', '#3159c9');
    fireEvent.click(view.getByRole('button', { name: 'Download' }));
    const [dark, light] = await Promise.all(create.mock.calls.map(([blob]) => (blob as Blob).text()));
    expect(dark).toContain('"--prism-accent":"#93b0ff"');
    expect(dark).toContain('"--prism-border":"#343d4b"');
    expect(dark).toContain('"--prism-bg":"#14181f"');
    expect(dark).toContain('"--prism-surface":"#1c222c"');
    expect(dark).toContain('"dark":true');
    expect(dark).not.toContain('not-exported');
    expect(light).toContain('"--prism-accent":"#3159c9"');
    expect(light).toContain('"dark":false');
  } finally { create.mockRestore(); click.mockRestore(); }
});

test('frame messages are scoped by channel, opaque origin, and explicit store permissions', async () => {
  const store = createStore(), actions: Action[] = [];
  const restore = observeFrames();
  try {
    const view = render(<ArtifactProvider options={{ statePaths: ['budget'] }}>
      <Prism source={snippet} plugins={plugins} registry={registry} store={store} onAction={action => actions.push(action)} />
    </ArtifactProvider>);
    const frame = await waitFor(() => {
      const node = view.container.querySelector('iframe');
      if (!node) throw new Error('No frame');
      return node;
    });
    const id = frame.srcdoc.match(/artifact-[\da-f-]{36}/)![0];
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    const post = (data: object, ns = 'prism-artifact', origin = 'null') => window.dispatchEvent(new MessageEvent('message', {
      data: { ns, id, ...data }, origin, source: frame.contentWindow,
    }));
    act(() => {
      post({ type: 'ready' }, 'prism-mockup');
      post({ type: 'set', path: 'secret', value: 99 });
      post({ type: 'set', path: 'budget', value: 88 }, 'prism-artifact', location.origin);
      post({ type: 'set', path: 'budget', value: 42 });
      post({ type: 'send', action: 'choose', payload: { option: 'alpha' } });
      post({ type: 'error', error: 'Broken preview', revision: 1 });
    });
    expect(store.snapshot()).toEqual({ budget: 42 });
    fireEvent.click(view.getByRole('button', { name: 'Fix this' }));
    expect(actions.map(({ type, component, id, payload }) => ({ type, component, id, payload }))).toEqual([
      { type: 'choose', component: 'artifact', id: 'report', payload: { option: 'alpha' } },
      { type: 'fix', component: 'artifact', id: 'report', payload: { error: 'Broken preview', source: html, kind: 'html', version: 1 } },
    ]);
    const viewport = view.container.querySelector<HTMLElement>('[data-part=viewport]')!;
    act(() => post({ type: 'size', height: 320 }));
    expect(viewport.style.height).toBe('180px');
    const sent = spyOn(frame.contentWindow!, 'postMessage');
    try {
      view.rerender(<ArtifactProvider options={{ statePaths: ['budget'] }}>
        <Prism source={snippet.replace('height=180px', 'height=auto')} plugins={plugins} registry={registry} store={store} onAction={action => actions.push(action)} />
      </ArtifactProvider>);
      expect(sent).toHaveBeenCalledWith({ type: 'size-mode', maxHeight: 4096, ns: 'prism-artifact', id }, '*');
      expect(viewport.style.height).toBe('320px');
      act(() => post({ type: 'size', height: 4500 }));
      expect(viewport.style.height).toBe('4096px');
    } finally { sent.mockRestore(); }
    act(() => post({ type: 'rendered', revision: 1 }));
    view.rerender(<ArtifactProvider options={{ statePaths: ['budget'] }}>
      <Prism source={'```artifact:react {id=fresh height=180}\nexport default function App('} done={false} plugins={plugins} registry={registry} store={store} />
    </ArtifactProvider>);
    expect(view.getByRole('status', { name: 'Preparing preview' })).toBeDefined();
    expect(view.container.querySelector('iframe')).toBeNull();
  } finally { restore(); }
});

test('disabled artifacts do not mount frames; unstyled mode retains data parts', () => {
  const view = render(<ArtifactProvider options={{ enabled: false }}><Prism unstyled source={snippet} plugins={plugins} registry={registry} /></ArtifactProvider>);
  expect(view.getByText('Preview disabled')).toBeDefined();
  expect(view.container.querySelector('iframe')).toBeNull();
  expect(view.container.querySelector('[data-prism=artifact][data-part=root]')?.className).toBe('');
  expect(allowedPath('x.__proto__.test', ['x'])).toBe(false);
  expect(() => importMap({ x: 'data:text/javascript,11' }, 'https://app.test')).toThrow();
  expect(sourceDiff('one\ntwo\nlast', 'one\nnew\nlast').map(line => line.type)).toEqual(['same', 'delete', 'insert', 'same']);
});

test('Markdown artifact tasks wrap escaped inline content in labels without changing regular list items', () => {
  const { html, defaults } = renderArtifactMarkdown('- [x] **Reviewed**\n- [ ] Publish <copy>\n- Keep the original');
  const [first, second] = Object.keys(defaults);
  expect(html).toContain(`<li data-task data-key="${first}"><label><input type="checkbox" data-task-key="${first}" checked><span><strong>Reviewed</strong></span></label></li>`);
  expect(html).toContain(`<li data-task data-key="${second}"><label><input type="checkbox" data-task-key="${second}"><span>Publish &lt;copy&gt;</span></label></li>`);
  expect(html).toContain('<li><p>Keep the original</p></li>');
  expect(renderArtifactMarkdown('- [ ] New task\n- [ ] Reviewed').defaults).toHaveProperty(first!, false);
});

test('Markdown frame toggles are scoped to the current tasks and use shared undo and action context', async () => {
  const store = createStore(), actions: Action[] = [];
  const source = '- [x] Reviewed\n- [ ] Publish';
  const [task] = Object.keys(renderArtifactMarkdown(source).defaults);
  const path = `${markdownTaskPath('launch')}.${task}`;
  const restore = observeFrames();
  try {
    const view = render(<Prism source={fence('markdown', 'id=launch', source)} plugins={plugins} registry={registry} store={store} onAction={action => actions.push(action)} />);
    const frame = await waitFor(() => {
      const node = view.container.querySelector('iframe');
      expect(node?.contentWindow).toBeTruthy();
      return node!;
    });
    const id = frame.srcdoc.match(/artifact-[a-f0-9-]+/)![0];
    const sent = spyOn(frame.contentWindow!, 'postMessage');
    const post = (ns: string, data: object) => act(() => window.dispatchEvent(new MessageEvent('message', {
      data: { ...data, ns, id }, origin: 'null', source: frame.contentWindow,
    })));
    try {
      post('prism-mockup', { type: 'ready' });
      const message = sent.mock.calls.map(([value]) => value).find(value => value.type === 'render' && value.ns === 'prism-artifact');
      const { revision } = message.render;
      const toggle = { type: 'task-toggle', revision, task, checked: false };
      expect(store.canUndo()).toBe(false);
      post('prism-artifact', { ...toggle, revision: revision - 1 });
      post('prism-artifact', { ...toggle, task: 'unknown' });
      expect(actions).toHaveLength(0);
      post('prism-artifact', toggle);
      expect(store.get(path)).toBe(false);
      expect(actions).toEqual([expect.objectContaining({
        type: 'toggle', component: 'artifact', id: 'launch', payload: { task, checked: false },
        context: expect.objectContaining({ state: { markdownTasks: { [task!]: false } } }), message: expect.any(String),
      })]);
      fireEvent.click(view.getByRole('button', { name: 'Undo' }));
      expect(store.get(path)).toBeUndefined();
      expect(sent).toHaveBeenLastCalledWith(expect.objectContaining({
        type: 'task-values', revision, values: expect.objectContaining({ [task!]: true }),
      }), '*');
      act(() => store.redo());
      expect(store.get(path)).toBe(false);
      expect(actions).toHaveLength(1);
    } finally { sent.mockRestore(); }
  } finally { restore(); }
});
