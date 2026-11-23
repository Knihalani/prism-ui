import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import hljs from 'highlight.js';
import { Site } from '../src/site';
import { Prism, defaultRegistry, createRegistry } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { artifactPlugin } from '@prism-ui/components/artifact';
import { mockupPlugin } from '@prism-ui/components/mockup';
import { Example } from '../src/islands/example';
import { examples } from '../src/gallery-data';
import { Hero } from '../src/islands/hero';
import { docsDirectory, type SiteRoute } from '../src/routes';
import { staticMediaPreview } from './static-preview';
import { previewSource } from '../src/preview-source';
import { markdownDocument } from './markdown';
import { Themes } from '../src/islands/themes';

function highlightSource(source: string) {
  const fence = source.match(/^(```ui:[\w]+\n)([\s\S]*)(\n```)$/);
  return fence ? hljs.highlight(fence[1], { language: 'markdown' }).value + hljs.highlight(fence[2], { language: 'json' }).value + hljs.highlight(fence[3], { language: 'markdown' }).value : hljs.highlight(source, { language: 'markdown' }).value;
}

export function renderDocument(file: string, base: string) {
  return markdownDocument(readFileSync(resolve(docsDirectory, file), 'utf8'), base, docsDirectory);
}

export function renderPage(route: SiteRoute, template: string, base: string) {
  const def = route.kind === 'component' ? defaultRegistry.get(route.name!) : undefined;
  const plugins = [artifactPlugin, mockupPlugin];
  const registryFor = (name: string) => {
    const dependencies: Record<string, string[]> = { runbook: ['step'], step: ['runbook'], tabs: ['tab'], tab: ['tabs'], num: ['calc'], calc: ['num'], dataTable: ['table'] };
    return createRegistry([name, ...(dependencies[name] ?? [])].map(name => defaultRegistry.get(name)!));
  };
  const highlight = (code: string) => hljs.highlight(code, { language: 'tsx' }).value;
  const previews = route.kind === 'gallery' ? Object.fromEntries(defaultRegistry.list().map(def => [def.name, staticMediaPreview(previewSource(def), plugins) ?? renderToString(<Prism source={previewSource(def)} registry={registryFor(def.name)} plugins={plugins} store={createStore({ initial: { rent: 1200 } })} scope={`preview-${def.name}`} animate={false} />, { identifierPrefix: `preview-${def.name}-` })])) : {};
  const exampleHtml = def ? renderToString(<Example data={{ name: def.name, sources: examples(def) }} bundle={{ registry: registryFor(def.name), plugins }} />, { identifierPrefix: 'example-' }) : '';
  const document = route.file ? renderDocument(route.file, base) : undefined;
  const content = renderToString(<Site route={route} base={base}
    previews={previews} exampleHtml={exampleHtml} highlighted={def ? examples(def).map(highlightSource) : []} highlight={highlight}
    heroHtml={route.kind === 'home' ? renderToString(<Hero />, { identifierPrefix: 'hero-' }) : ''}
    themesHtml={route.kind === 'themes' ? renderToString(<Themes />, { identifierPrefix: 'themes-' }) : ''}
    docHtml={document?.html} docToc={document?.toc} />);
  const title = `${route.title} — Prism`.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return template.replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`).replace('</head>', () => `<meta name="site-base" content="${base}"></head>`).replace('<!--site-->', () => content);
}
