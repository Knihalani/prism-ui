import './setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { Prism, createRegistry, defineTheme, markdownDefinitions, type MarkdownSlotProps } from '../src';

afterEach(cleanup);
const registry = createRegistry();
const source = '# Heading\n\nA **bold** *emphasis* ~~deleted~~ [link](https://example.com "Guide") and \x60code\x60.  \nNext\n\n- [x] Finished\n- [ ] Todo\n\n1. First\n2. Last\n\n> Quote\n\n\x60\x60\x60txt\nplain\n\x60\x60\x60\n\n| A | B |\n| :--- | ---: |\n| one | two |\n\n![Alt](/image.png "Picture")\n\n---';
test('all declared markdown parts render and are replaceable, including table structure and readonly tasks', () => {
 const view = render(<Prism registry={registry} source={source} />);
 const observed = new Map(Array.from(view.container.querySelectorAll('[data-prism][data-part]')).map(el => [el.getAttribute('data-prism') + ':' + el.getAttribute('data-part'), el.tagName.toLowerCase()]));
 cleanup();
 for (const definition of markdownDefinitions) for (const part of definition.parts!) {
  const key = definition.name + ':' + part;
  expect(observed.has(key), key).toBe(true);
  const Marker = ({ as, children, markdown, ...props }: any) => createElement(as ?? observed.get(key), { ...props, 'data-replaced': key }, children);
  const result = render(<Prism registry={registry} source={source} slots={{ [definition.name]: { [part]: Marker } }} />);
  expect(result.container.querySelector('[data-replaced="' + key + '"]'), key).not.toBeNull(); cleanup();
 }
});
test('markdown theme strings and typed models work, while semantic alignment, safety, empty and streaming nodes remain intact', () => {
 let model: MarkdownSlotProps | undefined;
 const theme = defineTheme({ name: 'markdown-contract', components: {
  listItem: { strings: { task: 'Checklist entry' } }, image: { strings: { alt: 'Theme image' } },
  link: { strings: { title: 'Theme link' }, slots: { root: ({ as, children, markdown, ...props }: any) => { model = { markdown }; return createElement(as, props, children); } } },
 } });
 const view = render(<Prism registry={registry} source={source} theme={theme} />);
 expect(view.getAllByRole('checkbox', { name: 'Checklist entry' })).toHaveLength(2);
 expect(view.getByRole('img', { name: 'Theme image' })).toBeDefined();
 expect(view.getByRole('link').getAttribute('title')).toBe('Theme link');
 expect(model!.markdown.external).toBe(true);
 expect(view.container.querySelector('td')?.style.textAlign).toBe('left');
 expect(view.container.querySelector<HTMLTableCellElement>('td:last-child')?.style.textAlign).toBe('right');
 view.rerender(<Prism registry={registry} source={'[bad](javascript:alert%281%29)'} />);
 expect(view.container.querySelector('[href^="javascript:"]')).toBeNull();
 view.rerender(<Prism registry={registry} source="" />);
 expect(view.container.textContent).toBe('');
 view.rerender(<Prism registry={registry} source="# Growing" done={false} />);
 expect(view.container.querySelector('[data-prism="paragraph"]')?.getAttribute('data-state')).toBe('streaming');
});
