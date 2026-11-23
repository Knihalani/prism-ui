import { gridDef } from '@prism-ui/components/grid';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/grid.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([gridDef]) }); }
