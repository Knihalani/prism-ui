import { parse, type Node, type Plugin } from '@prism-ui/core';
import { renderToString } from 'react-dom/server';

function mediaNode(node: Node): Node | undefined {
  if (node.type === 'component' && (node.name === 'artifact' || node.name === 'mockup') && (node.props?.kind === 'html' || node.props?.kind === 'svg')) return node;
  for (const child of node.children ?? []) { const result = mediaNode(child); if (result) return result; }
}

export function staticMediaPreview(source: string, plugins: Plugin[]) {
  const node = mediaNode(parse(source, { plugins })), content = node?.props?.source;
  if (typeof content !== 'string' || !content.trim()) return;
  const document = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>:root{color-scheme:light dark;overflow:hidden}body{margin:12px;min-height:136px;display:grid;place-content:center;gap:12px;color:light-dark(#202320,#edefe9);font:14px/1.5 system-ui}h1{font-size:18px;margin:0}svg{width:112px;height:112px;fill:currentColor}</style>${content}`;
  return renderToString(<iframe className="gallery-media-preview" title={`Static ${node!.name} preview`} sandbox="" tabIndex={-1} srcDoc={document} />);
}
