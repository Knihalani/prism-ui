import './setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { chartDefinition } from './index';
import { codeBlockDefinition } from '../codeblock';
import { dataTableDefinition } from '../datatable';
import { replayFixtures } from './replay-fixtures';

afterEach(cleanup);
const registry = createRegistry([codeBlockDefinition, dataTableDefinition, chartDefinition]);
for (const [name, source] of replayFixtures) {
  test(`harness ${name}: every small-chunk prefix renders safely while streaming`, () => {
    const view = render(<Prism registry={registry} source="" done={false} animate={false} />);
    const chunk = name === 'ledger' ? 128 : 16;
    for (let length = 1; length < source.length; length += chunk) {
      expect(() => view.rerender(<Prism registry={registry} source={source.slice(0, length)} done={false} animate={false} />)).not.toThrow();
    }
    expect(() => view.rerender(<Prism registry={registry} source={source} done={false} animate={false} />)).not.toThrow();
    expect(() => view.rerender(<Prism registry={registry} source={source} done animate={false} />)).not.toThrow();
  }, 30000);
}

test('partial and malformed nested items render safely at every character', () => {
  const sources = [
    '```ui:chart\n' + JSON.stringify({ x: 'month', series: [null, 3, {}, { key: 'n', label: {}, color: [] }], data: [null, 1, [], {}, { month: 'Jan', n: 12 }, { month: { toString: null }, n: {} }], annotations: [null, {}, { x: 'Jan' }, { x: 'Jan', label: 'Launch' }, { x: {}, label: {} }], pivots: [null, {}, { type: 'bar' }, { label: 'Bars', type: 'bar', series: [null, {}, { key: 'n' }] }] }) + '\n```',
    '```ui:table\n' + JSON.stringify({ columns: [null, 3, {}, { key: 'n', label: {}, type: {} }], rows: [null, 3, [], {}, { n: { toString: null } }, { n: 12 }], pageSize: 8 }) + '\n```',
  ];
  for (const source of sources) {
    const view = render(<Prism registry={registry} source="" done={false} animate={false} />);
    for (let length = 1; length <= source.length; length++) {
      expect(() => view.rerender(<Prism registry={registry} source={source.slice(0, length)} done={false} animate={false} />)).not.toThrow();
    }
    cleanup();
  }
});

test('component hooks also tolerate malformed raw props without schema coercion', () => {
  const raw = createRegistry([codeBlockDefinition, dataTableDefinition, chartDefinition].map(definition => ({ ...definition, schema: s.any() })));
  for (const [name, props] of [
    ['code', { code: {}, lang: [], meta: {}, title: {}, collapseAfter: 'bad' }],
    ['table', { title: {}, caption: [], rows: {}, columns: {} }],
    ['table', { rows: [null, 3, [], { n: { toString: null } }], columns: [null, 3, {}, { key: {}, label: [] }, { key: 'n', type: {} }] }],
    ['chart', { data: {}, annotations: {}, pivots: {}, series: {}, height: {} }],
    ['chart', { data: [null, 3, { x: { toString: null }, n: 1 }], series: [null, {}, { key: 'n', label: [] }], annotations: [null, { x: 'a' }], pivots: [null, { label: {} }] }],
  ] as const) {
    const source = `\`\`\`ui:${name}\n${JSON.stringify(props)}\n\`\`\``;
    expect(() => render(<Prism registry={raw} source={source} done={false} animate={false} />)).not.toThrow();
    cleanup();
  }
});
