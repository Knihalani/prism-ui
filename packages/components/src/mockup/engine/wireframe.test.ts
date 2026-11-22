import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createStreamMorpher } from './morph';
import { parseWireframe, renderWireframe, wireframeCss, wireframeDocument, WIREFRAME_DOCS } from './wireframe';

const example = WIREFRAME_DOCS.split('```wire\n')[1]!.split('```')[0]!;
const dom = (src: string) => {
  const doc = new Window().document;
  doc.body.innerHTML = renderWireframe(src);
  return doc;
};

describe('parseWireframe', () => {
  test('design examples keep their intended structure', () => {
    const [nav, hero, grid, img, input, text] = parseWireframe('nav: Logo | Home | Pricing | [Sign up]\nhero: # Title / subtitle / [CTA]\ngrid 3: card*3\nimg 16:9\ninput: Email\ntext*3');
    expect(nav!.kind).toBe('nav');
    expect(nav!.children[0]!.kind).toBe('row');
    expect(nav!.children[0]!.children.map(node => node.content)).toEqual(['Logo', 'Home', 'Pricing', 'Sign up']);
    expect(hero!.children[0]!.children.map(node => node.kind)).toEqual(['h1', 'label', 'button']);
    expect(grid!.repeat).toBe(1);
    expect(grid!.args).toEqual(['3']);
    expect(grid!.children[0]!.kind).toBe('card');
    expect(grid!.children[0]!.repeat).toBe(3);
    expect(img!.args).toEqual(['16:9']);
    expect(input!.content).toBe('Email');
    expect(text!.repeat).toBe(3);
    const doc = dom('grid 3: card*3\ntext*3');
    expect(doc.querySelectorAll('.pwf-grid .pwf-card').length).toBe(3);
    expect(doc.querySelectorAll('.pwf-text').length).toBe(3);
  });
  test('indentation is forgiving, tabs nest, comments/blank lines retain stable line numbers', () => {
    const nodes = parseWireframe('// comment\npage mobile\n\tsection Welcome\n\t  # Hello\n\n   input: Email\nfooter: Done');
    expect(nodes.map(node => node.kind)).toEqual(['page', 'footer']);
    expect(nodes[0]!.key).toBe('pwf-l1');
    expect(nodes[0]!.children[0]!.children[0]!.content).toBe('Hello');
    expect(nodes[0]!.children[0]!.children[1]!.kind).toBe('input');
    expect(nodes[1]!.key).toBe('pwf-l6');
    expect(parseWireframe(' \n// only\n\t')).toEqual([]);
  });
  test('quoted separators, literal tokens, links, ratios, modifiers and repeats', () => {
    const doc = dom('nav: "A | B / C" | (Docs) | [[Start]]\nsplit 1:2\n  card dark center*2: # Hello\n  img 4:3\n"text*3"\n---\ntext*9999\ntext*0');
    expect(doc.querySelector('.pwf-nav .pwf-label')!.textContent).toBe('A | B / C');
    expect(doc.querySelector('.pwf-link')!.textContent).toBe('Docs');
    expect(doc.querySelector('.pwf-primary')!.textContent).toBe('Start');
    expect(doc.querySelectorAll('.pwf-card.pwf-dark.pwf-center').length).toBe(2);
    expect(doc.querySelector('.pwf-split')!.getAttribute('style')).toBe('--pwf-split:1fr 2fr');
    expect(doc.querySelector('.pwf-img')!.getAttribute('style')).toBe('aspect-ratio:1.3333333333333333');
    expect(doc.querySelectorAll('.pwf-text').length).toBe(24);
    expect(doc.querySelector('hr')).not.toBeNull();
    expect(doc.body.textContent).toContain('text*3');
  });
  test('every prefix of the reference example and partial tokens renders without throwing', () => {
    for (let i = 0; i <= example.length; i++) expect(() => renderWireframe(example.slice(0, i))).not.toThrow();
    for (const src of ['[', '[[Sta', '#', 'grid ', 'img 16:', 'input:', 'card*', 'row: A |', 'hero: # Title /', '"unterminated', 'row: [A | B', 'split 1:']) {
      expect(renderWireframe(src)).toContain('pwf-root');
    }
    expect(renderWireframe('[' + ']'.repeat(30000) + 'end')).toContain('end</button>');
    expect(renderWireframe('(' + ')'.repeat(30000) + 'end')).toContain('end</a>');
  });
});

describe('renderWireframe', () => {
  test('all primitives have meaningful markup and bounded generated content', () => {
    const doc = dom('icon\navatar\ninput: Email\ntextarea: Notes\nselect: Country\ncheck: Subscribe\nradio: Plan\ntoggle: Notifications\nsearch\nbadge: New\ntable 3x4\nchart bar\nchart line\nchart pie\nvideo\nmap\nlist 3\ntabs: A | B | C\nbreadcrumb\npagination\nspacer\ncustom-widget: Something useful');
    expect(doc.querySelectorAll('input').length).toBe(2);
    expect(doc.querySelector('textarea')!.placeholder).toBe('Notes');
    expect(doc.querySelector('select')!.textContent).toBe('Country');
    expect(doc.querySelectorAll('tbody tr').length).toBe(4);
    expect(doc.querySelectorAll('thead th').length).toBe(3);
    expect(doc.querySelectorAll('.pwf-list li').length).toBe(3);
    expect(doc.querySelectorAll('.pwf-chart').length).toBe(3);
    expect(doc.querySelector('.pwf-unknown')!.textContent).toContain('custom-widget');
    expect(doc.querySelector('.pwf-unknown')!.textContent).toContain('Something useful');
    expect(dom('table 999x999').querySelectorAll('td').length).toBe(12 * 24);
    expect(dom('list 999').querySelectorAll('li').length).toBe(24);
  });
  test('escapes user input, classes, AST content and unsafe CSS token values', () => {
    const html = renderWireframe('input: "><script>alert(1)</script>\n"<img src=x onerror=alert(1)>"', {
      className: '"><script>bad</script>', tokens: { ink: 'red;}</style><script>bad</script>', fill: 'url(https://evil)', gap: '24px' },
    });
    const doc = new Window().document;
    doc.body.innerHTML = html;
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('.pwf-root')!.getAttribute('style')).toBe('--pwf-gap:24px');
    expect(wireframeCss({ tokens: { ink: '</style><script>bad</script>' } })).not.toContain('</style>');
    const ast = parseWireframe('card');
    ast[0]!.key = '"><script>x</script>';
    doc.body.innerHTML = renderWireframe(ast);
    expect(doc.querySelector('script')).toBeNull();
  });
  test('keys are unique, stable on append and preserve earlier DOM identity through the stream morpher', () => {
    const prefix = 'page desktop\n  nav: Logo | [Start]\n  grid 3: card*3\n  section\n    # Proj';
    const full = prefix + 'ects\n    text*3\n    card*2\n      row: card*2 | badge: New';
    const before = parseWireframe(prefix);
    expect(parseWireframe(full)[0]!.children[0]!.key).toBe(before[0]!.children[0]!.key);
    const doc = new Window().document as unknown as Document;
    const stream = createStreamMorpher(doc);
    stream.update(wireframeDocument(prefix));
    const nav = doc.querySelector('.pwf-nav'), card = doc.querySelector('.pwf-card');
    stream.update(wireframeDocument(full));
    expect(doc.querySelector('.pwf-nav')).toBe(nav);
    expect(doc.querySelector('.pwf-card')).toBe(card);
    const keys = Array.from(doc.querySelectorAll('[data-key]')).map(el => el.getAttribute('data-key'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  test('styles are scoped, customizable, responsive and sketch is opt-in', () => {
    expect(renderWireframe('card')).not.toContain('pwf-sketch');
    expect(renderWireframe('card', { sketch: true })).toContain('pwf-sketch');
    const css = wireframeCss({ tokens: { ink: '#111', gap: '18px' } });
    expect(css).toContain('--pwf-ink:#111');
    expect(css).toContain('--pwf-gap:18px');
    expect(css).toContain('@media(max-width:600px)');
    expect(css).toContain('Comic Neue');
    expect(css).toContain('sans-serif;--pwf-radius:3px');
    expect(css).toContain('font-style:normal');
    expect(css).not.toContain('font-style:italic');
    expect(css).toContain('2px 3px 0 #aaa');
    expect(css).not.toContain('@import');
    expect(css).not.toContain('url(');
    expect(wireframeDocument('card')).toStartWith('<style data-prism="wireframe">');
    expect(WIREFRAME_DOCS.split('\n').length).toBeLessThan(60);
    expect(renderWireframe(example)).toBe(renderWireframe(parseWireframe(example)));
    expect(renderWireframe('')).toContain('pwf-root');
  });
});
