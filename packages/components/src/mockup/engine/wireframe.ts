export type WireModifier = 'center' | 'right' | 'dark' | 'sticky';
export interface WireNode {
  key: string;
  line: number;
  kind: string;
  args: string[];
  content: string;
  modifiers: WireModifier[];
  repeat: number;
  children: WireNode[];
}
export interface WireTokens {
  ink: string;
  muted: string;
  fill: string;
  paper: string;
  line: string;
  radius: string;
  font: string;
  gap: string;
}
export interface WireframeOptions {
  sketch?: boolean;
  className?: string;
  tokens?: Partial<WireTokens>;
}

export function parseWireframe(src: string): WireNode[] {
  const containers = new Set('nav header hero section footer sidebar row col stack grid split card form modal page'.split(' '));
  const kinds = new Set([...containers, ...'text img icon avatar input textarea select check radio toggle search badge table chart video map list tabs breadcrumb pagination spacer'.split(' ')]);
  const modifiers = new Set(['center', 'right', 'dark', 'sticky']);
  const roots: WireNode[] = [], parents: { indent: number; node: WireNode }[] = [];
  const split = (text: string, separator: string): string[] => {
    const parts: string[] = [];
    let start = 0, quote = '', depth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '[' || char === '(') depth++;
      else if (char === ']' || char === ')') depth = Math.max(0, depth - 1);
      else if (!depth && char === separator && (char !== '/' || /\s/.test(text[i - 1] ?? '') || /\s/.test(text[i + 1] ?? ''))) {
        parts.push(text.slice(start, i).trim()); start = i + 1;
      }
    }
    parts.push(text.slice(start).trim());
    return parts;
  };
  const parse = (source: string, key: string, line: number, inline = false): WireNode => {
    const node: WireNode = { key, line, kind: 'label', args: [], content: '', modifiers: [], repeat: 1, children: [] };
    let text = source.trim();
    if (inline) {
      for (const separator of ['/', '|']) {
        const parts = split(text, separator);
        if (parts.length > 1) {
          node.kind = separator === '/' ? 'stack' : 'row';
          node.children = parts.map((part, index) => parse(part, `${key}-i${index}`, line, true));
          return node;
        }
      }
    }
    if (text.startsWith('"') || text.startsWith("'")) {
      node.content = text.slice(1, text.endsWith(text[0]!) && text.length > 1 ? -1 : undefined);
      return node;
    }
    let colon = -1;
    if (!['#', '[', '('].includes(text[0] ?? '')) {
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ':' && !(i > 0 && /\d/.test(text[i - 1]!) && /\d/.test(text[i + 1] ?? ''))) { colon = i; break; }
      }
    }
    const headText = colon < 0 ? text : text.slice(0, colon);
    const repeat = /\*(\d*)$/.exec(headText.trimEnd());
    if (repeat) {
      node.repeat = repeat[1] ? Math.min(24, Number(repeat[1])) : 1;
      const remainder = colon < 0 ? '' : text.slice(colon);
      text = headText.slice(0, repeat.index).trimEnd() + remainder;
      if (colon >= 0) colon = text.length - remainder.length;
    }
    if (text.startsWith('#')) {
      let count = 0;
      while (text[count] === '#') count++;
      node.kind = `h${Math.min(3, count)}`; node.content = text.slice(count).trim(); return node;
    }
    if (text.startsWith('[')) {
      const primary = text.startsWith('[[');
      node.kind = primary ? 'primary' : 'button';
      let end = text.length;
      while (text[end - 1] === ']') end--;
      node.content = text.slice(primary ? 2 : 1, end).trim(); return node;
    }
    if (text.startsWith('(')) {
      let end = text.length;
      while (text[end - 1] === ')') end--;
      node.kind = 'link'; node.content = text.slice(1, end).trim(); return node;
    }
    if (text === '---') { node.kind = 'divider'; return node; }
    const head = (colon < 0 ? text : text.slice(0, colon)).trim().split(/\s+/);
    const name = head.shift() ?? '';
    const kind = name.toLowerCase();
    if (!kinds.has(kind)) {
      if (colon >= 0 || (!inline && head.length === 0 && kind)) {
        node.kind = 'unknown'; node.args = [name, ...head]; node.content = colon >= 0 ? text.slice(colon + 1).trim() : '';
      } else node.content = text;
      return node;
    }
    node.kind = kind;
    for (const arg of head) {
      if (modifiers.has(arg)) node.modifiers.push(arg as WireModifier);
      else node.args.push(arg);
    }
    const content = colon < 0 ? '' : text.slice(colon + 1).trim();
    if (containers.has(kind) || kind === 'tabs') {
      if (content) node.children = [parse(content, `${key}-c`, line, true)];
    } else node.content = content;
    return node;
  };
  let offset = 0, line = 0;
  while (offset <= src.length) {
    const end = src.indexOf('\n', offset);
    const text = src.slice(offset, end < 0 ? src.length : end).replace(/\r$/, '');
    let start = 0, indent = 0;
    while (text[start] === ' ' || text[start] === '\t') { indent += text[start] === '\t' ? 2 : 1; start++; }
    const content = text.slice(start).trim();
    if (content && !content.startsWith('//')) {
      while (parents.length && parents[parents.length - 1]!.indent >= indent) parents.pop();
      const node = parse(content, `pwf-l${line}`, line);
      (parents.length ? parents[parents.length - 1]!.node.children : roots).push(node);
      if (containers.has(node.kind)) parents.push({ indent, node });
    }
    line++;
    if (end < 0) break;
    offset = end + 1;
  }
  return roots;
}

function wireTokenStyle(tokens: Partial<WireTokens> = {}): string {
  const names: (keyof WireTokens)[] = ['ink', 'muted', 'fill', 'paper', 'line', 'radius', 'font', 'gap'];
  return names.flatMap(name => {
    const value = tokens[name];
    return typeof value === 'string' && !/[;{}<>\\]|url\s*\(|expression\s*\(|@|\/\*/i.test(value) ? [`--pwf-${name}:${value}`] : [];
  }).join(';');
}

export function renderWireframe(srcOrNodes: string | WireNode[], opts: WireframeOptions = {}): string {
  const nodes = typeof srcOrNodes === 'string' ? parseWireframe(srcOrNodes) : srcOrNodes;
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const number = (value: string | undefined, fallback: number, max = 24) => Math.max(1, Math.min(max, Number.parseInt(value ?? '', 10) || fallback));
  const draw = (node: WireNode, suffix = ''): string => {
    const count = Number.isFinite(node.repeat) ? Math.max(0, Math.min(24, Math.floor(node.repeat))) : 1;
    return Array.from({ length: count }, (_, repeat) => {
      const key = node.key + suffix + (repeat ? `-r${repeat}` : '');
      const kind = node.kind;
      const attrs = `data-key="${escape(key)}" class="pwf-${escape(kind)}${node.modifiers.map(mod => ` pwf-${escape(mod)}`).join('')}"`;
      const children = () => `<div class="pwf-children" data-key="${escape(key)}-children">${node.children.map(child => draw(child, `${suffix}-p${repeat}`)).join('')}</div>`;
      const label = escape(node.content || node.args.join(' '));
      const tag = (name: string, content: string, extra = '') => `<${name} ${attrs}${extra}>${content}</${name}>`;
      const bars = (n: number) => Array.from({ length: n }, (_, i) => `<span class="pwf-bar" data-key="${escape(key)}-bar${i}"></span>`).join('');
      const image = (name: string) => `<svg viewBox="0 0 48 40" fill="none" aria-hidden="true" data-key="${escape(key)}-symbol"><rect x="3" y="3" width="42" height="34" rx="3"/><circle cx="33" cy="13" r="4"/><path d="m4 30 12-13 12 13 7-7 10 11"/></svg><span>${name}</span>`;
      if (/^h[123]$/.test(kind)) return tag(kind, label || 'Heading');
      if (kind === 'label') return tag('p', label || '&nbsp;');
      if (kind === 'button' || kind === 'primary') return tag('button', label || 'Button', ' type="button"');
      if (kind === 'link') return tag('a', label || 'Link', ' href="#"');
      if (kind === 'divider') return `<hr ${attrs}>`;
      if (kind === 'text') return tag('div', bars(1), ' aria-label="Text placeholder"');
      if (kind === 'icon') return tag('span', '<span aria-hidden="true">✳</span>', ' aria-label="Icon placeholder"');
      if (kind === 'avatar') return tag('span', '<span aria-hidden="true">○</span>', ' aria-label="Avatar placeholder"');
      if (kind === 'badge') return tag('span', label || 'Label');
      if (kind === 'spacer') return tag('div', '', ' aria-hidden="true"');
      if (kind === 'img' || kind === 'video' || kind === 'map') {
        const ratio = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(node.args[0] ?? '');
        const aspect = ratio && Number(ratio[2]) > 0 ? Math.max(0.2, Math.min(5, Number(ratio[1]) / Number(ratio[2]))) : 16 / 9;
        return tag('div', kind === 'video' ? '<span class="pwf-play">▷</span><span>Video</span>' : image(kind === 'map' ? 'Map preview' : 'Image'), ` role="img" aria-label="${kind} placeholder" style="aspect-ratio:${aspect}"`);
      }
      if (['input', 'textarea', 'select', 'search'].includes(kind)) {
        const title = label || (kind === 'search' ? 'Search' : 'Label');
        const field = kind === 'textarea' ? `<textarea readonly placeholder="${title}" rows="3"></textarea>`
          : kind === 'select' ? `<select aria-label="${title}"><option>${title}</option></select>`
          : `<input type="${kind === 'search' ? 'search' : 'text'}" readonly placeholder="${kind === 'search' ? 'Search anything…' : title}">`;
        return tag('label', (kind === 'search' ? '' : `<span>${title}</span>`) + field);
      }
      if (['check', 'radio', 'toggle'].includes(kind)) return tag('label', `<span class="pwf-control" aria-hidden="true"></span><span>${label || 'Option'}</span>`);
      if (kind === 'table') {
        const dimensions = /^(\d+)x(\d+)$/i.exec(node.args[0] ?? '');
        const cols = number(dimensions?.[1], 3, 12), rows = number(dimensions?.[2], 4, 24);
        return tag('div', `<table><thead><tr>${Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: rows }, (_, r) => `<tr data-key="${escape(key)}-row${r}">${Array.from({ length: cols }, (_, c) => `<td><span class="pwf-bar" style="width:${55 + (r + c) % 3 * 15}%"></span></td>`).join('')}</tr>`).join('')}</tbody></table>`);
      }
      if (kind === 'chart') {
        const type = node.args[0] ?? 'bar';
        const content = type === 'pie' ? '<div class="pwf-pie"></div>' : type === 'line'
          ? '<svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90 40 64 80 75 120 32 160 45 200 12 250 30 300 4"/></svg>'
          : [35, 58, 44, 76, 64, 92, 80].map(height => `<span style="height:${height}%"></span>`).join('');
        return tag('div', `<div class="pwf-plot pwf-plot-${type === 'pie' ? 'pie' : type === 'line' ? 'line' : 'bar'}">${content}</div><span class="pwf-caption">${escape(type)} chart</span>`);
      }
      if (kind === 'list') return tag('ul', Array.from({ length: number(node.args[0], 3) }, (_, i) => `<li data-key="${escape(key)}-item${i}"><span class="pwf-list-dot"></span><span class="pwf-bar"></span></li>`).join(''));
      if (kind === 'breadcrumb') return tag('nav', 'Home <span>/</span> Collection <span>/</span> Current page', ' aria-label="Breadcrumb"');
      if (kind === 'pagination') return tag('nav', '<span>←</span><span class="pwf-current">1</span><span>2</span><span>3</span><span>…</span><span>→</span>', ' aria-label="Pagination"');
      if (kind === 'unknown') return tag('div', `<span class="pwf-caption">${escape(node.args.join(' '))}</span>${node.content ? `<p>${escape(node.content)}</p>` : ''}`);
      const title = kind === 'section' && node.args.length ? `<h2 class="pwf-section-title">${escape(node.args.join(' '))}</h2>` : '';
      let extra = '';
      if (kind === 'grid') extra = ` style="--pwf-cols:${number(node.args[0], 3, 12)}"`;
      if (kind === 'split') {
        const ratio = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(node.args[0] ?? '');
        extra = ` style="--pwf-split:${number(ratio?.[1], 1)}fr ${number(ratio?.[2], 1)}fr"`;
      }
      if (kind === 'page' && node.args.includes('mobile')) extra = ' style="max-width:390px"';
      const content = node.children.length ? children() : kind === 'card' ? `<div class="pwf-empty-card"><span class="pwf-card-mark">◇</span>${bars(3)}</div>` : '';
      const element = kind === 'nav' || kind === 'header' || kind === 'footer' || kind === 'form' ? kind : kind === 'sidebar' ? 'aside' : 'div';
      return tag(element, title + content, extra);
    }).join('');
  };
  const style = wireTokenStyle(opts.tokens);
  return `<div class="pwf-root${opts.sketch ? ' pwf-sketch' : ''}${opts.className ? ` ${escape(opts.className)}` : ''}" data-key="pwf-root"${style ? ` style="${escape(style)}"` : ''}><div class="pwf-children" data-key="pwf-content">${nodes.map(node => draw(node)).join('')}</div></div>`;
}

export function wireframeCss(opts: WireframeOptions = {}): string {
  const custom = wireTokenStyle(opts.tokens);
  return `.pwf-root{--pwf-ink:#292929;--pwf-muted:#7b7b7b;--pwf-fill:#eeeeee;--pwf-paper:#fff;--pwf-line:#dcdcdc;--pwf-radius:10px;--pwf-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--pwf-gap:20px;${custom};color:var(--pwf-ink);background:#f5f5f5;font:14px/1.6 var(--pwf-font);padding:32px;min-height:100vh}
.pwf-root *{box-sizing:border-box}
.pwf-root :where(p,h1,h2,h3,ul){margin:0}
.pwf-root button,.pwf-root input,.pwf-root textarea,.pwf-root select{font:inherit;color:inherit}
.pwf-root button,.pwf-root a,.pwf-root input,.pwf-root textarea,.pwf-root select{outline-offset:4px}
.pwf-children{display:flex;flex-direction:column;gap:var(--pwf-gap);min-width:0}
.pwf-children>*{min-width:0}
.pwf-page{max-width:1160px;width:100%;margin:auto;background:var(--pwf-paper);border:1px solid var(--pwf-line);border-radius:calc(var(--pwf-radius)*1.4);overflow:hidden;box-shadow:0 12px 40px #29292908}
.pwf-page>.pwf-children{gap:0}
.pwf-nav,.pwf-header,.pwf-footer{padding:22px 36px}
.pwf-nav,.pwf-header{border-bottom:1px solid var(--pwf-line)}
.pwf-nav>.pwf-children>.pwf-row>.pwf-children{align-items:center}
.pwf-nav .pwf-label:first-child{font-weight:750;letter-spacing:.08em;margin-right:auto}
.pwf-nav .pwf-row{width:100%}
.pwf-nav .pwf-link{color:var(--pwf-muted);font-size:13px}
.pwf-footer{border-top:1px solid var(--pwf-line);font-size:12px;color:var(--pwf-muted)}
.pwf-footer .pwf-row>.pwf-children>:first-child{margin-right:auto}
.pwf-section{padding:32px 36px}
.pwf-section-title{font-size:20px;font-weight:650;letter-spacing:-.035em;margin-bottom:22px}
.pwf-hero{padding:32px 0}
.pwf-hero .pwf-children{gap:22px}
.pwf-h1{font-size:clamp(32px,4.2vw,54px);line-height:1.12;font-weight:650;letter-spacing:-.055em;max-width:700px;text-wrap:balance}
.pwf-h2{font-size:25px;line-height:1.25;font-weight:650;letter-spacing:-.04em}
.pwf-h3{font-size:17px;font-weight:650;line-height:1.4;letter-spacing:-.02em}
.pwf-label{line-height:1.7}
.pwf-hero .pwf-label{color:var(--pwf-muted);font-size:16px;max-width:480px}
.pwf-row>.pwf-children{flex-direction:row;align-items:center;flex-wrap:wrap;gap:14px}
.pwf-col>.pwf-children,.pwf-stack>.pwf-children{gap:14px}
.pwf-grid>.pwf-children{display:grid;grid-template-columns:repeat(var(--pwf-cols,3),minmax(0,1fr))}
.pwf-split>.pwf-children{display:grid;grid-template-columns:var(--pwf-split,1fr 1fr);align-items:center;gap:36px}
.pwf-card{border:1px solid var(--pwf-line);border-radius:var(--pwf-radius);padding:22px;background:var(--pwf-paper)}
.pwf-card>.pwf-children{gap:14px}
.pwf-card .pwf-img{border-radius:calc(var(--pwf-radius)*.65)}
.pwf-empty-card{display:flex;flex-direction:column;gap:12px;padding:12px 0}
.pwf-card-mark{font-size:32px;line-height:1;margin-bottom:12px;color:var(--pwf-muted)}
.pwf-bar{display:block;height:8px;width:92%;max-width:100%;border-radius:3px;background:var(--pwf-line)}
.pwf-text:nth-child(3n) .pwf-bar,.pwf-empty-card .pwf-bar:last-child{width:62%}
.pwf-text{padding:3px 0;min-width:48px}
.pwf-text+.pwf-text{margin-top:-10px}
.pwf-img,.pwf-video,.pwf-map{border:1px solid var(--pwf-line);border-radius:var(--pwf-radius);background:linear-gradient(135deg,#e9e9e9,#f2f2f2);color:#969696;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;overflow:hidden;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.pwf-img svg,.pwf-map svg{width:48px;stroke:currentColor;stroke-width:1.2}
.pwf-map{background:repeating-linear-gradient(25deg,transparent 0 28px,#dfdfdf 29px 30px),repeating-linear-gradient(115deg,#f1f1f1 0 48px,#dfdfdf 49px 50px)}
.pwf-play{font-size:42px;line-height:1}
.pwf-button,.pwf-primary{border:1px solid var(--pwf-line);border-radius:6px;padding:10px 18px;line-height:1.4;background:var(--pwf-paper);font-weight:600;cursor:pointer;font-size:13px;white-space:nowrap;align-self:flex-start}
.pwf-primary{background:var(--pwf-ink);border-color:var(--pwf-ink);color:var(--pwf-paper)!important}
.pwf-link{color:inherit;text-decoration:none;text-underline-offset:4px}
.pwf-link:hover{text-decoration:underline}
.pwf-badge{display:inline-flex;align-self:flex-start;border:1px solid var(--pwf-line);border-radius:40px;padding:4px 10px;font-size:10px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;background:var(--pwf-fill)}
.pwf-avatar,.pwf-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;background:var(--pwf-fill);border:1px solid var(--pwf-line);width:36px;height:36px;border-radius:8px;font-size:23px;color:var(--pwf-muted)}
.pwf-avatar{border-radius:50%;width:42px;height:42px}
.pwf-input,.pwf-textarea,.pwf-select,.pwf-search{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:600}
.pwf-root :where(input,textarea,select){width:100%;border:1px solid var(--pwf-line);border-radius:6px;padding:11px 13px;background:var(--pwf-paper);line-height:1.4;min-width:0}
.pwf-root :where(input,textarea)::placeholder{color:var(--pwf-muted);font-weight:400}
.pwf-root textarea{resize:vertical}
.pwf-search{min-width:160px}
.pwf-check,.pwf-radio,.pwf-toggle{display:flex;align-items:center;gap:10px;font-size:13px}
.pwf-control{width:17px;height:17px;flex:none;border:1px solid var(--pwf-line);border-radius:4px;background:var(--pwf-paper)}
.pwf-radio .pwf-control{border-radius:50%}
.pwf-toggle .pwf-control{width:30px;border-radius:20px;background:var(--pwf-fill);position:relative}
.pwf-toggle .pwf-control::after{content:"";position:absolute;left:2px;top:2px;width:11px;height:11px;border-radius:50%;background:var(--pwf-muted)}
.pwf-form{max-width:640px}
.pwf-table{overflow:auto;border:1px solid var(--pwf-line);border-radius:var(--pwf-radius)}
.pwf-table table{border-collapse:collapse;width:100%;font-size:12px;text-align:left}
.pwf-table :where(th,td){padding:14px 18px;border-bottom:1px solid var(--pwf-line)}
.pwf-table th{background:var(--pwf-fill);font-weight:600}
.pwf-table tr:last-child td{border-bottom:0}
.pwf-table .pwf-bar{height:6px}
.pwf-chart{border:1px solid var(--pwf-line);border-radius:var(--pwf-radius);padding:24px}
.pwf-plot{height:140px;display:flex;gap:12px;align-items:flex-end;justify-content:center;border-bottom:1px solid var(--pwf-line);background:repeating-linear-gradient(to top,transparent 0 34px,var(--pwf-fill) 35px 36px)}
.pwf-plot-bar>span{flex:1;max-width:40px;background:#aeaeae;border-radius:3px 3px 0 0}
.pwf-plot-line svg{width:100%;height:90%;overflow:visible}
.pwf-plot-line path{stroke:var(--pwf-ink);stroke-width:2;fill:none;vector-effect:non-scaling-stroke}
.pwf-plot-pie{background:none;border:0;align-items:center}
.pwf-pie{width:130px;height:130px;border-radius:50%;background:conic-gradient(#575757 0 35%,#aeaeae 35% 68%,#dfdfdf 68% 100%);border:4px solid var(--pwf-paper)}
.pwf-caption{display:block;font-size:11px;letter-spacing:.04em;color:var(--pwf-muted);margin-top:8px}
.pwf-list{list-style:none;padding:0;display:flex;flex-direction:column;gap:17px}
.pwf-list li{display:flex;align-items:center;gap:12px}
.pwf-list-dot{height:7px;width:7px;border-radius:50%;background:var(--pwf-muted);flex:none}
.pwf-list .pwf-bar{width:75%}
.pwf-tabs{border-bottom:1px solid var(--pwf-line);padding:0 0 12px}
.pwf-tabs .pwf-row>.pwf-children{gap:28px}
.pwf-tabs .pwf-label:first-child{font-weight:650;position:relative}
.pwf-tabs .pwf-label:first-child::after{position:absolute;content:"";left:0;right:0;bottom:-13px;height:2px;background:var(--pwf-ink)}
.pwf-breadcrumb{display:flex;gap:12px;font-size:11px;color:var(--pwf-muted)}
.pwf-pagination{display:flex;gap:8px;align-items:center;justify-content:center;font-size:12px}
.pwf-pagination span{padding:4px 10px}
.pwf-current{border:1px solid var(--pwf-line);border-radius:4px;background:var(--pwf-fill)}
.pwf-divider{width:100%;margin:8px 0;border:0;border-top:1px solid var(--pwf-line)}
.pwf-spacer{height:32px}
.pwf-unknown{border:1px dashed var(--pwf-line);border-radius:var(--pwf-radius);padding:24px;background:var(--pwf-fill)}
.pwf-unknown .pwf-caption{margin:0}
.pwf-modal{max-width:480px;width:100%;margin:24px auto;padding:32px;border:1px solid var(--pwf-line);border-radius:var(--pwf-radius);background:var(--pwf-paper);box-shadow:0 20px 70px #29292922}
.pwf-sidebar{padding:24px;border-right:1px solid var(--pwf-line)}
.pwf-children:has(>.pwf-sidebar:not(:last-child)){display:grid;grid-template-columns:210px minmax(0,1fr);align-items:start}
.pwf-children:has(>.pwf-sidebar:not(:last-child))>.pwf-sidebar{grid-column:1;grid-row:1/span 99;align-self:stretch}
.pwf-children:has(>.pwf-sidebar:not(:last-child))>:not(.pwf-sidebar){grid-column:2}
.pwf-center{text-align:center}
.pwf-center>.pwf-children{align-items:center}
.pwf-row.pwf-center>.pwf-children{justify-content:center}
.pwf-right{text-align:right}
.pwf-right>.pwf-children{align-items:flex-end}
.pwf-row.pwf-right>.pwf-children{justify-content:flex-end}
.pwf-dark{--pwf-ink:#f3f3f3;--pwf-muted:#afafaf;--pwf-fill:#3d3d3d;--pwf-paper:#292929;--pwf-line:#555555;color:var(--pwf-ink);background:var(--pwf-paper);padding:28px;border-radius:var(--pwf-radius)}
.pwf-sticky{position:sticky;top:0;z-index:1}
.pwf-sketch{--pwf-font:"Comic Neue","Segoe Print","Bradley Hand","Comic Sans MS","DejaVu Sans",sans-serif;--pwf-radius:3px;background:#f7f7f7;font-style:normal;letter-spacing:.01em}
.pwf-sketch :where(.pwf-page,.pwf-card,.pwf-img,.pwf-video,.pwf-map,.pwf-modal,.pwf-input input,.pwf-textarea textarea,.pwf-button,.pwf-primary,.pwf-chart){border-radius:12px 4px 16px 5px / 5px 15px 6px 12px;border-style:dashed;border-color:#959595}
.pwf-sketch .pwf-card:nth-child(3n+1){transform:rotate(-.35deg)}
.pwf-sketch .pwf-card:nth-child(3n+2){transform:rotate(.3deg)}
.pwf-sketch .pwf-img{background:#eeeeee;transform:rotate(-.3deg)}
.pwf-sketch .pwf-h1{letter-spacing:-.045em;font-weight:600;transform:rotate(-.6deg)}
.pwf-sketch .pwf-primary{border-style:solid;box-shadow:2px 3px 0 #989898}
.pwf-sketch .pwf-bar{border-radius:45% 12% 35% 15%;background:#d9d9d9}
.pwf-sketch .pwf-page{box-shadow:1px 2px 0 1px #fff,2px 3px 0 2px #aaa,5px 7px 0 #e1e1e1}
.pwf-sketch .pwf-card{box-shadow:1px 2px 0 #fff,2px 3px 0 #aaa}
@media(max-width:600px){.pwf-root{padding:12px;font-size:13px}
.pwf-nav,.pwf-header,.pwf-footer,.pwf-section{padding:20px}
.pwf-grid>.pwf-children,.pwf-split>.pwf-children{grid-template-columns:1fr}
.pwf-nav .pwf-row>.pwf-children{gap:12px}
.pwf-nav .pwf-label:first-child{width:100%}
.pwf-h1{font-size:36px}
.pwf-hero{padding:16px 0}
.pwf-children:has(>.pwf-sidebar:not(:last-child)){grid-template-columns:1fr}
.pwf-children:has(>.pwf-sidebar:not(:last-child))>.pwf-sidebar{grid-row:auto;grid-column:1;border-right:0;border-bottom:1px solid var(--pwf-line)}
.pwf-children:has(>.pwf-sidebar:not(:last-child))>:not(.pwf-sidebar){grid-column:1}}`;
}

export function wireframeDocument(src: string | WireNode[], opts: WireframeOptions = {}): string {
  return `<style data-prism="wireframe">${wireframeCss(opts)}</style>${renderWireframe(src, opts)}`;
}

export const WIREFRAME_DOCS = `## Wireframe shorthand
One element per line. Two spaces or a tab nests inside a container.
Write kind args: content. Quotes force literal text; plain sentences are labels.
Inside content: | makes a row; spaced / stacks. #, ##, ### make headings.
[Button], [[Primary]], (Link), --- divider. Add *N to repeat (max 24).
Containers: page [mobile|desktop], nav, header, hero, section [title], footer,
sidebar (beside its following siblings), row, col, stack, grid N, split 1:2,
card, form, modal. Modifiers: center, right, dark, sticky.
Tokens: text, img 16:9, icon, avatar, input: Label, textarea: Label,
select: Label, check: Label, radio: Label, toggle: Label, search, badge: X,
table 3x4, chart [bar|line|pie], video, map, list N, tabs: A | B | C,
breadcrumb, pagination, spacer. Empty cards get placeholders.
Unknown kind: content makes a labelled box. // starts a comment line.
Partial last lines are welcome. No HTML or external assets needed.

\`\`\`wire
page desktop
  nav: "FORM / STUDIO" | (Discover) | (Collections) | [Get in touch]
  section
    split 3:2
      hero: badge: A little room to create / # Good things start with a little space. / Thoughtful tools for your next big idea. Bring your projects together, without the noise. / [[Explore the workspace]] | (See how it works →)
      img 4:3
  section Built for the way you work
    grid 3
      card
        icon
        ### Everything in its place
        "A clear home for ideas, files and the details that matter."
      card
        icon
        ### Make room for focus
        "Less busywork. More time for the work you love."
      card
        icon
        ### Better, together
        "Share early, gather feedback and move forward as one."
  section A few things taking shape
    grid 3
      card
        img 16:9
        badge: Brand design
        ### The everyday collection
        text*2
      card
        img 16:9
        badge: Digital experience
        ### A fresh perspective
        text*2
      card
        img 16:9
        badge: Creative direction
        ### Made for what comes next
        text*2
  footer: "FORM / STUDIO — Space for good work." | (Privacy) | (Contact)
\`\`\``;
