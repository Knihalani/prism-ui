import './setup';
import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { createStore } from '@prism-ui/state';
import { Prism } from '../src';

test('reply keys reset patch deduplication while scope alone does not', () => {
  for (const keyed of [false, true]) {
    const store = createStore();
    const reply = (id: string) => <Prism key={keyed ? id : undefined} scope={id} store={store}
      source={'```ui:state\n{"set":{"planning.room":"north"}}\n```'} />;
    const view = render(reply('first'));
    expect(store.get('planning.room')).toBe('north');
    store.set('planning.room', 'south');
    view.rerender(reply('second'));
    expect(store.get('planning.room')).toBe(keyed ? 'north' : 'south');
    view.unmount();
  }
});

test('documented reusable reply views key Prism by message identity', async () => {
  const readme = await Bun.file(new URL('../../../README.md', import.meta.url)).text();
  const integration = await Bun.file(new URL('../../../docs/INTEGRATION.md', import.meta.url)).text();
  expect(readme).toMatch(/<Prism\s+key=\{id\}/);
  for (const name of ['ai-chat', 'conversations', 'panel', 'themed-chat']) {
    const snippet = integration.split('<!-- snippet: ' + name + ' -->')[1].split('```tsx')[1].split('```')[0];
    expect(snippet).toMatch(/<Prism\s+key=\{message\.id\}/);
    expect(snippet).toContain('scope={message.id}');
  }
});
