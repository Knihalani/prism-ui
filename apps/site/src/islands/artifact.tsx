import { artifact, artifactPlugin } from '@prism-ui/components/artifact';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/artifact.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([artifact]), plugins: [artifactPlugin] }); }
