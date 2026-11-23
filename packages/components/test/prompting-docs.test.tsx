import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { parse, type Node } from '@prism-ui/core';
import { actionToMessage, createSystemPrompt, defaultRegistry, Prism, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifactPlugin } from '../src';
import { allowedPath, importMap } from '../src/artifact/policy';

const doc = await Bun.file(new URL('../../../docs/PROMPTING.md', import.meta.url)).text();
const examples = [...doc.matchAll(/<!-- prism-example:(\w+) -->\s*````md\n([\s\S]*?)\n````/g)];
const plugins = [artifactPlugin], grants = ['planning'];
function components(node: Node): Node[] { return [...(node.type === 'component' ? [node] : []), ...(node.children ?? []).flatMap(components)]; }

test('default prompt and registry-only variant stay within size budgets', () => {
  const full = createSystemPrompt();
  const registryOnly = createSystemPrompt({ registry: defaultRegistry, artifacts: false });
  expect(full).toContain('## Adaptive inline artifacts');
  expect(full.length).toBeLessThan(42000);
  expect(registryOnly.length).toBeLessThan(34000);
  expect(full).toContain('- estimate:');
  const reactOnly = createSystemPrompt({ artifacts: { renderers: ['react'] } });
  expect(reactOnly).toContain('artifact:react');
  expect(reactOnly).not.toContain('artifact:html');
});

test('all tagged model outputs parse and render through the actual registry', () => {
  expect(examples).toHaveLength(4);
  const expected: Record<string, string[]> = { estimate: ['estimate', 'state'], artifact: ['artifact'], panel: ['artifact'], followup: ['callout'] };
  for (const [, name, source] of examples) {
    const nodes = components(parse(source, { plugins }));
    expect(nodes.map(node => node.name!)).toEqual(expected[name]);
    const store = createStore();
    const view = render(<ArtifactProvider options={{ enabled: false, statePaths: grants }}><Prism source={source} plugins={plugins} store={store} onAction={() => {}} /></ArtifactProvider>);
    expect(view.container.querySelector('[data-prism="render-error"]')).toBeNull();
    expect(view.container.textContent).not.toContain('Something went wrong');
    if (name === 'estimate') expect(store.get('trip.items.seats.qty')).toBe(3);
    for (const node of nodes.filter(node => node.name !== 'state')) expect(view.container.querySelector('[data-prism="' + node.name + '"]')).not.toBeNull();
    view.unmount();
  }
});

test('renderer restrictions reach the artifact catalogue without mutating its registered schema', () => {
  const schema = defaultRegistry.get('artifact')!.schema!;
  const kinds = ['html', 'react', 'svg', 'js', 'markdown'] as const;
  for (const renderers of [['react'], ['svg', 'markdown'], ['html']] as const) {
    const prompt = createSystemPrompt({ artifacts: { renderers } });
    const catalogue = prompt.split('## Component catalogue')[1].split('### artifact')[1];
    const kind = catalogue.split('\n').find(line => line.startsWith('- `kind`'))!;
    expect(kind).toContain(renderers.map(renderer => JSON.stringify(renderer)).join(' | '));
    for (const denied of kinds.filter(kind => !(renderers as readonly string[]).includes(kind))) {
      expect(kind).not.toContain(JSON.stringify(denied));
      expect(prompt).not.toContain('artifact:' + denied);
    }
  }
  expect(defaultRegistry.get('artifact')!.schema).toBe(schema);
  expect(schema.shape!.kind.type).toContain('"html" | "react" | "svg" | "js" | "markdown"');
});

test('artifact examples obey grants, adaptive/token policy and execute their local/action bridge', () => {
  const generated = createSystemPrompt({ artifacts: { statePaths: grants } });
  const sources = [...examples.map(match => match[2]), generated.split('## Component catalogue')[0]];
  let checked = 0;
  for (const source of sources) for (const node of components(parse(source, { plugins })).filter(node => node.name === 'artifact')) {
    const html = String(node.props!.source);
    expect(node.props!.height).toBe('auto');
    expect(node.props!.kind).toBe('html');
    expect(html).toContain('@container');
    expect(html).toContain('320px');
    expect(html).toContain('min-width:0');
    expect(html).toContain('--prism-font-body');
    expect(html).toContain('--prism-accent');
    expect(html).not.toMatch(/https?:|fetch\(|eval\(|localStorage|position:\s*fixed|\d+(?:vw|vh)|#[0-9a-f]{3,8}\b/i);
    const path = JSON.parse(/const path = ("[^"]+")/.exec(html)![1]);
    expect(allowedPath(path, grants)).toBe(true);
    expect(importMap({}, 'https://host.example')).toEqual({});
    const container = document.createElement('div');
    container.innerHTML = html;
    const input = container.querySelector('select')!;
    expect(container.querySelector('label')!.htmlFor).toBe(input.id);
    const store = createStore({ initial: { planning: { room: 'south', budget: 100 } } });
    const actions: unknown[] = [], cleanups: (() => void)[] = [];
    const bridge = {
      state: { get: store.get, set: store.set, subscribe(path: string, fn: (value: unknown) => void) { return store.subscribe(path, () => fn(store.get(path))); } },
      emit: (type: string, payload: unknown) => actions.push({ type, payload }),
    };
    new Function('prism', 'document', 'window', container.querySelector('script')!.textContent!)(bridge, container, { addEventListener: (_: string, fn: () => void) => cleanups.push(fn) });
    expect(input.value).toBe('south');
    input.value = 'north'; fireEvent.change(input);
    expect(store.get(path)).toBe('north');
    expect(store.get('planning')).toEqual({ room: 'north', budget: 100 });
    fireEvent.click(container.querySelector('button')!);
    expect(actions).toEqual([{ type: 'discuss-room', payload: { room: 'north' } }]);
    cleanups.forEach(fn => fn());
    checked++;
  }
  expect(checked).toBe(3);
});

test('documented action message round-trips through the public helper', () => {
  const result = /<!-- prism-action -->\s*```text\n([\s\S]*?)\n```/.exec(doc)![1];
  const action = JSON.parse(result.split('\n').at(-1)!) as Action;
  expect(actionToMessage(action)).toBe(result);
});
