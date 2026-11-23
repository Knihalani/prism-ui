import '../../../packages/react/test/setup';
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { demos } from '../src/catalogue';
import { editorStorageKey } from '../src/theme-editor/state';
import { parseLocation, serialiseLocation } from '../src/url-state';
import { radiusScale, springTokens, typeScale } from '../src/theme-editor/model';

test('modal dialogs disable the nonmodal editor and restore it without closing the draft', () => {
  const view = render(<App />);
  const editor = open(view);
  const panel = view.getByRole('complementary', { name: 'Theme editor' });
  const name = editor.getByRole('textbox', { name: 'Theme name' });
  act(() => name.focus());
  fireEvent.keyDown(name, { key: 'k', ctrlKey: true });
  expect(view.getByRole('dialog')).toBeTruthy();
  expect(panel.hasAttribute('inert')).toBe(true);
  fireEvent.keyDown(view.getByRole('combobox', { name: 'Search scenarios and components' }), { key: 'Escape' });
  expect(view.queryByRole('dialog')).toBeNull();
  expect(panel.hasAttribute('inert')).toBe(false);
  expect(document.activeElement).toBe(name);
});

test('modal backdrops stack above the nonmodal theme editor', async () => {
  const css = await Bun.file(new URL('../src/app.css', import.meta.url)).text();
  const editorCss = await Bun.file(new URL('../src/theme-editor/editor.css', import.meta.url)).text();
  const modalLayer = Number(css.match(/\.dialog-backdrop\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  const editorLayer = Number(editorCss.match(/\.theme-editor\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  expect(modalLayer).toBeGreaterThan(editorLayer);
});

const previousUrl = window.location.href;
beforeEach(() => { localStorage.clear(); window.location.href = 'http://localhost/?mode=light'; });
afterEach(() => { cleanup(); localStorage.clear(); window.location.href = previousUrl; });
const stored = () => JSON.parse(localStorage.getItem(editorStorageKey)!);
const sheet = () => document.head.querySelector('style[data-prism-theme-css="playground-draft"]')!.textContent!;
function edit(input: HTMLElement, value: string) {
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
}
function open(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole('button', { name: 'Customise theme' }));
  return within(view.getByRole('complementary', { name: 'Theme editor' }));
}

test.each(['Spring', 'Bouncy'])('%s parameters survive reopening, storage restore and undo/redo', name => {
  let view = render(<App />);
  let editor = open(view);
  const variant = name === 'Spring' ? 'spring' : 'bouncy';
  edit(editor.getByRole('slider', { name: name + ' response', hidden: true }), '.58');
  edit(editor.getByRole('slider', { name: name + ' damping', hidden: true }), '.64');
  fireEvent.click(editor.getByRole('button', { name: 'Close theme editor' }));
  editor = open(view);
  expect((editor.getByRole('slider', { name: name + ' response', hidden: true }) as HTMLInputElement).value).toBe('0.58');
  expect((editor.getByRole('slider', { name: name + ' damping', hidden: true }) as HTMLInputElement).value).toBe('0.64');
  edit(editor.getByRole('slider', { name: name + ' response', hidden: true }), '.72');
  expect(stored().draft.tokens).toMatchObject(springTokens(.72, .64, variant));
  fireEvent.click(editor.getByRole('button', { name: 'Undo theme edit' }));
  expect(stored().draft.tokens).toMatchObject(springTokens(.58, .64, variant));
  expect((editor.getByRole('slider', { name: name + ' response', hidden: true }) as HTMLInputElement).value).toBe('0.58');
  fireEvent.click(editor.getByRole('button', { name: 'Redo theme edit' }));
  expect(stored().draft.tokens).toMatchObject(springTokens(.72, .64, variant));
  view.unmount();
  view = render(<App />);
  editor = within(view.getByRole('complementary', { name: 'Theme editor' }));
  expect((editor.getByRole('slider', { name: name + ' response', hidden: true }) as HTMLInputElement).value).toBe('0.72');
  edit(editor.getByRole('slider', { name: name + ' damping', hidden: true }), '.81');
  expect(stored().draft.tokens).toMatchObject(springTokens(.72, .81, variant));
  fireEvent.click(editor.getByRole('button', { name: 'Reset all' }));
  expect((editor.getByRole('slider', { name: name + ' response', hidden: true }) as HTMLInputElement).value).toBe(name === 'Spring' ? '0.35' : '0.4');
});

test('invalid persisted spring parameters are discarded without losing token overrides', () => {
  localStorage.setItem(editorStorageKey, JSON.stringify({ open: true, draft: { name: 'Saved', base: 'host', tokens: { accent: '#123456' }, dark: {}, springProfiles: { spring: { response: -1, damping: .8 }, bouncy: { response: .4, damping: 'bad' } } } }));
  const view = render(<App />);
  const editor = within(view.getByRole('complementary', { name: 'Theme editor' }));
  expect((editor.getByRole('slider', { name: 'Spring response', hidden: true }) as HTMLInputElement).value).toBe('0.35');
  expect((editor.getByRole('slider', { name: 'Bouncy response', hidden: true }) as HTMLInputElement).value).toBe('0.4');
  expect(stored().draft.springProfiles).toBeUndefined();
  expect(stored().draft.tokens.accent).toBe('#123456');
});

test('toggle is nonmodal, restores focus, and round-trips editor URL state without changing theme parsing', () => {
  const view = render(<App />);
  const editor = open(view);
  expect(new URLSearchParams(location.search).get('editor')).toBe('1');
  expect(view.container.querySelector('.shell-stage')?.hasAttribute('inert')).toBe(false);
  expect(view.getByRole('combobox', { name: 'Design theme' }).textContent).toContain('My theme');
  expect(view.getByRole('combobox', { name: 'Design theme' }).getAttribute('title')).toBe('Custom: My theme');
  fireEvent.click(editor.getByRole('button', { name: 'Close theme editor' }));
  expect(view.queryByRole('complementary', { name: 'Theme editor' })).toBeNull();
  expect(new URLSearchParams(location.search).has('editor')).toBe(false);
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Customise theme' }));
  const state = { shell: 'workspace', theme: 'objects', editor: true } as const;
  expect(parseLocation(serialiseLocation(state), ['host', 'objects'])).toEqual({ ...state, mode: undefined });
});

test('popstate can open the editor on a fresh page and restores its base and preview mode', () => {
  const view = render(<App />);
  act(() => { history.pushState(null, '', '?shell=editor&theme=print&mode=dark&editor=1'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(view.getByRole('complementary', { name: 'Theme editor' })).toBeDefined();
  expect(stored().draft.base).toBe('print');
  expect(view.container.querySelector('.shell')?.getAttribute('data-mode')).toBe('dark');
});

test('accent edits keep the same reply, widget state and real-theme stylesheet, also across shell switches', async () => {
  window.location.href = 'http://localhost/?theme=refraction&mode=light';
  const source = demos.find(demo => demo.id === 'tabs')!.source;
  const view = render(<App agentFactory={() => ({ id: 'tabs', label: 'Tabs', async *respond() { yield { type: 'text', delta: source }; } })} />);
  fireEvent.click(view.getByRole('button', { name: /Pick a laptop/ }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  fireEvent.click(view.getByRole('tab', { name: 'During' }));
  const root = view.container.querySelector('.reply-content > .prism-root') as HTMLElement;
  const tab = view.getByRole('tab', { name: 'During' });
  const baseCss = document.head.querySelector('style[data-prism-theme-css="refraction"]')!.textContent;
  const editor = open(view);
  edit(editor.getByRole('textbox', { name: 'Accent' }), '#bc4c34');
  expect(sheet()).toContain('--prism-accent:#bc4c34');
  expect(root.style.getPropertyValue('--prism-accent')).toBe('#bc4c34');
  expect(view.container.querySelector('.reply-content > .prism-root')).toBe(root);
  expect(view.getByRole('tab', { name: 'During' })).toBe(tab);
  expect(document.head.querySelector('style[data-prism-theme-css="refraction"]')!.textContent).toBe(baseCss);
  for (const shell of ['Editor', 'Workspace', 'Chat']) {
    fireEvent.click(view.getByRole('button', { name: shell }));
    expect(view.getByRole('tab', { name: 'During' }).getAttribute('aria-selected')).toBe('true');
    expect((view.container.querySelector('.reply-content > .prism-root') as HTMLElement).style.getPropertyValue('--prism-accent')).toBe('#bc4c34');
    expect(view.getByRole('textbox', { name: 'Theme name' })).toBeDefined();
  }
});

test('dark-target edits flip the preview mode and affect only the dark map', () => {
  const view = render(<App />), editor = open(view);
  edit(editor.getByRole('textbox', { name: 'Accent' }), '#123456');
  fireEvent.click(editor.getByRole('button', { name: 'Dark' }));
  expect(view.container.querySelector('.shell')?.getAttribute('data-mode')).toBe('dark');
  edit(editor.getByRole('textbox', { name: 'Accent' }), '#fedcba');
  expect(stored().draft.tokens.accent).toBe('#123456');
  expect(stored().draft.dark.accent).toBe('#fedcba');
  expect(sheet()).toContain(':scope[data-prism-theme="dark"] {--prism-accent:#fedcba;}');
  fireEvent.click(editor.getByRole('button', { name: 'Light' }));
  expect((editor.getByRole('textbox', { name: 'Accent' }) as HTMLInputElement).value).toBe('#123456');
});

test('scale and spring sliders write generated tokens; undo and redo are one generator action', () => {
  const view = render(<App />), editor = open(view);
  edit(editor.getByRole('slider', { name: 'Base size', hidden: true }), '20');
  expect(stored().draft.tokens).toEqual(typeScale(20, 1.125));
  edit(editor.getByRole('slider', { name: 'Radius scale', hidden: true }), '18');
  expect(stored().draft.tokens).toMatchObject(radiusScale(18));
  edit(editor.getByRole('slider', { name: 'Spring response', hidden: true }), '.55');
  expect(stored().draft.tokens).toMatchObject(springTokens(.55, .85));
  const beforeReplay = JSON.stringify(stored().draft);
  fireEvent.click(editor.getByRole('button', { name: 'Replay spring', hidden: true }));
  expect(JSON.stringify(stored().draft)).toBe(beforeReplay);
  fireEvent.keyDown(view.getByRole('complementary', { name: 'Theme editor' }), { key: 'z', ctrlKey: true });
  expect(stored().draft.tokens.motionSpring).toBeUndefined();
  expect((editor.getByRole('slider', { name: 'Spring response', hidden: true }) as HTMLInputElement).value).toBe('0.35');
  fireEvent.click(editor.getByRole('button', { name: 'Redo theme edit' }));
  expect(stored().draft.tokens).toMatchObject(springTokens(.55, .85));
});

test('CSS import reports mappings and ignored names, merges both modes, and undoes as one edit', () => {
  const view = render(<App />), editor = open(view);
  edit(editor.getByLabelText('Paste shadcn / Tailwind CSS variables'), ':root{--primary:220 80% 40%;--radius:12px;--unknown:yes}.dark{--primary:#abc}');
  fireEvent.click(editor.getByRole('button', { name: 'Apply', hidden: true }));
  expect(editor.getByText('Mapped 2, ignored 1')).toBeDefined();
  expect(editor.getByText('--unknown')).toBeDefined();
  expect(stored().draft.tokens.accent).toBe('hsl(220 80% 40%)');
  expect(stored().draft.tokens.radiusMd).toBe('12px');
  expect(stored().draft.dark.accent).toBe('#abc');
  fireEvent.click(editor.getByRole('button', { name: 'Undo theme edit' }));
  expect(stored().draft.tokens).toEqual({});
  expect(stored().draft.dark).toEqual({});
});

test('export code copies and downloads the user-named theme, never the internal preview name', async () => {
  const view = render(<App />), editor = open(view);
  edit(editor.getByRole('textbox', { name: 'Theme name' }), 'Summer Studio');
  const writeText = mock(async (_: string) => {});
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  let blob: Blob | undefined, filename = '';
  const create = spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:theme-editor-test'; });
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { filename = this.download; });
  try {
    fireEvent.click(editor.getByRole('button', { name: 'Copy code', hidden: true }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(editor.getByRole('button', { name: 'Copied', hidden: true })).toBeDefined());
    const code = writeText.mock.calls[0][0];
    expect(code).toContain('export const summerStudio');
    expect(code).not.toContain('playground-draft');
    expect(editor.getByLabelText('Theme TypeScript').textContent).toBe(code);
    fireEvent.click(editor.getByRole('button', { name: /Download .ts/, hidden: true }));
    expect(filename).toBe('summer-studio.ts');
    expect(await blob!.text()).toBe(code);
  } finally {
    create.mockRestore(); click.mockRestore();
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor); else delete (navigator as any).clipboard;
  }
});

test('localStorage restores draft and panel state, ignores malformed values and tolerates unavailable storage', () => {
  localStorage.setItem(editorStorageKey, JSON.stringify({ open: true, draft: { name: 'Restored', base: 'objects', tokens: { accent: '#c04' }, dark: { bg: '#111' } } }));
  const view = render(<App />);
  expect((view.getByRole('textbox', { name: 'Theme name' }) as HTMLInputElement).value).toBe('Restored');
  expect(sheet()).toContain('--prism-accent:#c04');
  fireEvent.click(view.getByRole('button', { name: 'Close theme editor' }));
  view.unmount();
  const reload = render(<App />);
  expect(reload.queryByRole('complementary', { name: 'Theme editor' })).toBeNull();
  expect(reload.getByRole('combobox', { name: 'Design theme' }).textContent).toContain('Restored');
  reload.unmount(); localStorage.setItem(editorStorageKey, '{broken');
  const invalid = render(<App />);
  expect(invalid.queryByRole('complementary', { name: 'Theme editor' })).toBeNull();
  invalid.unmount();
  const get = spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  const set = spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  try { const unavailable = render(<App />); open(unavailable); expect(unavailable.getByRole('textbox', { name: 'Theme name' })).toBeDefined(); }
  finally { get.mockRestore(); set.mockRestore(); }
});

test('a rejected clipboard write presents an inline error without closing the editor', async () => {
  const view = render(<App />), editor = open(view);
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
  try {
    fireEvent.click(editor.getByRole('button', { name: 'Copy code', hidden: true }));
    await waitFor(() => expect(editor.getByRole('alert').textContent).toBe('Clipboard unavailable. Select the code to copy.'));
    expect(view.getByRole('complementary', { name: 'Theme editor' })).toBeDefined();
  } finally { if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor); else delete (navigator as any).clipboard; }
});

test('Escape closes only from inside and when unhandled, restoring the toggle focus', () => {
  const view = render(<App />), editor = open(view);
  fireEvent.keyDown(view.getByRole('textbox', { name: 'Message Prism' }), { key: 'Escape' });
  expect(editor.getByRole('textbox', { name: 'Theme name' })).toBeDefined();
  const input = editor.getByRole('textbox', { name: 'Theme name' });
  const prevent = (event: Event) => event.preventDefault();
  input.addEventListener('keydown', prevent);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(view.getByRole('complementary', { name: 'Theme editor' })).toBeDefined();
  input.removeEventListener('keydown', prevent);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(view.queryByRole('complementary', { name: 'Theme editor' })).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Customise theme' }));
});

test('base changes offer keep/fresh inline and retain undo history', () => {
  const view = render(<App />), editor = open(view);
  edit(editor.getByRole('textbox', { name: 'Accent' }), '#ab1234');
  fireEvent.change(editor.getByLabelText('Start from'), { target: { value: 'print' } });
  fireEvent.click(editor.getByRole('button', { name: 'Keep edits' }));
  expect(stored().draft.base).toBe('print');
  expect(stored().draft.tokens.accent).toBe('#ab1234');
  fireEvent.change(editor.getByLabelText('Start from'), { target: { value: 'objects' } });
  fireEvent.click(editor.getByRole('button', { name: 'Start fresh' }));
  expect(stored().draft.base).toBe('objects');
  expect(stored().draft.tokens).toEqual({});
  fireEvent.click(editor.getByRole('button', { name: 'Undo theme edit' }));
  expect(stored().draft.base).toBe('print');
  expect(stored().draft.tokens.accent).toBe('#ab1234');
});
