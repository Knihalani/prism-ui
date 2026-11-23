import { tabsDef, tabDef } from '@prism-ui/components/tabs';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/tabs.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([tabsDef, tabDef]) }); }
