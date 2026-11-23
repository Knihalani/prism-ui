import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { Site } from '../src/site';
import { Hero } from '../src/islands/hero';
import { docsDirectory, type SiteRoute } from '../src/routes';
import { sitePath } from '../src/paths';

export function renderDocument(file: string, base: string) {
  const md = new MarkdownIt({ highlight: (code, language) => language && hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : '' });
  const link = md.renderer.rules.link_open ?? ((tokens, index, options, _, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index], href = token.attrGet('href') ?? '';
    if (href && !/^(?:[a-z]+:|\/\/|#)/i.test(href)) {
      const [path, fragment] = href.split('#'), target = resolve(docsDirectory, path);
      token.attrSet('href', dirname(target) === docsDirectory && target.endsWith('.md')
        ? sitePath(base, `docs/${basename(target, '.md').toLowerCase()}/${fragment ? '#' + fragment : ''}`)
        : `https://github.com/Knihalani/prism-ui/blob/main/${new URL(href, 'https://example.com/docs/').pathname.slice(1)}`);
    }
    return link(tokens, index, options, env, self);
  };
  const used = new Map<string, number>();
  md.renderer.rules.heading_open = (tokens, index, options, _, self) => {
    const slug = (tokens[index + 1].content ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
    const count = used.get(slug) ?? 0; used.set(slug, count + 1);
    tokens[index].attrSet('id', slug + (count ? '-' + count : ''));
    return self.renderToken(tokens, index, options);
  };
  const image = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index], src = token.attrGet('src') ?? '';
    if (!/^(?:[a-z]+:|\/\/)/i.test(src)) token.attrSet('src', `https://raw.githubusercontent.com/Knihalani/prism-ui/main${new URL(src, 'https://example.com/docs/').pathname}`);
    token.attrSet('loading', 'lazy');
    return image(tokens, index, options, env, self);
  };
  return md.render(readFileSync(resolve(docsDirectory, file), 'utf8'));
}

export function renderPage(route: SiteRoute, template: string, base: string) {
  const content = renderToString(<Site route={route} base={base}
    heroHtml={route.kind === 'home' ? renderToString(<Hero />, { identifierPrefix: 'hero-' }) : ''}
    docHtml={route.file ? renderDocument(route.file, base) : ''} />);
  const title = `${route.title} — Prism`.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return template.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`).replace('</head>', `<meta name="site-base" content="${base}"></head>`).replace('<!--site-->', content);
}
