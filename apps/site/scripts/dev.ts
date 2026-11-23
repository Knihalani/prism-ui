import { createServer } from 'vite';
import { getRoutes } from '../src/routes';
import { normalizeBase } from '../src/paths';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderPage } from './render';

const root = fileURLToPath(new URL('../', import.meta.url)), base = normalizeBase(process.env.SITE_BASE);
const server = await createServer({ root, server: { host: '0.0.0.0' }, appType: 'custom' });
server.middlewares.use(async (request, response, next) => {
  try {
    const path = new URL(request.url ?? '/', 'http://site.local').pathname;
    if (!path.startsWith(base)) return next();
    const routePath = '/' + path.slice(base.length);
    const route = getRoutes().find(item => item.path === routePath);
    if (!route && /\.[a-z0-9]+$/i.test(path) && !path.endsWith('.html')) return next();
    const template = await server.transformIndexHtml(path, await readFile(resolveIndex(), 'utf8'));
    response.statusCode = route ? 200 : 404;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(renderPage(route ?? getRoutes().find(item => item.kind === '404')!, template, base));
  } catch (error) { next(error as Error); }
});
function resolveIndex() { return fileURLToPath(new URL('../index.html', import.meta.url)); }
await server.listen(); server.printUrls();
