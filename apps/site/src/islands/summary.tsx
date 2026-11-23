import { summaryDef } from '@prism-ui/components/summary';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/summary.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([summaryDef]) }); }
