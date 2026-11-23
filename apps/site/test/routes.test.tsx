import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteRoute } from '../src/routes';
import { normalizeBase, sitePath } from '../src/paths';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const docsDirectory = fileURLToPath(new URL('../../../docs/', import.meta.url));
const result = Bun.spawnSync(['bun', '-e', `
  import { defaultRegistry } from '@prism-ui/react';
  import { getRoutes } from './src/routes';
  import { renderPage } from './scripts/render';
  const routes = getRoutes();
  console.log(JSON.stringify({ routes, names: defaultRegistry.list().map(def => def.name),
    pages: routes.map(route => renderPage(route, '<html lang="en"><head><title>Prism</title></head><body><!--site--></body></html>', '/prism-ui/')) }));
`], { cwd: fileURLToPath(new URL('../', import.meta.url)) });
if (result.exitCode !== 0) throw new Error(result.stderr.toString());
const { routes, names, pages } = JSON.parse(result.stdout.toString()) as { routes: SiteRoute[]; names: string[]; pages: string[] };

test('every registered component and top-level Markdown document has a unique prerendered route', () => {
  const paths = routes.map(route => route.path);
  expect(new Set(paths).size).toBe(paths.length);
  for (const name of names) expect(paths).toContain(`/components/${name}/`);
  for (const file of readdirSync(docsDirectory).filter(file => file.endsWith('.md'))) expect(paths).toContain(`/docs/${file.slice(0, -3).toLowerCase()}/`);
  for (const html of pages) {
    expect(html).toContain('id="main"');
    expect(html).toContain('<h1');
    expect(html).not.toContain('<!--site-->');
    expect(html).toContain('href="/prism-ui/components/"');
  }
});

test.skipIf(!existsSync(resolve(dist, 'index.html')))('every internal link and asset in built HTML resolves under its deployment base', () => {
  for (const route of routes) {
    const file = route.path.endsWith('.html') ? route.path.slice(1) : route.path.slice(1) + 'index.html';
    const html = readFileSync(resolve(dist, file), 'utf8');
    const base = html.match(/<meta name="site-base" content="([^"]+)"/)?.[1] ?? '/';
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = new URL(match[1].replaceAll('&amp;', '&'), `https://site.example${base}${file}`);
      if (url.origin !== 'https://site.example') continue;
      expect(url.pathname.startsWith(base)).toBe(true);
      const path = decodeURIComponent(url.pathname.slice(base.length));
      if (path === 'playground/themes.html') continue;
      const target = resolve(dist, path.endsWith('/') || !path ? path + 'index.html' : path);
      expect(existsSync(target), `${file} → ${match[1]}`).toBe(true);
      if (url.hash && target.endsWith('.html')) expect(readFileSync(target, 'utf8'), `${file} → ${match[1]}`).toContain(`id="${decodeURIComponent(url.hash.slice(1))}"`);
    }
  }
});

test('deployment paths normalize slashes and reject non-path bases', () => {
  expect(normalizeBase()).toBe('/');
  expect(normalizeBase('/prism-ui')).toBe('/prism-ui/');
  expect(sitePath('/prism-ui/', '/components/num/')).toBe('/prism-ui/components/num/');
  for (const base of ['https://example.com/', '//example.com/', '../docs', '/a/../', '/a?b', '/a#b', '/a\\b', '/<script>', '/a"b', '/a b']) expect(() => normalizeBase(base)).toThrow();
});
