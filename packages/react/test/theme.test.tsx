import './setup';
import { expect, test } from 'bun:test';
import { act, createElement, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Prism, ThemeScope, Icon, createTheme, defineComponent, defineTheme, createRegistry, fromCssVars, host, shadcn, useComponentState, usePart, useSlot, useStrings } from '../src';

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
  const roots = Array.from(view.container.querySelectorAll('.prism-root'));
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

test('same-name themes update one stylesheet and remove cleared declarations', () => {
  const name = 'test-live-css';
  const view = render(<ThemeScope theme={defineTheme({ name, tokens: { accent: '#111111' } })} />);
  const sheet = document.head.querySelector(`style[data-prism-theme-css="${name}"]`)!;
  view.rerender(<ThemeScope theme={defineTheme({ name, tokens: { accent: '#222222' }, dark: { accent: '#eeeeee' } })} />);
  expect(document.head.querySelectorAll(`style[data-prism-theme-css="${name}"]`)).toHaveLength(1);
  expect(document.head.querySelector(`style[data-prism-theme-css="${name}"]`)).toBe(sheet);
  expect(sheet.textContent).toContain('--prism-accent:#222222');
  expect(sheet.textContent).toContain('--prism-accent:#eeeeee');
  expect(sheet.textContent).not.toContain('#111111');
  view.rerender(<ThemeScope theme={defineTheme({ name })} />);
  expect(sheet.textContent).not.toContain('--prism-accent:');
});

test('live theme objects preserve the Prism tree and widget state', () => {
  let mounts = 0, unmounts = 0;
  function Counter() {
    const [count, setCount] = useComponentState('count', 0);
    useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
    return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
  }
  const counters = createRegistry([defineComponent({ name: 'counter', component: Counter })]);
  const content = (accent: string) => <ThemeScope theme={defineTheme({ name: 'test-live-state', tokens: { accent } })}><Prism registry={counters} source={'::counter{}\n'} /></ThemeScope>;
  const view = render(content('#123456')), root = view.container.querySelector('.prism-root');
  const button = view.getByRole('button', { name: 'Count 0' });
  fireEvent.click(button);
  view.rerender(content('#654321'));
  expect(view.container.querySelector('.prism-root')).toBe(root);
  expect(view.getByRole('button', { name: 'Count 1' })).toBe(button);
  expect(mounts).toBe(1); expect(unmounts).toBe(0);
});

test('icons resolve centrally and invalid theme names or cycles fail explicitly', () => {
  const theme = defineTheme({ name: 'test-icons', icons: { check: props => createElement('svg', { ...props, 'data-custom-icon': '' }) } });
  const view = render(<Prism source={source} registry={registry} theme={theme} />);
  expect(view.container.querySelector('[data-custom-icon]')).not.toBeNull();
  expect(() => defineTheme({ name: 'bad"]{}' })).toThrow('Theme names');
  const cyclic: any = { name: 'cyclic' }; cyclic.extends = cyclic;
  expect(() => renderToString(<ThemeScope theme={cyclic} />)).toThrow('Circular');
});

test('scopes inside a custom view resolve their own parts, strings and icons while explicit props still win', () => {
  const inner = defineTheme({ name: 'test-inner-parts', components: { sample: { slots: { body: marker('inside') }, strings: { title: 'Inner' }, styles: { body: { color: 'blue' } } } } });
  function Wrapped() { return <ThemeScope theme={inner}><Sample /></ThemeScope>; }
  const wrapped = createRegistry([defineComponent({ name: 'sample', component: Wrapped, strings: { title: 'Default' } })]);
  const view = render(<Prism registry={wrapped} source={source} theme={defineTheme({ name: 'test-outer-parts', components: { sample: { slots: { body: marker('outside') }, strings: { title: 'Outer' } } } })} styles={{ sample: { body: { padding: 7 } } }} />);
  const part = view.container.querySelector('[data-part="body"]') as HTMLElement;
  expect(part.dataset.marker).toBe('inside'); expect(part.textContent).toBe('Inner'); expect(part.style.color).toBe('blue'); expect(part.style.padding).toBe('7px');
});

test('hydration consolidates repeated declarative server styles into one stylesheet in the head', async () => {
  const theme = defineTheme({ name: 'test-hydration', tokens: { accent: 'tomato' } });
  const content = <><ThemeScope theme={theme}>One</ThemeScope><ThemeScope theme={theme}>Two</ThemeScope></>;
  const container = document.createElement('div'); container.innerHTML = renderToString(content); document.body.append(container);
  expect(container.querySelectorAll('[data-prism-theme-css="test-hydration"]').length).toBe(2);
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(container, content); });
  expect(document.querySelectorAll('style[data-prism-theme-css="test-hydration"]').length).toBe(1);
  expect(document.head.querySelector('[data-prism-theme-css="test-hydration"]')?.textContent).toContain('--prism-accent:tomato');
  await act(async () => root!.unmount()); container.remove();
});
