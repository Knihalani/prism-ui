import { Children, createContext, useContext, type ElementType, type ReactNode } from 'react';
import type { Node } from '@prism-ui/core';
import { PrismPart, usePart, usePrism, useStrings } from './context';
import { defineComponent } from './registry';

export interface MarkdownProps { node: Node; children?: ReactNode }
export const markdownParts = {
 heading: ['root'], paragraph: ['root'], text: ['root'], list: ['root'], listItem: ['root', 'checkbox'],
 blockquote: ['root'], code: ['root', 'content'], inlineCode: ['root'], table: ['root', 'wrapper', 'head', 'body'],
 tableRow: ['root'], tableCell: ['root'], tableHeader: ['root'], link: ['root'], image: ['root'],
 thematicBreak: ['root'], strong: ['root'], emphasis: ['root'], delete: ['root'], break: ['root'],
} as const;
const blocks = new Set(['heading', 'paragraph', 'list', 'blockquote', 'code', 'table', 'thematicBreak']);
const Align = createContext<Node['align']>(undefined);
export function useMarkdown({ node, children }: MarkdownProps, component = node.type === 'hr' ? 'thematicBreak' : node.type) {
 const prism = usePrism(), align = useContext(Align), state = Object.isFrozen(node) ? 'ready' : 'streaming';
 const strings = useStrings(component, { task: 'Task', title: node.title ?? '', alt: node.value ?? '' });
 const parts = {
  root: usePart(component, 'root', state), content: usePart(component, 'content', state), checkbox: usePart(component, 'checkbox', state),
  wrapper: usePart(component, 'wrapper', state), head: usePart(component, 'head', state), body: usePart(component, 'body', state),
 };
 const external = /^(?:https?:)?\/\//i.test(node.url ?? '');
 return { node, children, component, parts, strings, external,
  heading: ('h' + Math.max(1, Math.min(6, node.depth ?? 1))) as ElementType,
  rootProps: { ...parts.root, 'data-prism-enter': blocks.has(component) && prism.animate && !node.key.includes('.') ? '' : undefined,
   style: { overflowWrap: 'anywhere' as const, ...parts.root.style } },
  cellProps: { ...parts.root, style: { textAlign: align?.[Number(node.key.split('.').at(-1))] ?? undefined, ...parts.root.style } },
  wrapperProps: { ...parts.wrapper, style: { overflowX: 'auto' as const, containerType: 'inline-size', marginBlockStart: node.key.split('.').at(-1) === '0' ? 0 : 'var(--prism-table-space-5, var(--prism-space-5))', ...parts.wrapper.style } },
  linkProps: { href: node.url, title: strings.title || undefined, target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined },
  imageProps: { src: node.url || undefined, alt: strings.alt, title: strings.title || undefined, loading: 'lazy' as const },
 };
}
export type MarkdownModel = ReturnType<typeof useMarkdown>;
export interface MarkdownSlotProps { markdown: MarkdownModel }
function Root({ as, model, children, ...props }: { as: ElementType; model: MarkdownModel; children?: ReactNode; [key: string]: unknown }) {
 return <PrismPart as={as} {...model.rootProps} {...props} slotProps={{ markdown: model } satisfies MarkdownSlotProps}>{children}</PrismPart>;
}
export function Heading(props: MarkdownProps) { const model = useMarkdown(props); return <Root as={model.heading} model={model}>{props.children}</Root>; }
export function Paragraph(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="p" model={model}>{props.children}</Root>; }
export function Text(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="span" model={model}>{props.node.value}</Root>; }
export function List(props: MarkdownProps) { const model = useMarkdown(props); return <Root as={props.node.ordered ? 'ol' : 'ul'} model={model} start={props.node.ordered ? props.node.start : undefined}>{props.children}</Root>; }
export function ListItem(props: MarkdownProps) {
 const model = useMarkdown(props);
 return <Root as="li" model={model}>{props.node.checked !== undefined && <PrismPart as="input" {...model.parts.checkbox} slotProps={{ markdown: model } satisfies MarkdownSlotProps} type="checkbox" checked={props.node.checked} readOnly aria-label={model.strings.task} />}{props.children}</Root>;
}
export function Blockquote(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="blockquote" model={model}>{props.children}</Root>; }
export function Code(props: MarkdownProps) {
 const model = useMarkdown(props);
 return <Root as="pre" model={model}><PrismPart as="code" {...model.parts.content} slotProps={{ markdown: model } satisfies MarkdownSlotProps} className={[model.parts.content.className, props.node.lang ? 'language-' + props.node.lang : undefined].filter(Boolean).join(' ') || undefined}>{props.node.value}</PrismPart></Root>;
}
export function InlineCode(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="code" model={model}>{props.node.value}</Root>; }
export function Table(props: MarkdownProps) {
 const model = useMarkdown(props), rows = Children.toArray(props.children), slotProps = { markdown: model } satisfies MarkdownSlotProps;
 return <Align.Provider value={props.node.align}><PrismPart as="div" {...model.wrapperProps} slotProps={slotProps} data-prism-enter={model.rootProps['data-prism-enter']}><Root as="table" model={model} data-prism-enter={undefined}>
  <PrismPart as="thead" {...model.parts.head} slotProps={slotProps}>{rows[0]}</PrismPart>
  <PrismPart as="tbody" {...model.parts.body} slotProps={slotProps}>{rows.slice(1)}</PrismPart>
 </Root></PrismPart></Align.Provider>;
}
export function TableRow(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="tr" model={model}>{props.children}</Root>; }
function Cell(props: MarkdownProps) { const model = useMarkdown(props); return <Root as={props.node.type === 'tableHeader' ? 'th' : 'td'} model={model} {...model.cellProps}>{props.children}</Root>; }
export const TableCell = Cell, TableHeader = Cell;
export function Link(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="a" model={model} {...model.linkProps}>{props.children}</Root>; }
export function Image(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="img" model={model} {...model.imageProps} />; }
export function ThematicBreak(props: MarkdownProps) { const model = useMarkdown(props, 'thematicBreak'); return <Root as="hr" model={model} />; }
export function Strong(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="strong" model={model}>{props.children}</Root>; }
export function Emphasis(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="em" model={model}>{props.children}</Root>; }
export function Delete(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="del" model={model}>{props.children}</Root>; }
export function Break(props: MarkdownProps) { const model = useMarkdown(props); return <Root as="br" model={model} />; }
export const defaultRenderers = { heading: Heading, paragraph: Paragraph, text: Text, list: List, listItem: ListItem, blockquote: Blockquote, code: Code, inlineCode: InlineCode, table: Table, tableRow: TableRow, tableCell: TableCell, tableHeader: TableHeader, link: Link, image: Image, thematicBreak: ThematicBreak, hr: ThematicBreak, strong: Strong, emphasis: Emphasis, delete: Delete, break: Break };
export const markdownDefinitions = Object.entries(markdownParts).map(([name, parts]) => defineComponent({
 name, parts: [...parts], component: defaultRenderers[name as keyof typeof markdownParts], strings: name === 'listItem' ? { task: 'Task' } : {},
}));
