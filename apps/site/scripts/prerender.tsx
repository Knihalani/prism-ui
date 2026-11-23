import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRoutes } from '../src/routes';
import { normalizeBase } from '../src/paths';
import { renderPage } from './render';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const base = normalizeBase(process.env.SITE_BASE), template = await readFile(resolve(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8')) as Record<string, { file: string; css?: string[]; imports?: string[] }>;
function islandStyles(key: string, seen = new Set<string>()): string[] {
  if (seen.has(key)) return [];
  seen.add(key);
  const entry = manifest[key];
  if (!entry) throw new Error(`Missing island in Vite manifest: ${key}`);
  return [...new Set([...(entry.css ?? []), ...(entry.imports ?? []).flatMap(key => islandStyles(key, seen))])];
}
for (const route of getRoutes()) {
  const file = resolve(dist, route.path === '/404.html' ? '404.html' : route.path.slice(1) + 'index.html');
  await mkdir(dirname(file), { recursive: true });
  const entry = route.kind === 'home' ? 'src/islands/hero.tsx' : route.kind === 'component' ? `src/islands/${route.name}.tsx` : route.kind === 'gallery' ? 'src/preview-styles.ts' : undefined;
  const styles = entry ? islandStyles(entry).map(file => `<link rel="stylesheet" href="${base}${file}">`).join('') : '';
  await writeFile(file, renderPage(route, template.replace('</head>', styles + '</head>'), base));
}
console.log(`Prerendered ${getRoutes().length} routes at ${base}`);
