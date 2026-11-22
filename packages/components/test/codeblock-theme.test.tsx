import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { codeBlockDefinition, type CodeBlockSlotProps } from '../src/codeblock';

afterEach(cleanup);
const source = (props: object) => '\x60\x60\x60ui:code\n' + JSON.stringify(props) + '\n\x60\x60\x60';
test('every CodeBlock part is replaceable, including native code/pre, collapsed and streaming placeholders', () => {
 const covered = new Set<string>();
 for (const [content, done] of [
  [source({ code: 'one\ntwo\nthree', lang: 'diff', lines: true, collapseAfter: 1 }), true],
  ['\x60\x60\x60ui:code\n{"code":"","lang":"ts"}', false],
 ] as const) {
  const base = render(<Prism source={content} done={done} animate={false} />);
  const tags = new Map(Array.from(base.container.querySelectorAll('[data-prism="codeblock"][data-part]')).map(el => [el.getAttribute('data-part')!, el.tagName.toLowerCase()]));
  cleanup();
  for (const [part, tag] of tags) {
   const Marker = ({ as, children, codeblock, row, html, ...props }: any) => createElement(as ?? tag, { ...props, 'data-replaced': part }, children);
   const view = render(<Prism source={content} done={done} animate={false} slots={{ codeblock: { [part]: Marker } }} />);
   expect(view.container.querySelector('[data-replaced="' + part + '"]'), part).not.toBeNull();
   covered.add(part); cleanup();
  }
 }
 expect([...covered].sort()).toEqual([...codeBlockDefinition.parts!].sort());
});

test('CodeBlock resolves theme strings over labels, localizes feedback and messages, and supplies typed row models', async () => {
 const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard'), exec = document.execCommand;
 let model: CodeBlockSlotProps | undefined;
 const actions: Action[] = [];
 const theme = defineTheme({ name: 'codeblock-contract', icons: { ask: props => <svg {...props} data-ask-custom="" /> }, components: { codeblock: {
  strings: { title: 'Snippet', copyCode: 'Duplicate code', copied: 'Saved', copyFailed: 'Denied', showAll: 'Expand {count}', copyMessage: 'Copied {payload}' },
  slots: { content: ({ as, codeblock, row, html, ...props }: any) => { model = { codeblock, row, html }; return createElement(as, props); } },
 } } });
 Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
 try {
  const view = render(<Prism source={source({ code: 'one\ntwo\nthree', title: 'Prop title', labels: { copyCode: 'Prop copy' }, collapseAfter: 1 })} theme={theme} onAction={a => actions.push(a)} />);
  expect(view.getByRole('region', { name: 'Snippet' })).toBeDefined();
  expect(view.container.querySelector('[data-ask-custom]')).not.toBeNull();
  expect(model!.row!.index).toBe(0); expect(typeof model!.codeblock.toggleWrap).toBe('function');
  expect(view.getByRole('button', { name: 'Expand 3' })).toBeDefined();
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Duplicate code' })); });
  expect(view.getByRole('status').textContent).toBe('Saved');
  expect(actions[0].message).toBe('Copied {"lang":"","lines":3}');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied'); } } });
  document.execCommand = () => false;
  fireEvent.click(view.getByRole('button', { name: 'Duplicate code' }));
  await waitFor(() => expect(view.getByRole('status').textContent).toBe('Denied'));
  expect(actions).toHaveLength(1);
 } finally { document.execCommand = exec; if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard'); }
});
