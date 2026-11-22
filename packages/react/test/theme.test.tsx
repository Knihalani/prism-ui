import './setup';
import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Prism, ThemeScope, Icon, createTheme, defineComponent, defineTheme, createRegistry, fromCssVars, host, shadcn, usePart, useSlot, useStrings } from '../src';

function Sample() {
  const Part = useSlot('sample', 'body', 'p' as any), attrs = usePart('sample', 'body'), strings = useStrings('sample');
  return <Part {...attrs}>{strings.title}<Icon name="check" /></Part>;
}
const registry = createRegistry([defineComponent({ name: 'sample', component: Sample, parts: ['body'], strings: { title: 'Default' } })]);
const source = '::sample{title="Prop"}\n';
const marker = (name: string) => function Marker({ children, ...props }: any) { return <p {...props} data-marker={name}>{children}</p>; };

test('theme inheritance merges parts and explicit overrides win, except theme strings take precedence over props', () => {
  const base = defineTheme({ name: 'test-base', tokens: { accent: '#111' }, components: { sample: { slots: { body: marker('base') }, classNames: { body: 'base' }, styles: { body: { padding: 10, color: 'red' } }, strings: { title: 'Base' } } } });
  const theme = defineTheme({ name: 'test-derived', extends: base, tokens: { accent: '#222' }, components: { sample: { slots: { body: marker('theme') }, classNames: { body: 'theme' }, styles: { body: { color: 'green' } }, strings: { title: 'Theme' } } } });
  const view = render(<Prism registry={registry} source={source} theme={theme} slots={{ sample: { body: marker('prop') } }} classNames={{ sample: { body: 'explicit' } }} styles={{ sample: { body: { color: 'blue' } } }} />);
  const part = view.container.querySelector('[data-part="body"]') as HTMLElement;
  expect(part.dataset.marker).toBe('prop'); expect(part.className).toContain('explicit'); expect(part.className).not.toContain('theme');
  expect(part.style.color).toBe('blue'); expect(part.style.padding).toBe('10px'); expect(part.textContent).toBe('Theme');
  expect(document.querySelector('[data-prism-theme-css="test-derived"]')?.textContent).toContain('--prism-accent:#222');
});

test('nested scopes inherit themes and modes, independent subtrees can select a new theme', () => {
  const one = defineTheme({ name: 'test-one', components: { sample: { strings: { title: 'One' } } } });
  const two = defineTheme({ name: 'test-two', components: { sample: { strings: { title: 'Two' } } } });
  const view = render(<ThemeScope theme={one} mode="dark"><Prism registry={registry} source={source} /><ThemeScope theme={two} mode="light"><Prism registry={registry} source={source} /></ThemeScope></ThemeScope>);
  const roots = [...view.container.querySelectorAll('.prism-root')];
  expect(roots.map(node => node.textContent)).toEqual(['One', 'Two']);
  expect(roots.map(node => node.getAttribute('data-prism-theme'))).toEqual(['dark', 'light']);
  expect(roots.map(node => node.getAttribute('data-prism-theme-name'))).toEqual(['test-one', 'test-two']);
});

test('named CSS is scoped, deduplicated and included in server rendering with dark and auto overrides', () => {
  const theme = defineTheme({ name: 'test-css', tokens: { bg: '#fff' }, dark: { bg: '#111' }, css: '.sample { display:grid }' });
  render(<><ThemeScope theme={theme} /><ThemeScope theme={theme} mode="dark" /></>);
  expect(document.querySelectorAll('style[data-prism-theme-css="test-css"]').length).toBe(1);
  const css = document.querySelector('style[data-prism-theme-css="test-css"]')!.textContent!;
  expect(css).toContain('@scope ([data-prism-theme-name="test-css"]) to ([data-prism-theme-name])');
  expect(css).toContain('prefers-color-scheme:dark'); expect(css).toContain('--prism-bg:#111');
  const html = renderToString(<ThemeScope theme={theme}>SSR</ThemeScope>);
  expect(html).toContain('data-prism-theme-css="test-css"'); expect(html).toContain('SSR');
});

test('legacy modes, style objects, empty themes and host defaults remain supported', () => {
  const view = render(<Prism source="Hello" theme="dark" />);
  expect(view.container.querySelector('.prism-root')?.getAttribute('data-prism-theme')).toBe('dark');
  view.rerender(<Prism source="Hello" theme={createTheme({ accent: 'tomato', fontBody: 'Georgia' })} />);
  expect((view.container.querySelector('.prism-root') as HTMLElement).style.getPropertyValue('--prism-accent')).toBe('tomato');
  expect(host.name).toBe('host'); expect(fromCssVars({ accent: '--primary' })).toEqual({ accent: 'var(--primary)' });
  expect(shadcn.tokens.bg).toBe('var(--background)');
});

test('icons resolve centrally and invalid theme names or cycles fail explicitly', () => {
  const theme = defineTheme({ name: 'test-icons', icons: { check: props => createElement('svg', { ...props, 'data-custom-icon': '' }) } });
  const view = render(<Prism source={source} registry={registry} theme={theme} />);
  expect(view.container.querySelector('[data-custom-icon]')).not.toBeNull();
  expect(() => defineTheme({ name: 'bad"]{}' })).toThrow('Theme names');
  const cyclic: any = { name: 'cyclic' }; cyclic.extends = cyclic;
  expect(() => renderToString(<ThemeScope theme={cyclic} />)).toThrow('Circular');
});
