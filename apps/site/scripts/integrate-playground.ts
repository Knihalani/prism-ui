import { readFile, writeFile } from 'node:fs/promises';

export function editorBridge(html: string) {
  if (html.includes('data-prism-editor-bridge')) return html;
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('Playground comparison output has no head');
  const bridge = '<script data-prism-editor-bridge>if(new URLSearchParams(location.search).get("editor")==="1")location.replace(new URL("./"+location.search+location.hash,location.href).href)</script>';
  return html.replace(/<head(?:\s[^>]*)?>/i, head => head + bridge);
}

if (import.meta.main) {
  const file = new URL('../dist/playground/themes.html', import.meta.url);
  await writeFile(file, editorBridge(await readFile(file, 'utf8')));
  console.log('Integrated playground: themes.html?editor=1 opens the main playground editor');
}
