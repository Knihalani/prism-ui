import { sitePath } from './paths';

export const docOrder = ['integration', 'prompting', 'renderers', 'theming', 'motion', 'design'];
export type Heading = { id: string; title: string; level: number };
export function Documentation({ html, toc, slug, base }: { html: string; toc: Heading[]; slug: string; base: string }) {
  const index = docOrder.indexOf(slug);
  const links = <ol>{toc.map(heading => <li key={heading.id} data-level={heading.level}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol>;
  return <><nav className="doc-nav" aria-label="Documentation">{docOrder.map(name => <a key={name} href={sitePath(base, `docs/${name}/`)} aria-current={slug === name ? 'page' : undefined}>{name}</a>)}</nav><div className="doc-layout"><details className="doc-toc"><summary>On this page</summary><nav aria-label="On this page">{links}</nav></details><aside className="doc-toc-wide"><p>On this page</p><nav aria-label="On this page">{links}</nav></aside><article className="prose" dangerouslySetInnerHTML={{ __html: html }} /></div><nav className="doc-pagination" aria-label="Documentation pagination">{index > 0 ? <a rel="prev" href={sitePath(base, `docs/${docOrder[index - 1]}/`)}>← {docOrder[index - 1]}</a> : <span />}{index < docOrder.length - 1 && <a rel="next" href={sitePath(base, `docs/${docOrder[index + 1]}/`)}>{docOrder[index + 1]} →</a>}</nav></>;
}
