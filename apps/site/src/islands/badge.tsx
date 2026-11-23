import { badgeDef } from '@prism-ui/components/badge';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/badge.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([badgeDef]) }); }
