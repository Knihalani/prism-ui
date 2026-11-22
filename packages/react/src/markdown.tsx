import { Children, createContext, createElement, useContext, type ReactNode } from 'react';
import type { Node } from '@prism-ui/core';
import { usePart } from './context';

export interface MarkdownProps { node: Node; children?: ReactNode }
export function Heading({ node, children }: MarkdownProps) { return createElement('h' + Math.max(1, Math.min(6, node.depth ?? 1)), usePart('heading', 'root'), children); }
export function Paragraph({ children }: MarkdownProps) { return <p {...usePart('paragraph', 'root')}>{children}</p>; }
export function Text({ node }: MarkdownProps) { return <span {...usePart('text', 'root')}>{node.value}</span>; }
export function List({ node, children }: MarkdownProps) { const part = usePart('list', 'root'); return node.ordered ? <ol {...part} start={node.start}>{children}</ol> : <ul {...part}>{children}</ul>; }
export function ListItem({ node, children }: MarkdownProps) { return <li {...usePart('listItem', 'root')}>{node.checked !== undefined && <input type="checkbox" checked={node.checked} readOnly />}{children}</li>; }
export function Blockquote({ children }: MarkdownProps) { return <blockquote {...usePart('blockquote', 'root')}>{children}</blockquote>; }
export function Code({ node }: MarkdownProps) { return <pre {...usePart('code', 'root')}><code className={node.lang ? 'language-' + node.lang : undefined}>{node.value}</code></pre>; }
export function InlineCode({ node }: MarkdownProps) { return <code {...usePart('inlineCode', 'root')}>{node.value}</code>; }
const Align = createContext<Node['align']>(undefined);
export function Table({ node, children }: MarkdownProps) {
  const rows = Children.toArray(children);
  return <Align.Provider value={node.align}><table {...usePart('table', 'root')}><thead>{rows[0]}</thead><tbody>{rows.slice(1)}</tbody></table></Align.Provider>;
}
export function TableRow({ children }: MarkdownProps) { return <tr {...usePart('tableRow', 'root')}>{children}</tr>; }
function Cell({ node, children }: MarkdownProps) {
  const align = useContext(Align), header = node.type === 'tableHeader', part = usePart(node.type, 'root');
  return createElement(header ? 'th' : 'td', { ...part, style: { textAlign: align?.[Number(node.key.split('.').at(-1))] ?? undefined, ...part.style } }, children);
}
export const TableCell = Cell, TableHeader = Cell;
export function Link({ node, children }: MarkdownProps) { const external = /^(?:https?:)?\/\//i.test(node.url ?? ''); return <a {...usePart('link', 'root')} href={node.url} title={node.title} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}</a>; }
export function Image({ node }: MarkdownProps) { return <img {...usePart('image', 'root')} src={node.url || undefined} alt={node.value ?? ''} title={node.title} loading="lazy" />; }
export function ThematicBreak(_: MarkdownProps) { return <hr {...usePart('thematicBreak', 'root')} />; }
export function Strong({ children }: MarkdownProps) { return <strong {...usePart('strong', 'root')}>{children}</strong>; }
export function Emphasis({ children }: MarkdownProps) { return <em {...usePart('emphasis', 'root')}>{children}</em>; }
export function Delete({ children }: MarkdownProps) { return <del {...usePart('delete', 'root')}>{children}</del>; }
export function Break(_: MarkdownProps) { return <br {...usePart('break', 'root')} />; }
export const defaultRenderers = { heading: Heading, paragraph: Paragraph, text: Text, list: List, listItem: ListItem, blockquote: Blockquote, code: Code, inlineCode: InlineCode, table: Table, tableRow: TableRow, tableCell: TableCell, tableHeader: TableHeader, link: Link, image: Image, thematicBreak: ThematicBreak, hr: ThematicBreak, strong: Strong, emphasis: Emphasis, delete: Delete, break: Break };
