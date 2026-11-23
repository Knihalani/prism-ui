import { num, calc } from '@prism-ui/components/num';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/num.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([num, calc]) }); }
