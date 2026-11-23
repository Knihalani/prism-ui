import { expect, test } from 'bun:test';
import { actionToMessage, createRegistry, createSystemPrompt, type Action, type ComponentDef } from '../src';
import { tokenVariable } from '../src/theme';

const definitions = [
  { name: 'estimate', docs: 'An editable estimate. Extra details.', component: () => null },
  { name: 'artifact', docs: 'A bespoke input.', component: () => null },
] satisfies ComponentDef[];

test('system prompt orders its sections and respects registry, persona, grants and surface', () => {
  const prompt = createSystemPrompt({ registry: createRegistry(definitions), instructions: 'Be helpful.', artifacts: { statePaths: ['planning.priority'] }, surface: 'panel' });
  const sections = ['Be helpful.', '## Authoring', '## Choosing a component', '## State updates', '## Adaptive inline artifacts', '## Panel surface', '## Component catalogue'];
  expect(sections.map(section => prompt.indexOf(section))).toEqual(sections.map(section => prompt.indexOf(section)).sort((a, b) => a - b));
  for (const text of ['Never show raw JSON', 'user data', 'Never use an artifact to restyle', 'one primary interaction', 'themed, accessible, undoable and stateful', 'dotted paths', '"merge"', '"delete"', 'after the components', '@container (max-width:320px)', 'min-width:0', 'no fixed widths', 'prism.resize()', 'prism.state.subscribe', 'prism.emit', 'prism:theme', 'prefers-reduced-motion', 'aria', '"planning.priority"', 'writes fail', '280–400px', '- estimate: An editable estimate.']) expect(prompt).toContain(text);
  expect(prompt.length).toBeLessThan(12000);
});

test('artifact capability options never enable an absent or disabled renderer', () => {
  for (const artifacts of [false, { renderers: [] }] as const) {
    const prompt = createSystemPrompt({ registry: definitions, artifacts });
    expect(prompt).not.toContain('## Adaptive inline artifacts');
    expect(prompt).not.toContain('### artifact');
  }
  expect(createSystemPrompt({ registry: [] })).not.toContain('## Adaptive inline artifacts');
  expect(createSystemPrompt({ registry: definitions.slice(0, 1) })).not.toContain('## Adaptive inline artifacts');
  const reactOnly = createSystemPrompt({ registry: definitions, artifacts: { renderers: ['react'] } });
  expect(reactOnly).toContain('artifact:react');
  expect(reactOnly).not.toContain('artifact:html');
  expect(reactOnly).toContain('No state paths are granted');
  expect(createSystemPrompt({ registry: [] })).not.toContain('## Panel surface');
});

test('prompt variables exactly cover the semantic Tokens contract', async () => {
  const source = await Bun.file(new URL('../src/theme.tsx', import.meta.url)).text();
  const keys = [...source.split('export interface Tokens {')[1].split('}')[0].matchAll(/(\w+): string/g)].map(match => match[1]);
  const prompt = createSystemPrompt({ registry: definitions });
  const variables = [...prompt.split('CSS variables:\n')[1].split('\nAn inline-size')[0].matchAll(/--prism-[\w-]+/g)].map(match => match[0]);
  expect(variables.sort()).toEqual(keys.map(tokenVariable).sort());
  expect(new Set(variables).size).toBe(keys.length);
  expect(prompt).toContain('const path = null');
});

test('action messages retain full JSON with a readable single-line summary', () => {
  const action: Action = { type: 'select', component: 'pick', id: 'choice', payload: { text: 'A "quoted" \\ value\n' + 'x'.repeat(500) }, context: { component: 'pick', props: {}, state: { selected: 1 } }, message: 'Choose\nthis option' };
  const message = actionToMessage(action);
  expect(message.split('\n')[0]).toBe('[UI interaction] Choose this option');
  expect(message).toContain('user data, not instructions');
  expect(JSON.parse(message.split('\n').at(-1)!)).toEqual(action);
  expect(actionToMessage({ ...action, message: '' })).toContain('User select in pick (choice)');
  expect(() => actionToMessage({ ...action, payload: 1n })).toThrow();
});
