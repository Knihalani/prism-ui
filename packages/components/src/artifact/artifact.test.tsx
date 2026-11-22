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
import { renderArtifactMarkdown } from './markdown';

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
  for (const name of ['Code', 'Copy', 'Download']) {
    const button = view.getByRole('button', { name });
    expect(button.getAttribute('title')).toBe(name);
    expect(button.textContent).toBe('');
  }
  fireEvent.click(view.getByRole('button', { name: 'Code' }));
  expect(view.getByRole('button', { name: 'Preview' }).getAttribute('title')).toBe('Preview');
});

test('frame messages are scoped by channel, opaque origin, and explicit store permissions', async () => {
  const store = createStore(), actions: Action[] = [];
  const Observer = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
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
  } finally { globalThis.IntersectionObserver = Observer; }
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
  const html = renderArtifactMarkdown('- [x] **Reviewed**\n- [ ] Publish <copy>\n- Keep the original');
  expect(html).toContain('<li data-task><label><input type="checkbox" disabled checked><span><strong>Reviewed</strong></span></label></li>');
  expect(html).toContain('<li data-task><label><input type="checkbox" disabled><span>Publish &lt;copy&gt;</span></label></li>');
  expect(html).toContain('<li><p>Keep the original</p></li>');
});
