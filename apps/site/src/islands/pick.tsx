import { pick } from '@prism-ui/components/pick';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/pick.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([pick]) }); }
