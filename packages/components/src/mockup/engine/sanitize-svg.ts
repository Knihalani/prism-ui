export interface SanitizeSvgOptions {
  allowDataImages?: boolean;
}

export function sanitizeSvg(src: string, opts: SanitizeSvgOptions = {}): string {
  const decode = (value: string): string => value.replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_, hex, dec) => {
    const code = parseInt(hex ?? dec, hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  }).replace(/&(colon|tab|newline|amp|quot|apos);/gi, (_, name: string) => {
    return ({ colon: ':', tab: '\t', newline: '\n', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[name.toLowerCase()]!;
  });
  const compact = (value: string) => decode(value).replace(/[\s\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  const safeUrl = (value: string) => {
    const url = compact(value);
    return url.startsWith('#') || (opts.allowDataImages !== false && /^data:image\/(?:png|jpe?g|gif|webp);/.test(url));
  };
  const safeCss = (value: string): boolean => {
    const css = decode(value).replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '').replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_, hex, char) => {
      const code = hex ? parseInt(hex, 16) : 0;
      return hex ? (code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd') : char;
    });
    if (/@\s*import|expression\s*\(|javascript\s*:/i.test(css)) return false;
    const urls = css.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi);
    let count = 0;
    for (const url of urls) {
      count++;
      if (!safeUrl((url[1] ?? url[2] ?? url[3] ?? '').trim())) return false;
    }
    return count === (css.match(/url\s*\(/gi)?.length ?? 0);
  };
  const forbidden = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video']);
  const blocked: string[] = [];
  let output = '', position = 0;
  while (position < src.length) {
    const start = src.indexOf('<', position);
    if (start < 0) { if (!blocked.length) output += src.slice(position); break; }
    if (!blocked.length) output += src.slice(position, start);
    if (src.startsWith('<!--', start)) {
      const end = src.indexOf('-->', start + 4);
      if (end < 0) break;
      if (!blocked.length) output += src.slice(start, end + 3);
      position = end + 3;
      continue;
    }
    let end = start + 1, quote = '', brackets = 0;
    for (; end < src.length; end++) {
      const char = src[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '[') brackets++;
      else if (char === ']') brackets = Math.max(0, brackets - 1);
      else if (char === '>' && !brackets) break;
    }
    if (end === src.length) break;
    const token = src.slice(start, end + 1);
    position = end + 1;
    if (/^<!|^<\?/.test(token)) continue;
    const match = /^<(\/?)\s*([\w:-]+)/.exec(token);
    if (!match) continue;
    const closing = !!match[1], name = match[2]!.toLowerCase();
    if (blocked.length) {
      if (closing && name === blocked[blocked.length - 1]) blocked.pop();
      else if (!closing && forbidden.has(name) && !/\/\s*>$/.test(token)) blocked.push(name);
      continue;
    }
    if (forbidden.has(name)) {
      if (!closing && !/\/\s*>$/.test(token)) blocked.push(name);
      continue;
    }
    if (closing) { output += token; continue; }
    const attributes: { name: string; value: string; raw: string }[] = [];
    const body = token.slice(match[0].length, -1).replace(/\/\s*$/, '');
    const pattern = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    for (const attr of body.matchAll(pattern)) {
      attributes.push({ name: attr[1]!.toLowerCase(), value: attr[2] ?? attr[3] ?? attr[4] ?? '', raw: attr[0] });
    }
    if ((name === 'animate' || name === 'set' || name === 'animatetransform' || name === 'animatemotion') && attributes.some(attr =>
      attr.name === 'attributename' && /^(?:.*:)?(?:href|src|on.*|style)$/i.test(compact(attr.value)))) continue;
    const kept = attributes.filter(attr => {
      if (/^on/i.test(attr.name) || /javascript:/i.test(compact(attr.value))) return false;
      if (/(?:^|:)(?:href|src)$/.test(attr.name) && !safeUrl(attr.value)) return false;
      return attr.name !== 'style' || safeCss(attr.value);
    });
    const opening = kept.length === attributes.length ? token : token.slice(0, match[0].length) + kept.map(attr => /^\s/.test(attr.raw) ? attr.raw : ` ${attr.raw}`).join('') + (/\/\s*>$/.test(token) ? '/>' : '>');
    if (name === 'style') {
      const rest = src.slice(position);
      const close = /<\/style\s*>/i.exec(rest);
      if (!close) break;
      const content = rest.slice(0, close.index).replace(/</g, '');
      if (safeCss(content)) output += opening + content + close[0];
      position += close.index + close[0].length;
    } else output += opening;
  }
  return output;
}
