import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { tabsDef, tabDef } from '../src/tabs';
import { calloutDef } from '../src/callout';
import { cardDef } from '../src/card';
import { gridDef } from '../src/grid';
import { badgeDef } from '../src/badge';

afterEach(cleanup);
const fixtures = [
 '::::tabs{title="Project"}\n:::tab{label={"$ref":"label"} badge={"$ref":"count"}}\nBody\n:::\n:::tab\nLoading\n:::\n::::',
 ':::tab{label="Standalone"}\nBody\n:::',
 ':::callout{title="Context"}\nBody\n:::',
 ':::callout\n:::',
 ':::card{title="Plan" subtitle="Details" image="/cover.png" href="/plan" action="Choose" badge="New"}\nBody\n:::',
 ':::card\n:::',
 ':::grid{title="Options" meta="Two"}\nContent\n:::',
 ':badge[Ready]{dot=true}',
];
test('every Group 2 part is observed and replaceable, including bound, empty and receipt parts', () => {
 const definitions = [tabsDef, tabDef, calloutDef, cardDef, gridDef, badgeDef];
 const covered = Object.fromEntries(definitions.map(def => [def.name, new Set<string>()]));
 for (const source of fixtures) {
  function show(slots = {}) {
   const store = createStore(); store.set('label', 'Overview'); store.set('count', '3');
   return render(<Prism source={source} store={store} slots={slots} animate={false} />);
  }
  const base = show();
  const tags = new Map(Array.from(base.container.querySelectorAll('[data-prism][data-part]')).filter(el => el.getAttribute('data-prism')! in covered).map(el => [el.getAttribute('data-prism')! + '.' + el.getAttribute('data-part')!, el.tagName.toLowerCase()]));
  cleanup();
  for (const [key, tag] of tags) {
   const [component, part] = key.split('.');
   const Marker = ({ as, children, tabs, tab, callout, card, grid, badge, ...props }: any) => createElement(as ?? tag, { ...props, 'data-replaced': key }, children);
   const view = show({ [component]: { [part]: Marker } });
   expect(view.container.querySelector('[data-replaced="' + key + '"]'), key).not.toBeNull();
   covered[component].add(part); cleanup();
  }
 }
 for (const definition of definitions) expect([...covered[definition.name]].sort(), definition.name).toEqual([...definition.parts!].sort());
});

test('Group 2 exposes headless models, theme strings and central icon overrides', () => {
 const models: Record<string, any> = {}, actions: Action[] = [];
 function slot(name: string) { return ({ as, children, ...props }: any) => { models[name] = props[name]; delete props[name]; return createElement(as, props, children); }; }
 const theme = defineTheme({ name: 'group-two', icons: { info: props => <svg {...props} data-info-custom="" />, check: props => <svg {...props} data-check-custom="" /> }, components: {
  tabs: { strings: { label: 'Navigation', title: 'Sections' }, slots: { root: slot('tabs') } },
  callout: { strings: { title: 'Context', askAboutThis: 'Explain' }, slots: { root: slot('callout') } },
  card: { strings: { title: 'Proposal', action: 'Accept', sent: 'Recorded', selectMessage: 'Chose {payload}' }, slots: { root: slot('card') } },
  grid: { strings: { title: 'Choices', meta: 'Two options' }, slots: { root: slot('grid') } },
  badge: { slots: { root: slot('badge') } },
 } });
 const view = render(<Prism source={fixtures.join('\n\n')} theme={theme} onAction={a => actions.push(a)} />);
 expect(view.getByRole('tablist', { name: 'Navigation' })).toBeDefined();
 expect(typeof models.tabs.select).toBe('function');
 expect(view.getAllByRole('note', { name: 'Context' })[0]).toBeDefined();
 expect(view.container.querySelector('[data-info-custom]')).not.toBeNull();
 expect(typeof models.callout.onAsk).toBe('function');
 expect(typeof models.card.onSelect).toBe('function');
 expect(view.getByText('Choices')).toBeDefined();
 expect(view.getByText('Two options')).toBeDefined();
 expect(models.grid.rootProps['aria-label']).toBe('Choices');
 expect(models.badge.rootProps['data-tone']).toBe('neutral');
 fireEvent.click(view.getAllByRole('button', { name: 'Accept' })[0]);
 expect(actions.at(-1)!.message).toStartWith('Chose ');
 expect(view.getByRole('button', { name: 'Recorded' }).querySelector('[data-check-custom]')).not.toBeNull();
});
