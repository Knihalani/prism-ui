import { expect, test } from 'bun:test';
import { sanitizeSvg } from './sanitize-svg';

test('preserves safe SVG and supports empty/partial streams without DOM', () => {
  const safe = '<svg viewBox="0 0 20 20"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0"/><use xlink:href="#g" /><text>Hello</text></svg>';
  expect(sanitizeSvg(safe)).toBe(safe);
  expect(sanitizeSvg('')).toBe('');
  expect(sanitizeSvg('<svg><path d="M')).toBe('<svg>');
  expect(sanitizeSvg('<svg><!-- incomplete')).toBe('<svg>');
});

test('removes dangerous elements with content and declarations', () => {
  for (const name of ['script', 'SCRIPT', 'foreignObject', 'iframe', 'embed', 'object', 'audio', 'video']) {
    expect(sanitizeSvg(`<svg><${name}><g>bad</g></${name}><path/></svg>`)).toBe('<svg><path/></svg>');
    expect(sanitizeSvg(`<svg><${name}>unfinished`)).toBe('<svg>');
  }
  expect(sanitizeSvg('<!DOCTYPE svg [<!ENTITY a "ha"><!ENTITY b "&a;&a;">]><svg/>')).toBe('<svg/>');
  expect(sanitizeSvg('<!ENTITY a "x"><svg/>')).toBe('<svg/>');
});

test('strips event attributes and encoded/whitespace javascript', () => {
  for (const attr of ['onload=alert(1)', 'ONCLICK="x"', "onfocus = 'x'", 'href="java&#x73;cript:alert(1)"', 'fill="java&#115;cript:x"', 'href="java&Tab;script&colon;x"', 'href=" java\nscript:x"']) {
    expect(sanitizeSvg(`<svg ${attr}><path/></svg>`)).toBe('<svg><path/></svg>');
  }
});

test('URL allowlist covers namespaced, unquoted and data URLs', () => {
  for (const attr of ['href', 'xlink:href', 'src', 'HREF']) {
    for (const value of ['https://evil/x', '//evil', 'data:image/svg+xml;base64,xxx', 'javascript:x', 'data:text/html,x']) {
      expect(sanitizeSvg(`<image ${attr}="${value}"/>`)).toBe('<image/>');
    }
    for (const value of ['#target', 'data:image/png;base64,aaa', 'data:image/jpeg;base64,aaa', 'data:image/jpg;base64,aaa', 'data:image/gif;base64,aaa', 'data:image/webp;base64,aaa']) {
      const svg = `<image ${attr}="${value}"/>`;
      expect(sanitizeSvg(svg)).toBe(svg);
    }
  }
  expect(sanitizeSvg('<use href=https://evil />')).toBe('<use/>');
  expect(sanitizeSvg('<image href="data:image/png;base64,x"/>', { allowDataImages: false })).toBe('<image/>');
});

test('blocks CSS imports, expressions, external URLs and escaped bypasses', () => {
  for (const css of ['@import "https://evil";', 'width:expression(alert(1))', 'fill:url(https://evil)', 'fill:url("//evil")', 'fill:url(data:image/svg+xml,x)', '@im\\70ort "x"', 'fill:u\\72l(https://evil)', 'fill:url(&quot;https://evil&quot;)', 'fill:u/**/rl(https://evil)', 'fill:url(unfinished', 'fill:url(javascript:x)']) {
    expect(sanitizeSvg(`<svg style='${css}'/>`)).toBe('<svg/>');
    expect(sanitizeSvg(`<svg><style>${css}</style><path/></svg>`)).toBe('<svg><path/></svg>');
  }
  const safe = '<svg style="fill:url(#x)"><style>path{fill:url(data:image/png;base64,x)}</style></svg>';
  expect(sanitizeSvg(safe)).toBe(safe);
  expect(sanitizeSvg('<svg><style>unfinished')).toBe('<svg>');
});

test('blocks animation mutating href, events or style', () => {
  for (const tag of ['animate', 'set', 'ANIMATE']) {
    for (const target of ['href', 'xlink:href', 'onload', 'ONCLICK', 'h&#114;ef', 'style']) {
      expect(sanitizeSvg(`<${tag} attributeName="${target}" to="https://evil"/>`)).toBe('');
    }
  }
  const safe = '<animate attributeName="opacity" from="0" to="1"/>';
  expect(sanitizeSvg(safe)).toBe(safe);
});
