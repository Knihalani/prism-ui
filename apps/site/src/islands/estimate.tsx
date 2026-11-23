import { estimate } from '@prism-ui/components/estimate';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/estimate.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([estimate]) }); }
