import { parse, type Node, type Plugin } from '@prism-ui/core';
import { renderToString } from 'react-dom/server';
import { renderWireframe, wireframeCss } from '@prism-ui/components/mockup';

function mediaNode(node: Node): Node | undefined {
  if (node.type === 'component' && (node.name === 'artifact' || node.name === 'mockup') && ['html', 'svg', 'wire'].includes(String(node.props?.kind))) return node;
  for (const child of node.children ?? []) { const result = mediaNode(child); if (result) return result; }
}

export function staticMediaPreview(source: string, plugins: Plugin[]) {
  const node = mediaNode(parse(source, { plugins })), content = node?.props?.source;
  if (typeof content !== 'string' || !content.trim()) return;
  const wire = node?.props?.kind === 'wire';
  const document = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${wire ? wireframeCss({ tokens: { ink: 'CanvasText', paper: 'Canvas', fill: 'color-mix(in srgb, CanvasText 5%, Canvas)', muted: 'GrayText', line: 'GrayText' } }) : ''}:root{color-scheme:light dark;overflow:hidden}body{margin:12px;min-height:136px;display:grid;place-content:center;gap:12px;color:light-dark(#202320,#edefe9);font:14px/1.5 system-ui}h1{font-size:18px;margin:0}svg{width:112px;height:112px;fill:currentColor}${wire ? 'body{display:block;zoom:.55} .wf-root{max-width:100%}' : ''}</style>${wire ? renderWireframe(content) : content}`;
  return renderToString(<iframe className="gallery-media-preview" title={`Static ${node!.name} preview`} sandbox="" tabIndex={-1} srcDoc={document} />);
}
