import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, type ComponentType } from 'react';
import { cleanup, render } from '@testing-library/react';
import { Prism, defineTheme, type PrismComponentProps } from '@prism-ui/react';
import { Callout } from '../src/callout/callout';
import { Card } from '../src/card/card';
import { Grid } from '../src/grid/grid';
import { Tabs } from '../src/tabs/tabs';
import { Summary } from '../src/summary/summary';
import { CodeBlock } from '../src/codeblock';
import '../src';

afterEach(cleanup);
for (const [name, Component] of Object.entries({ callout: Callout, card: Card, grid: Grid, tabs: Tabs, summary: Summary, code: CodeBlock })) {
  test(`${name}: replacement props win over enclosing context, below theme strings`, () => {
    const source = '```ui:' + name + '\n' + JSON.stringify({ title: 'Original title', code: 'hello', points: [], actions: [] }) + '\n```';
    const Wrapped = (input: PrismComponentProps) => createElement(Component as ComponentType<PrismComponentProps>, { ...input, props: { ...input.props, title: 'Replacement title' } });
    const view = render(<Prism source={source} components={{ [name]: Wrapped }} />);
    expect(view.container.textContent).toContain('Replacement title');
    expect(view.container.textContent).not.toContain('Original title');
    view.rerender(<Prism source={source} components={{ [name]: Wrapped }} theme={defineTheme({ name: 'override', components: { [name]: { strings: { title: 'Theme title' } } } })} />);
    expect(view.container.textContent).toContain('Theme title');
    expect(view.container.textContent).not.toContain('Replacement title');
  });
}
