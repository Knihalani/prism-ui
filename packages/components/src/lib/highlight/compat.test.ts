import { expect, test } from 'bun:test';
import { highlight, listLanguages, tokenize } from './index';

const source = '/* comment\n nested */ const value = 12.5 / 2; // tail\n' +
  '`template ${user.name} ${`nested ${x}`}`\n' +
  '<Panel title="<&\'">{items.map(x => <Item />)}</Panel>\n' +
  '@decorator\ndef greet(x):\n  return f"""hello {x}\nnext""" # comment\n' +
  'echo "$HOME $(printf hello)"\ncat <<EOF\nbody\nEOF\n' +
  '{"key": "< & > \\\"", "value": true, "items": [-2, null]}\n' +
  '@media screen { .card:hover { color: #abc; gap: 2px; } }\n' +
  '<script>const a = "&";</script><style>.a { color: red }</style>\n' +
  'fn borrow<\'a>(x: &\'a str) { let s = r##"raw\nstring"##; println!("{}", x); }\n' +
  "select COUNT(*) from t where x = 'O''Brien';\n" +
  'name: &anchor\ntext: |\n  hello\n  world\ncopy: *anchor\n' +
  '--- old\n+++ new\n@@ -1 +1 @@\n-deleted\n+inserted\n' +
  '😀 e\u0301 <>&"\'\r\n';

for (const lang of [...listLanguages(), 'unknown']) {
  test(`${lang} preserves pre-optimization token and HTML output`, () => {
    expect({ tokens: tokenize(source, lang), html: highlight(source, lang) }).toMatchSnapshot();
  });
}
