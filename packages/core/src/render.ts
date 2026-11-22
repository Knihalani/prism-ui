import type { Node, Root } from './ast';
import { safeUrl } from './values';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export interface StringOptions { components?: Record<string, (node: Node, children: string) => string> }
export function renderToString(ast: Node, options: StringOptions = {}): string {
  function render(node: Node): string {
    const children = () => node.children?.map(render).join('') ?? '';
    const tag = (name: string, attrs = '') => `<${name}${attrs}>${children()}</${name}>`;
    switch (node.type) {
      case 'root': return children();
      case 'text': return escapeHtml(node.value ?? '');
      case 'reference': case 'imageReference': return escapeHtml(node.value ?? '');
      case 'paragraph': return tag('p');
      case 'heading': return tag(`h${Math.min(6, Math.max(1, node.depth ?? 1))}`);
      case 'emphasis': return tag('em'); case 'strong': return tag('strong'); case 'delete': return tag('del');
      case 'break': return '<br>'; case 'thematicBreak': return '<hr>';
      case 'inlineCode': return `<code>${escapeHtml(node.value ?? '')}</code>`;
      case 'code': return `<pre><code${node.lang ? ` class="language-${escapeHtml(node.lang)}"` : ''}>${escapeHtml(node.value ?? '')}</code></pre>`;
      case 'blockquote': return tag('blockquote');
      case 'list': return tag(node.ordered ? 'ol' : 'ul', node.ordered && node.start !== 1 ? ` start="${Number(node.start) || 1}"` : '');
      case 'listItem': return `<li>${node.checked === undefined ? '' : `<input type="checkbox" disabled${node.checked ? ' checked' : ''}>`}${children()}</li>`;
      case 'link': return tag('a', ` href="${escapeHtml(safeUrl(node.url ?? ''))}"${node.title ? ` title="${escapeHtml(node.title)}"` : ''}`);
      case 'image': return `<img src="${escapeHtml(safeUrl(node.url ?? '', true))}" alt="${escapeHtml(node.value ?? '')}"${node.title ? ` title="${escapeHtml(node.title)}"` : ''}>`;
      case 'table': {
        const rows = node.children ?? [];
        const row = (r: Node) => `<tr>${r.children?.map((c, i) => { const t = c.type === 'tableHeader' ? 'th' : 'td'; return `<${t}${node.align?.[i] ? ` style="text-align:${node.align[i]}"` : ''}>${c.children?.map(render).join('') ?? ''}</${t}>`; }).join('') ?? ''}</tr>`;
        return `<table><thead>${rows[0] ? row(rows[0]) : ''}</thead><tbody>${rows.slice(1).map(row).join('')}</tbody></table>`;
      }
      case 'component': {
        const name = node.name ?? '';
        return options.components && Object.hasOwn(options.components, name) ? options.components[name](node, children()) : tag('div', ` data-prism-component="${escapeHtml(name)}"`);
      }
      default: return children();
    }
  }
  return render(ast);
}

export interface DOMOptions { components?: Record<string, (node: Node, document: Document) => globalThis.Node> }
export function mount(el: Element, options: DOMOptions = {}) {
  const document = el.ownerDocument;
  type Entry = { ast: Node; dom: globalThis.Node };
  let entries = new Map<string, Entry>();
  let initialized = false;
  function create(ast: Node): globalThis.Node {
    const component = ast.type === 'component' && options.components && Object.hasOwn(options.components, ast.name ?? '') && options.components[ast.name ?? ''];
    if (component) return component(ast, document);
    if (ast.type === 'text' || ast.type === 'reference' || ast.type === 'imageReference') return document.createTextNode(ast.value ?? '');
    if (ast.type === 'component') {
      const div = document.createElement('div'); div.dataset.prismComponent = ast.name ?? '';
      ast.children?.forEach(n => div.append(create(n))); return div;
    }
    // HTML comes exclusively from the escaping renderer, never from source HTML.
    const template = document.createElement('template');
    template.innerHTML = renderToString({ ...ast, children: [] });
    const dom = template.content.firstChild ?? document.createTextNode('');
    if (ast.type === 'table' || ast.type === 'code' || ast.type === 'inlineCode' || ast.type === 'image') {
      template.innerHTML = renderToString(ast); return template.content.firstChild!;
    }
    ast.children?.forEach(n => dom.appendChild(create(n))); return dom;
  }
  return {
    update(root: Root) {
      if (!initialized) { el.replaceChildren(); initialized = true; }
      const next = new Map<string, Entry>(); let cursor: globalThis.Node | null = el.firstChild;
      for (const ast of root.children) {
        const old = entries.get(ast.key); let entry: Entry;
        if (old?.ast === ast) entry = old;
        else { entry = { ast, dom: create(ast) }; if (old) { el.replaceChild(entry.dom, old.dom); if (cursor === old.dom) cursor = entry.dom; } }
        if (entry.dom !== cursor) el.insertBefore(entry.dom, cursor);
        cursor = entry.dom.nextSibling; next.set(ast.key, entry);
      }
      for (const [key, entry] of entries) if (!next.has(key)) el.removeChild(entry.dom);
      entries = next;
    },
  };
}
