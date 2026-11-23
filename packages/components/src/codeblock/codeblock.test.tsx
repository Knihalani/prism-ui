import './setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { CodeBlock, CodeBlockHighlighterContext, codeBlockDefinition, setHighlighter } from './index';
import { defineLanguage, getLanguage, registerLanguage } from '../lib/highlight';

test('empty and long command scroll areas are keyboard-focusable', () => {
  for (const code of ['', 'console.log("long command");'.repeat(30)]) {
    const view = render(<Prism registry={createRegistry([codeBlockDefinition])} source={'```ui:code\n' + JSON.stringify({ code }) + '\n```'} />);
    expect(view.container.querySelector('[data-part="body"]')?.getAttribute('tabindex')).toBe('0');
    view.unmount();
  }
});

afterEach(() => { cleanup(); setHighlighter(); });
const registry = createRegistry([codeBlockDefinition]);
const fence = (code: string, info = 'ts') => `\`\`\`${info}\n${code}\n\`\`\``;

test('collapsed unwrapped previews retain horizontal scrolling across expand and collapse', () => {
  const view = render(<Prism registry={registry} source={'```ui:code\n' + JSON.stringify({ code: 'x'.repeat(500) + '\nline two\nline three', collapseAfter: 2 }) + '\n```'} />);
  const body = view.container.querySelector<HTMLElement>('[data-part="body"]')!;
  expect(body.style.overflowX).toBe('auto'); expect(body.style.overflowY).toBe('hidden');
  fireEvent.click(view.getByRole('button', { name: 'Show all 3 lines' }));
  expect(body.style.overflowX).toBe('auto');
  fireEvent.click(view.getByRole('button', { name: 'Show less' }));
  expect(body.style.overflowX).toBe('auto'); expect(body.style.overflowY).toBe('hidden');
});

test('static registry render, metadata, empty and escaped unknown languages', () => {
  const view = render(<Prism registry={registry} source={fence('const x = 1;', 'ts {lines title="file.ts"}')} />);
  expect(view.getByRole('region').getAttribute('aria-label')).toBe('file.ts');
  expect(view.container.querySelector('[data-part="body"]')?.getAttribute('tabindex')).toBe('0');
  expect(view.container.querySelector('.prism-tok-keyword')?.textContent).toBe('const');
  expect(view.container.querySelector('[data-part="gutter"]')?.textContent).toBe('1');
  view.rerender(<Prism registry={registry} source={fence('<script>alert(1)</script>', 'unknown')} />);
  expect(view.container.querySelector('script')).toBeNull();
  expect(view.container.querySelector('code')?.textContent).toContain('<script>');
  view.rerender(<Prism registry={registry} source={fence('')} />);
  expect(view.getByRole('button', { name: 'Copy code' })).toBeTruthy();
});

test('streaming grows code without replacing header or collapsing at threshold; frozen blocks stay cached', () => {
  const calls: string[] = [];
  setHighlighter({ supports: () => true, highlight: code => { calls.push(code); return code; } });
  let source = '```ts\nconst a = 1;\n';
  const view = render(<Prism registry={registry} source={source} done={false} />);
  const header = view.container.querySelector('[data-part="header"]');
  source += 'x\n'.repeat(25);
  view.rerender(<Prism registry={registry} source={source} done={false} />);
  expect(view.container.querySelector('[data-part="header"]')).toBe(header);
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBeGreaterThan(20);
  expect(view.queryByText(/Show all/)).toBeNull();
  source += '```\n\nTail';
  view.rerender(<Prism registry={registry} source={source} done={false} />);
  const before = calls.length;
  view.rerender(<Prism registry={registry} source={source + ' more'} done={false} />);
  expect(calls.length).toBe(before);
});

test('copy emits exact structured payload and announces success', async () => {
  const actions: Action[] = [], copied: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
  try {
    const view = render(<Prism scope="test" registry={registry} source={fence('a\nb', 'js')} onAction={action => actions.push(action)} />);
    fireEvent.click(view.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(actions.length).toBe(1));
    expect(copied).toEqual(['a\nb']);
    expect(actions[0]).toEqual({ type: 'copy', component: 'code', id: 'test:code:0', payload: { lang: 'js', lines: 2 },
      context: { component: 'code', props: {}, state: { wrap: false, expanded: false } },
      message: 'User copy in code: {"lang":"js","lines":2}' });
    expect(view.getByRole('status').textContent).toBe('Copied');
    await waitFor(() => expect(view.getByRole('status').textContent).toBe(''), { timeout: 2000 });
  } finally { if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

test('built-in incremental path only scans appended tail lines', () => {
  const scanned: string[] = [];
  const original = getLanguage('ts')!;
  registerLanguage('ts', defineLanguage('ts', () => null, (line, state, emit) => {
    scanned.push(line); emit('keyword', line); return state;
  }));
  try {
  const source = '```ts\nfrozen\ntail';
  const view = render(<Prism registry={registry} source={source} done={false} />);
  const frozenScans = scanned.filter(line => line === 'frozen\n').length;
  view.rerender(<Prism registry={registry} source={source + ' grows'} done={false} />);
  expect(scanned.filter(line => line === 'frozen\n').length).toBe(frozenScans);
  expect(scanned.at(-1)).toBe('tail grows');
  expect(view.container.querySelector('code')?.textContent).toContain('tail grows');
  } finally { registerLanguage('ts', original); }
});

test('meta wrap and collapse=false keep long blocks expanded', () => {
  const view = render(<Prism registry={registry} source={fence('x\n'.repeat(22), 'txt {wrap collapse=false filename="notes.txt"}')} />);
  expect(view.getByRole('region').getAttribute('aria-label')).toBe('notes.txt');
  expect(view.getByRole('button', { name: 'Wrap lines' }).getAttribute('aria-pressed')).toBe('true');
  expect(view.queryByText(/Show all/)).toBeNull();
});

test('diff metadata stays neutral and change prefixes only appear once in the gutter', () => {
  const view = render(<Prism registry={registry} source={fence('--- old\n+++ new\n@@ -1 +1 @@\n-removed\n+added', 'diff')} />);
  const lines = view.container.querySelectorAll('[data-part="line"]');
  expect(lines[0].getAttribute('data-state')).toBeNull();
  expect(lines[1].getAttribute('data-state')).toBeNull();
  expect(lines[2].getAttribute('data-state')).toBeNull();
  expect(lines[3].querySelector('[data-part="content"]')?.textContent).toBe('removed');
  expect(lines[4].querySelector('[data-part="content"]')?.textContent).toBe('added');
});

test('streaming long blocks cap the body, retain all tail lines, and reserve the collapse footer', () => {
  const code = Array.from({ length: 31 }, (_, index) => `const n${index} = ${index};`).join('\n');
  const view = render(<Prism registry={registry} source={'```ts\n' + code} done={false} />);
  const body = view.container.querySelector('[data-part="body"]') as HTMLElement;
  expect(body.style.getPropertyValue('--prism-codeblock-visible-lines')).toBe('20');
  expect(body.getAttribute('data-tail')).toBe('true');
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(31);
  expect((view.getByRole('button', { name: 'Streaming…' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<Prism registry={registry} source={fence(code)} />);
  expect(body.style.getPropertyValue('--prism-codeblock-visible-lines')).toBe('20');
  expect(body.getAttribute('data-tail')).toBeNull();
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(20);
  expect(view.getByRole('button', { name: 'Show all 31 lines' })).toBeTruthy();
});

test('clipboard fallback cleans up and reports failure without action', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard'), exec = document.execCommand;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied'); } } });
  const actions: Action[] = [];
  try {
    document.execCommand = () => false;
    const view = render(<Prism registry={registry} source={fence('x')} onAction={a => actions.push(a)} />);
    fireEvent.click(view.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(view.getByRole('status').textContent).toBe('Copy failed'));
    expect(document.querySelector('textarea')).toBeNull(); expect(actions).toEqual([]);
    document.execCommand = () => true;
    fireEvent.click(view.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(actions.length).toBe(1));
  } finally { document.execCommand = exec; if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

test('diff states, configurable collapse and native keyboard-accessible controls', () => {
  const view = render(<Prism registry={registry} source={'```ui:code\n' + JSON.stringify({ code: '+added\n-removed\n same', lang: 'diff', collapseAfter: 2 }) + '\n```'} />);
  expect(view.container.querySelector('[data-state="inserted"]')).toBeTruthy();
  expect(view.container.querySelector('[data-state="deleted"]')).toBeTruthy();
  const wrap = view.getByRole('button', { name: 'Wrap lines' });
  const collapse = view.getByRole('button', { name: 'Show all 3 lines' });
  expect(wrap.tagName).toBe('BUTTON'); expect(wrap.tabIndex).toBe(0); expect(collapse.tabIndex).toBe(0);
  wrap.focus(); expect(document.activeElement).toBe(wrap);
  fireEvent.keyDown(wrap, { key: 'Enter' }); fireEvent.click(wrap);
  expect(wrap.getAttribute('aria-pressed')).toBe('true');
  collapse.focus(); fireEvent.keyDown(collapse, { key: ' ' }); fireEvent.click(collapse);
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(3);
  fireEvent.click(view.getByRole('button', { name: 'Show less' }));
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(2);
});

test('context and prop highlighters, throwing backend, unstyled parts and slots', () => {
  const source = fence('hello');
  const view = render(<CodeBlockHighlighterContext.Provider value={code => `<b>${code}</b>`}><Prism registry={registry} source={source} /></CodeBlockHighlighterContext.Provider>);
  expect(view.container.querySelector('code b')?.textContent).toBe('hello');
  const customRegistry = createRegistry([{ ...codeBlockDefinition, component: args => <CodeBlock {...args} props={{ ...args.props, highlighter: code => `<i>${code}</i>` }} /> }]);
  view.rerender(<Prism registry={customRegistry} source={source} />);
  expect(view.container.querySelector('code i')?.textContent).toBe('hello');
  view.rerender(<CodeBlockHighlighterContext.Provider value={() => { throw Error('backend'); }}><Prism registry={registry} source={source} /></CodeBlockHighlighterContext.Provider>);
  expect(view.container.querySelector('code')?.textContent).toBe('hello');
  view.rerender(<Prism registry={registry} source={source} unstyled classNames={{ codeblock: { header: 'custom' } }} styles={{ codeblock: { header: { opacity: .5 } } }} slots={{ codeblock: { label: props => <strong {...props} /> } }} />);
  expect(view.container.querySelector('[class*="prism-codeblock"]')).toBeNull();
  expect(view.container.querySelector('.custom')?.getAttribute('style')).toContain('0.5');
  expect(view.container.querySelector('strong')?.textContent).toBe('ts');
});
