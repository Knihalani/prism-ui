import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { estimate } from '../../../packages/components/src/estimate';
import { makeStore } from '../src/store';

afterEach(() => { cleanup(); makeStore(true); });

test('streamed fixture persists final ids across store recreation and Reset state clears them', () => {
  const store = makeStore(true), registry = createRegistry([estimate]);
  const source = '```ui:estimate\n{"id":"saved-estimate","items":[{"id":"seat","price":10,"qty":2}]}\n```';
  const view = render(<Prism store={store} registry={registry} source="" done={false}/>);
  for (let end = 1; end <= source.length; end++) view.rerender(<Prism store={store} registry={registry} source={source.slice(0, end)} done={false}/>);
  view.rerender(<Prism store={store} registry={registry} source={source}/>);
  act(() => store.set('saved-estimate.items.seat.qty', 4));
  expect(Object.keys(makeStore().snapshot()).sort()).toEqual(['rent', 'saved-estimate']);
  expect(makeStore().get('saved-estimate.items.seat.qty')).toBe(4);
  expect(makeStore().snapshot()).toEqual(store.snapshot());
  expect(makeStore(true).snapshot()).toEqual({ rent: 1200 });
  expect(makeStore().snapshot()).toEqual({ rent: 1200 });
});
