import { codeBlockDefinition } from '@prism-ui/components/codeblock';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/codeblock.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([codeBlockDefinition]) }); }
