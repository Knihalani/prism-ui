import { cardDef } from '@prism-ui/components/card';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/card.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([cardDef]) }); }
