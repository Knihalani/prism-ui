export interface MorphOptions {
  childrenOnly?: boolean;
  key?: (element: Element) => string | null;
  onBeforeUpdate?: (from: Element, to: Element) => boolean;
  startAfter?: ChildNode | null;
}

export function morph(from: Element, to: Element, opts: MorphOptions = {}): void {
  const key = opts.key ?? ((el: Element) => el.getAttribute('id') || el.getAttribute('data-key'));
  const compatible = (a: Node, b: Node) => a.nodeType === b.nodeType && a.nodeName === b.nodeName;
  const skipped = new Set<Element>();
  const update = (a: Node, b: Node, childrenOnly = false): void => {
    if (a.nodeType !== 1) {
      if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      return;
    }
    const source = a as Element, target = b as Element;
    if (opts.onBeforeUpdate?.(source, target) === false) { skipped.add(source); return; }
    const ranged = source === from && opts.startAfter !== undefined;
    if (!ranged && source.isEqualNode(target)) return;
    const focused = source.ownerDocument.activeElement === source;
    const focusedValue = focused && 'value' in source ? (source as HTMLInputElement).value : undefined;
    const focusedChecked = focused && source.localName === 'input' ? (source as HTMLInputElement).checked : undefined;
    if (!childrenOnly) {
      for (const attr of Array.from(source.attributes)) {
        if (!target.hasAttributeNS(attr.namespaceURI, attr.localName)) source.removeAttributeNS(attr.namespaceURI, attr.localName);
      }
      for (const attr of Array.from(target.attributes)) {
        if (source.getAttributeNS(attr.namespaceURI, attr.localName) !== attr.value) source.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
      }
    }
    if (ranged || !source.isEqualNode(target)) {
      const keyed = new Map<string, Element>();
      const first = ranged ? opts.startAfter?.nextSibling ?? (opts.startAfter === null ? source.firstChild : null) : source.firstChild;
      for (let child = first; child; child = child.nextSibling) {
        const id = child.nodeType === 1 ? key(child as Element) : null;
        if (id !== null) keyed.set(id, child as Element);
      }
      let cursor: ChildNode | null = first;
      for (const desired of Array.from(target.childNodes)) {
        const id = desired.nodeType === 1 ? key(desired as Element) : null;
        let match: Node | undefined;
        if (id !== null) {
          const candidate = keyed.get(id);
          if (candidate && compatible(candidate, desired)) match = candidate;
          keyed.delete(id);
        } else {
          let candidate: ChildNode | null = cursor;
          while (candidate) {
            if (!(candidate.nodeType === 1 && key(candidate as Element) !== null) && compatible(candidate, desired)) {
              match = candidate;
              break;
            }
            candidate = candidate.nextSibling;
          }
        }
        if (!match) {
          match = desired.cloneNode(true);
          source.insertBefore(match, cursor);
        } else {
          if (match !== cursor) source.insertBefore(match, cursor);
          update(match, desired);
        }
        cursor = match.nextSibling;
      }
      while (cursor) {
        const next = cursor.nextSibling;
        source.removeChild(cursor);
        cursor = next;
      }
    }
    if (focusedValue !== undefined) (source as HTMLInputElement).value = focusedValue;
    if (focusedChecked !== undefined) (source as HTMLInputElement).checked = focusedChecked;
    if (!childrenOnly && !focused) {
      if (source.localName === 'input') {
        (source as HTMLInputElement).value = (target as HTMLInputElement).value;
        (source as HTMLInputElement).checked = (target as HTMLInputElement).checked;
      } else if (source.localName === 'textarea' || source.localName === 'select') {
        (source as HTMLTextAreaElement | HTMLSelectElement).value = (target as HTMLTextAreaElement | HTMLSelectElement).value;
      }
    }
  };
  update(from, to, opts.childrenOnly !== false);
  const controls: Element[] = [];
  let child = opts.startAfter === undefined || opts.startAfter === null ? from.firstChild : opts.startAfter.nextSibling;
  for (; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    if (element.matches('input, textarea, select')) controls.push(element);
    controls.push(...Array.from(element.querySelectorAll('input, textarea, select')));
  }
  if (opts.childrenOnly === false && from.matches('input, textarea, select')) controls.unshift(from);
  for (const control of controls) {
    if (control === from.ownerDocument.activeElement) continue;
    const path: number[] = [];
    let parent: Element | null = control;
    let skip = false;
    while (parent) {
      if (skipped.has(parent)) { skip = true; break; }
      if (parent === from) break;
      let index = Array.prototype.indexOf.call(parent.parentElement!.children, parent);
      if (parent.parentElement === from && opts.startAfter) {
        for (let sibling: ChildNode | null = from.firstChild; sibling; sibling = sibling.nextSibling) {
          if (sibling.nodeType === 1) index--;
          if (sibling === opts.startAfter) break;
        }
      }
      path.push(index);
      parent = parent.parentElement;
    }
    if (skip) continue;
    let desired: Element | undefined = to;
    for (const index of path.reverse()) desired = desired?.children[index];
    if (!desired || !compatible(control, desired)) continue;
    (control as HTMLInputElement).value = (desired as HTMLInputElement).value;
    if (control.localName === 'input') (control as HTMLInputElement).checked = (desired as HTMLInputElement).checked;
  }
}

export function trimPartialTag(html: string): string {
  let tagStart = -1, quote = '', comment = false;
  for (let i = 0; i < html.length; i++) {
    if (comment) {
      if (html.startsWith('-->', i)) { comment = false; tagStart = -1; i += 2; }
    } else if (tagStart >= 0) {
      if (quote) { if (html[i] === quote) quote = ''; }
      else if (html[i] === '"' || html[i] === "'") quote = html[i]!;
      else if (html[i] === '>') tagStart = -1;
    } else if (html[i] === '<') {
      tagStart = i;
      if (html.startsWith('<!--', i)) { comment = true; i += 3; }
    }
  }
  if (tagStart >= 0) html = html.slice(0, tagStart);
  return html.replace(/&(?:#x[\da-f]*|#\d*|[a-z]*)$/i, '');
}

export function morphDocument(doc: Document, html: string, opts?: MorphOptions): void {
  const parsed = doc.implementation.createHTMLDocument('');
  parsed.documentElement.innerHTML = trimPartialTag(html);
  morph(doc.body, parsed.body, opts);
  syncHeadStyles(doc, parsed.head, opts);
}

export function syncHeadStyles(doc: Document, head: Element, opts?: MorphOptions): void {
  const desired = Array.from(head.querySelectorAll('style, link[rel~="stylesheet"]'));
  const existing = Array.from(doc.head.querySelectorAll('[data-prism="morph"]'));
  desired.forEach((node, index) => {
    node = node.cloneNode(true) as Element;
    node.setAttribute('data-prism', 'morph');
    const old = existing[index];
    if (old && old.tagName === node.tagName) morph(old, node, { ...opts, childrenOnly: false });
    else if (old) old.replaceWith(doc.importNode(node, true));
    else doc.head.appendChild(doc.importNode(node, true));
  });
  for (const node of existing.slice(desired.length)) node.remove();
}

export function createStreamMorpher(doc: Document, opts: MorphOptions = {}): { update(html: string): void; reset(): void } {
  type Frame = { element: Element; tag: string; offset: number; anchor: ChildNode | null };
  const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
  let previous = '', scan = 0, token = -1, quote = '', fallback = false, fresh = true;
  let root = doc.body, head: Element | null = null, lastHead = '', ended = false;
  let frames: Frame[] = [];
  const reset = (): void => {
    previous = ''; scan = 0; token = -1; quote = ''; fallback = false; fresh = true;
    root = doc.body; head = null; lastHead = ''; ended = false;
    frames = [{ element: root, tag: 'body', offset: 0, anchor: null }];
  };
  reset();
  const flush = (html: string, end: number): void => {
    const frame = frames[frames.length - 1]!;
    const target = frame.element.cloneNode(false) as Element;
    const tail = html.slice(frame.offset, end);
    if (raw.has(frame.tag)) {
      const template = doc.createElement('template');
      template.innerHTML = `<${frame.tag}>${tail}</${frame.tag}>`;
      target.textContent = template.content.firstChild?.textContent ?? '';
    } else target.innerHTML = tail;
    morph(frame.element, target, { ...opts, childrenOnly: true, startAfter: frame.anchor });
  };
  const update = (html: string): void => {
    if (opts.onBeforeUpdate || opts.childrenOnly === false) { morphDocument(doc, html, opts); return; }
    if (fallback || html.length < previous.length || !html.startsWith(previous)) {
      morphDocument(doc, html, opts);
      reset();
      const scratch = doc.implementation.createHTMLDocument('');
      root = scratch.body;
      frames[0]!.element = root;
      fresh = false;
      update(html);
      for (const frame of frames) {
        const anchorIndex = frame.anchor ? Array.prototype.indexOf.call(frame.element.childNodes, frame.anchor) : -1;
        const path: number[] = [];
        let node: Node = frame.element;
        while (node !== root && node.parentNode) {
          path.push(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
          node = node.parentNode;
        }
        if (node !== root) continue;
        let live: Node = doc.body;
        for (const index of path.reverse()) live = live.childNodes[index]!;
        if (live?.nodeType === 1) frame.element = live as Element;
        else fallback = true;
        frame.anchor = frame.element.childNodes[anchorIndex] ?? null;
      }
      root = doc.body;
      return;
    }
    previous = html;
    if (fresh) {
      for (const node of Array.from(doc.head.querySelectorAll('[data-prism="morph"]'))) node.remove();
      fresh = false;
    }
    const fail = (): void => { fallback = true; morphDocument(doc, html, opts); };
    const syncHead = (): void => {
      if (!head) return;
      const value = head.innerHTML;
      if (value !== lastHead) { syncHeadStyles(doc, head, opts); lastHead = value; }
    };
    while (scan < html.length) {
      const frame = frames[frames.length - 1]!;
      if (token < 0 && raw.has(frame.tag)) {
        const rest = html.slice(scan);
        const closing = new RegExp(`</${frame.tag}(?=[\\s/>])`, 'i').exec(rest);
        if (!closing) { scan = Math.max(scan, html.length - frame.tag.length - 3); break; }
        scan += closing.index;
      }
      const char = html[scan]!;
      if (token < 0) {
        if (char !== '<') { scan++; continue; }
        token = scan;
      }
      if (html.startsWith('<!--', token)) {
        const end = html.indexOf('-->', Math.max(token + 4, scan - 2));
        if (end < 0) { scan = html.length; break; }
        flush(html, end + 3);
        frame.offset = end + 3; frame.anchor = frame.element.lastChild;
        scan = end + 3; token = -1;
        continue;
      }
      if (scan === token && html.length - token < 4 && '<!--'.startsWith(html.slice(token))) break;
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') {
        const text = html.slice(token, scan + 1);
        if (/^<!doctype\s+html\s*>$/i.test(text)) {
          frames[0]!.offset = scan + 1; token = -1; scan++; continue;
        }
        const tag = /^<(\/?)\s*([a-z][\w:-]*)\b/i.exec(text);
        if (!tag) { fail(); return; }
        const name = tag[2]!.toLowerCase(), closing = !!tag[1];
        if (name === 'html' || name === 'body' || name === 'head') {
          if (name === 'head' && !closing && frames.length === 1) {
            head = doc.createElement('head');
            frames.push({ element: head, tag: 'head', offset: scan + 1, anchor: null });
          } else if (name === 'head' && closing && frame.element === head) {
            flush(html, token); syncHead(); frames.pop(); frames[0]!.offset = scan + 1;
          } else if (frames.length !== 1) { fail(); return; }
          else {
            if (closing) { ended = true; frames[0]!.anchor = root.lastChild; }
            frames[0]!.offset = scan + 1;
          }
          token = -1; scan++; continue;
        }
        if (['table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'select', 'option', 'template', 'plaintext', 'foreignobject', 'math', 'pre', 'listing', 'noscript'].includes(name)) { fail(); return; }
        if (closing) {
          if (frames.length === 1 || frame.tag !== name) { fail(); return; }
          flush(html, token);
          frames.pop();
          const parent = frames[frames.length - 1]!;
          parent.offset = scan + 1; parent.anchor = frame.element;
        } else {
          if ((name === 'li' && frames.some(item => item.tag === 'li')) ||
              (/^(?:dt|dd)$/.test(name) && frames.some(item => /^(?:dt|dd)$/.test(item.tag))) ||
              (/^h[1-6]$/.test(name) && frames.some(item => /^h[1-6]$/.test(item.tag))) ||
              (['a', 'button', 'form'].includes(name) && frames.some(item => item.tag === name)) ||
              (frames.some(item => item.tag === 'p') && /^(?:address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|ul)$/.test(name))) { fail(); return; }
          if (frame.element.namespaceURI === 'http://www.w3.org/2000/svg' &&
              /^(?:b|big|blockquote|body|br|center|code|dd|div|dl|dt|em|embed|font|h[1-6]|head|hr|i|img|li|listing|menu|meta|nobr|ol|p|pre|ruby|s|script|small|span|strong|strike|style|sub|sup|table|tt|u|ul|var)$/.test(name)) { fail(); return; }
          flush(html, scan + 1);
          const node = frame.element.lastChild;
          if (!node || node.nodeType !== 1 || (node as Element).localName.toLowerCase() !== name) { fail(); return; }
          const svg = (node as Element).namespaceURI === 'http://www.w3.org/2000/svg';
          if (voids.has(name) || (svg && /\/\s*>$/.test(text))) {
            frame.offset = scan + 1; frame.anchor = node;
          } else frames.push({ element: node as Element, tag: name, offset: scan + 1, anchor: null });
        }
        token = -1;
      }
      scan++;
    }
    const frame = frames[frames.length - 1]!;
    let end = token >= 0 ? token : html.length;
    if (!raw.has(frame.tag)) end = end - (html.slice(frame.offset, end).match(/&(?:#x[\da-f]*|#\d*|[a-z]*)$/i)?.[0].length ?? 0);
    if (!ended) flush(html, end);
    if (frames.some(item => item.element === head)) syncHead();
  };
  return { update, reset };
}

export const MORPH_SOURCE = /* @__PURE__ */ (() => `${morph.toString()}\n${trimPartialTag.toString()}\n${syncHeadStyles.toString()}\n${morphDocument.toString()}\n${createStreamMorpher.toString()}`)();
