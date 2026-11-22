import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineTheme, type Action, type Slots } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifact, artifactPlugin, createFeedback, frameParts, mockupDefinition, mockupPlugin, view } from '../src';

afterEach(cleanup);
const plugins = [mockupPlugin, artifactPlugin];
const fence = (name: string, props: unknown) => '~~~ui:' + name + '\n' + JSON.stringify(props) + '\n~~~';
const review = fence('mockup', { id: 'review', title: 'Design', kind: 'svg', source: '<svg viewBox="0 0 100 60"><rect width="100" height="60"/></svg>' });
const firstArtifact = '~~~artifact:html {id=report title=Report height=180}\n<p>First</p>\n~~~';
const nextArtifact = firstArtifact.replace('First', 'Second');

function seeded(sent = false) {
  const feedback = createFeedback({ id: () => 'pin', now: () => 1 });
  feedback.addPin({ x: 30, y: 30, comment: 'Give this room' });
  return createStore({ initial: { review: { feedback: feedback.toJSON(), submitted: sent } } });
}
function more(view: ReturnType<typeof render>) {
  const trigger = view.queryByRole('button', { name: 'More tools' });
  if (trigger?.getAttribute('aria-expanded') === 'false') fireEvent.click(trigger);
}

test('mockup conditional fixtures replace parts with models, handlers and accessibility intact', () => {
  const original = globalThis.IntersectionObserver;
  Object.assign(globalThis, { IntersectionObserver: undefined });
  try {
    const covered = new Set<string>();
    for (const state of ['empty', 'comments', 'popover', 'sent', 'source'] as const) {
      const setup = (slots: Slots = {}) => {
        const rendered = render(<Prism source={review} store={state === 'empty' ? createStore() : seeded(state === 'sent')} slots={slots} animate={false} />);
        if (state === 'popover') {
          const marker = rendered.container.querySelector<HTMLElement>('[data-part="marker"]');
          if (marker) fireEvent.click(marker);
        }
        if (state === 'source') {
          more(rendered);
          const button = rendered.queryByRole('button', { name: 'View source' });
          if (button) fireEvent.click(button);
        }
        return rendered;
      };
      const baseline = setup();
      const tags = new Map(Array.from(baseline.container.querySelectorAll('[data-prism="mockup"][data-part]')).map(node => [node.getAttribute('data-part')!, node.tagName.toLowerCase()]));
      cleanup();
      for (const [part, tag] of tags) {
        expect(mockupDefinition.parts).toContain(part);
        function Marker({ as, model, frame, overflow, item, children, ...props }: any) {
          expect(model, part + ' model').toBeDefined();
          return createElement(as ?? tag, { ...props, 'data-replaced': part }, children);
        }
        const rendered = setup({ mockup: { [part]: Marker } });
        expect(rendered.container.querySelector('[data-replaced="' + part + '"]'), part).not.toBeNull();
        covered.add(part); cleanup();
      }
    }
    for (const part of ['marker', 'item', 'popover', 'sourceCode', 'overflowTrigger', 'feedbackFooter', 'empty', 'ask']) expect(covered.has(part), part).toBe(true);
  } finally { Object.assign(globalThis, { IntersectionObserver: original }); }
});

test('theme strings beat mockup props, icons replace, and an accessible custom canvas preserves ref and keyboard behavior', () => {
  const original = globalThis.IntersectionObserver;
  Object.assign(globalThis, { IntersectionObserver: undefined });
  const actions: Action[] = [];
  let canvas: HTMLElement | null = null;
  const theme = defineTheme({ name: 'create-localized', icons: { plus: props => <svg {...props} data-custom-plus="" /> }, components: { mockup: { strings: { title: 'Studio', zoomIn: 'Closer', placeholder: 'A note', save: 'Keep', submit: 'Review', sentOne: 'Recorded {n}', editFeedback: 'Revise', feedbackHeading: 'Notes{title}{details}:' } }, frame: { strings: { askLabel: 'Discuss' } } } });
  function Canvas({ as, model, ref, ...props }: any) {
    expect(model.feedback).toBeDefined();
    return <div {...props} ref={node => { canvas = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} />;
  }
  try {
    const rendered = render(<Prism source={review} theme={theme} animate={false} slots={{ mockup: { canvas: Canvas } }} onAction={action => actions.push(action)} />);
    expect(rendered.getByRole('group', { name: 'Studio' })).toBeDefined();
    expect(rendered.getByRole('button', { name: 'Closer' }).querySelector('[data-custom-plus]')).not.toBeNull();
    expect(rendered.getByRole('button', { name: 'Discuss' })).toBeDefined();
    fireEvent.keyDown(canvas!, { key: 'Enter' });
    const input = rendered.getByRole('textbox', { name: 'A note' });
    act(() => input.focus()); fireEvent.change(input, { target: { value: 'More space' } }); fireEvent.keyUp(input);
    fireEvent.click(rendered.getByRole('button', { name: 'Keep' }));
    fireEvent.click(rendered.getByRole('button', { name: 'Review' }));
    expect(actions[0].message.startsWith('Notes')).toBe(true);
    expect(rendered.getByText('Recorded 1')).toBeDefined();
    expect(rendered.container.querySelector('[data-part="member"]')?.getAttribute('data-state')).toBe('sent');
    fireEvent.click(rendered.getByRole('button', { name: 'Revise' }));
    expect(rendered.getByRole('button', { name: 'Review' })).toBeDefined();
  } finally { Object.assign(globalThis, { IntersectionObserver: original }); }
});

test('overflow is keyboard reachable, Escape closes it and restores focus through a typed frame slot', () => {
  function Trigger({ as, model, overflow, ...props }: any) { expect(overflow.close).toBeFunction(); return <button {...props} />; }
  const rendered = render(<Prism source={review} plugins={plugins} slots={{ frame: { overflowTrigger: Trigger } }} animate={false} />);
  const trigger = rendered.getByRole('button', { name: 'More tools' });
  expect(frameParts).toContain('overflowTrigger');
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const code = rendered.getByRole('button', { name: 'View source' });
  act(() => code.focus()); fireEvent.keyDown(code, { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  expect(rendered.queryByRole('button', { name: 'View source' })).toBeNull();
});

test('artifact error, code, diff and version fixtures expose declared slots and localized errors', () => {
  const original = globalThis.IntersectionObserver;
  Object.assign(globalThis, { IntersectionObserver: undefined });
  const seen = new Set<string>();
  try {
    for (const state of ['error', 'code', 'diff'] as const) {
      const setup = (slots: Slots = {}) => {
        const store = createStore();
        const ui = (source: string) => <ArtifactProvider options={{ enabled: true }}><Prism source={source} store={store} plugins={plugins} slots={slots} animate={false} /></ArtifactProvider>;
        const rendered = render(ui(firstArtifact));
        const prepare = () => {
          if (state === 'error') {
            const frame = rendered.container.querySelector('iframe');
            const id = frame?.srcdoc.match(/artifact-[\da-f-]{36}/)?.[0];
            if (frame && id) act(() => { window.dispatchEvent(new MessageEvent('message', { data: { ns: 'prism-mockup', id, type: 'ready' }, origin: 'null', source: frame.contentWindow })); for (const revision of [1, 2, 3]) window.dispatchEvent(new MessageEvent('message', { data: { ns: 'prism-artifact', id, type: 'error', error: 'Broken preview', revision }, origin: 'null', source: frame.contentWindow })); });
          } else {
            if (state === 'diff') rendered.rerender(ui(nextArtifact));
            more(rendered);
            const button = rendered.queryByRole('button', { name: state === 'diff' ? 'Changes' : 'Code' });
            if (button) fireEvent.click(button);
          }
        };
        prepare();
        return rendered;
      };
      const baseline = setup();
      const tags = new Map(Array.from(baseline.container.querySelectorAll('[data-prism="artifact"][data-part]')).map(node => [node.getAttribute('data-part')!, node.tagName.toLowerCase()]));
      cleanup();
      for (const [part, tag] of tags) {
        expect(artifact.parts).toContain(part);
        function Marker({ as, model, frame, overflow, children, ...props }: any) {
          expect(model.selected).toBeDefined();
          return createElement(as ?? tag, { ...props, 'data-replaced': part }, children);
        }
        const rendered = setup({ artifact: { [part]: Marker } });
        expect(rendered.container.querySelector('[data-replaced="' + part + '"]'), part).not.toBeNull();
        seen.add(part); cleanup();
      }
    }
    for (const part of ['error', 'error-message', 'fix', 'source', 'code', 'diff-line', 'version', 'undo', 'ask']) expect(seen.has(part), part).toBe(true);
  } finally { Object.assign(globalThis, { IntersectionObserver: original }); }
});

test('artifact strings, notices, title and icons are themed and custom controls retain the headless model', async () => {
  let model: any;
  const theme = defineTheme({ name: 'artifact-localized', icons: { code: props => <svg {...props} data-custom-code="" /> }, components: { artifact: { strings: { title: 'Document', code: 'Inspect', clipboardUnavailable: 'Cannot copy' } } } });
  function Controls({ as, model: value, ...props }: any) { model = value; return <div {...props}><button onClick={value.copy}>Try clipboard</button></div>; }
  const rendered = render(<Prism source={firstArtifact} plugins={plugins} theme={theme} slots={{ artifact: { controls: Controls } }} animate={false} />);
  expect(rendered.getByRole('group', { name: 'Document' })).toBeDefined();
  expect(model.selected.source).toContain('First');
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error()) } });
  try {
    await act(async () => { fireEvent.click(rendered.getByText('Try clipboard')); });
    expect(rendered.getByText('Cannot copy').getAttribute('role')).toBe('status');
  } finally { if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard); else delete (navigator as any).clipboard; }
  rendered.unmount();
  const icons = render(<Prism source={firstArtifact} plugins={plugins} theme={theme} animate={false} />);
  more(icons);
  expect(icons.getByRole('button', { name: 'Inspect' }).querySelector('[data-custom-code]')).not.toBeNull();
});

test('view primitive replacements receive the whole view model and preserve control semantics and refs', () => {
  const source = fence('view', { id: 'form', title: 'Settings', state: { name: 'Ada' }, children: [{ type: 'heading', text: 'Hello', icon: 'plus' }, { type: 'input', label: 'Name', value: { $bind: 'name' } }, { type: 'list', each: 'missing', item: { type: 'text', text: 'x' }, empty: 'Prop empty' }] });
  const theme = defineTheme({ name: 'view-localized', icons: { plus: props => <svg {...props} data-view-plus="" /> }, components: { view: { strings: { title: 'Preferences', empty: 'No entries', askMessage: 'Explain these preferences' } }, frame: { strings: { askLabel: 'Discuss', undoLabel: 'Revert' } } } });
  const actions: Action[] = [], store = createStore();
  function Control({ as, model, primitive, ...props }: any) {
    expect(model.runtime.model).toBe(model); expect(primitive.bound).toBe('form.name');
    return createElement(as, { ...props, 'data-custom-control': '' });
  }
  const rendered = render(<Prism source={source} theme={theme} store={store} slots={{ view: { control: Control } }} animate={false} onAction={action => actions.push(action)} />);
  expect(rendered.getByRole('group', { name: 'Preferences' })).toBeDefined();
  expect(rendered.getByText('No entries')).toBeDefined();
  expect(rendered.container.querySelector('[data-view-plus]')).not.toBeNull();
  const input = rendered.getByRole('textbox', { name: 'Name' });
  act(() => input.focus()); fireEvent.change(input, { target: { value: 'Grace' } }); fireEvent.keyUp(input);
  expect(store.get('form.name')).toBe('Grace');
  fireEvent.click(rendered.getByRole('button', { name: 'Revert' }));
  expect(store.get('form.name')).toBe('Ada');
  fireEvent.click(rendered.getByRole('button', { name: 'Discuss' }));
  expect(actions.at(-1)?.message).toBe('Explain these preferences');
  for (const element of Array.from(rendered.container.querySelectorAll('[data-prism="view"][data-part]'))) expect(view.parts).toContain(element.getAttribute('data-part')!);
});
