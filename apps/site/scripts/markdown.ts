import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { basename, dirname, resolve } from 'node:path';
import { sitePath } from '../src/paths';
import type { Heading } from '../src/docs';

export function markdownDocument(source: string, base: string, directory: string) {
  const md = new MarkdownIt({ highlight: (code, language) => language && hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : '' });
  const toc: Heading[] = [], used = new Map<string, number>(), headingIds: string[] = [];
  const link = md.renderer.rules.link_open ?? ((tokens, index, options, _, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index], href = token.attrGet('href') ?? '';
    if (href && !/^(?:[a-z]+:|\/\/|#)/i.test(href)) {
      const url = new URL(href, 'https://example.com/docs/'), target = resolve(directory, decodeURIComponent(url.pathname.slice('/docs/'.length)));
      token.attrSet('href', url.pathname.startsWith('/docs/') && dirname(target) === directory && target.endsWith('.md')
        ? sitePath(base, `docs/${basename(target, '.md').toLowerCase()}/${url.search}${url.hash}`)
        : `https://github.com/Knihalani/prism-ui/blob/main${url.pathname}${url.search}${url.hash}`);
    }
    return link(tokens, index, options, env, self);
  };
  md.renderer.rules.heading_open = (tokens, index, options, _, self) => {
    const title = tokens[index + 1].content ?? '', slug = title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
    const count = used.get(slug) ?? 0; used.set(slug, count + 1);
    const id = slug + (count ? '-' + count : ''); headingIds.push(id); tokens[index].attrSet('id', id);
    const level = Number(tokens[index].tag.slice(1)); if (level === 2 || level === 3) toc.push({ id, title: title.replace(/[`*_]/g, ''), level });
    return self.renderToken(tokens, index, options);
  };
  md.renderer.rules.heading_close = (tokens, index, options, _, self) => `<a class="heading-anchor" href="#${headingIds.pop()}" aria-label="Link to section">#</a>${self.renderToken(tokens, index, options)}`;
  const fence = md.renderer.rules.fence!; let codeIndex = 0;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const id = `doc-code-${codeIndex++}`, language = md.utils.escapeHtml(tokens[index].info.split(/\s/)[0] || 'Code');
    return `<div class="doc-code"><div class="code-heading"><span>${language}</span><button class="text-button" type="button" data-copy="${id}" hidden>Copy</button></div>${fence(tokens, index, options, env, self).replace('<code', `<code id="${id}"`)}</div>`;
  };
  const image = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index], src = token.attrGet('src') ?? '';
    if (!/^(?:[a-z]+:|\/\/)/i.test(src)) token.attrSet('src', `https://raw.githubusercontent.com/Knihalani/prism-ui/main${new URL(src, 'https://example.com/docs/').pathname}`);
    token.attrSet('loading', 'lazy'); return image(tokens, index, options, env, self);
  };
  return { html: md.render(source), toc };
}
