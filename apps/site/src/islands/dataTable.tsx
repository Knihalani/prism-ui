import { dataTableDefinition } from '@prism-ui/components/datatable';
import { tableDef } from '@prism-ui/components/table';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/datatable.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([dataTableDefinition, tableDef]) }); }
