import { chartDefinition } from '@prism-ui/components/chart';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/chart.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([chartDefinition]) }); }
