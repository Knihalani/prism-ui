import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultRegistry } from '@prism-ui/react';
import '@prism-ui/components';

export const docsDirectory = fileURLToPath(new URL('../../../docs/', import.meta.url));
export type SiteRoute = { path: string; title: string; kind: 'home' | 'gallery' | 'component' | 'themes' | 'doc' | '404'; name?: string; file?: string };

export function getRoutes(): SiteRoute[] {
  return [
    { path: '/', title: 'Interfaces that belong in the conversation', kind: 'home' },
    { path: '/components/', title: 'Components', kind: 'gallery' },
    ...defaultRegistry.list().map(def => ({ path: `/components/${def.name}/`, title: def.name, kind: 'component' as const, name: def.name })),
    { path: '/themes/', title: 'Themes', kind: 'themes' },
    ...readdirSync(docsDirectory).filter(file => file.endsWith('.md')).sort().map(file => ({ path: `/docs/${file.slice(0, -3).toLowerCase()}/`, title: file.slice(0, -3).toLowerCase(), kind: 'doc' as const, file })),
    { path: '/404.html', title: 'Page not found', kind: '404' },
  ];
}
