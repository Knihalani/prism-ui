import { view } from '@prism-ui/components/view';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/view.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([view]) }); }
