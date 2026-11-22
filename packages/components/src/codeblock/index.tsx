import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { defineComponent, registerComponent, useComponentState, useEmit, usePart, usePrism, useSlot, type PrismContextValue, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { useFrame } from '../frame';
import { createIncremental, escapeHTML, highlight } from '../lib/highlight';

export { setHighlighter } from '../lib/highlight';
export type CodeHighlighter = (code: string, lang: string) => string;
export const CodeBlockHighlighterContext = createContext<CodeHighlighter | undefined>(undefined);
export interface CodeBlockProps {
  id?: string; code?: string; lang?: string; meta?: string; title?: string; filename?: string;
  lines?: boolean; wrap?: boolean; collapse?: boolean; collapseAfter?: number; complete?: boolean; highlighter?: CodeHighlighter;
}
export const codeBlockSchema = s.object({
  id: s.string().optional(), code: s.string().optional(), lang: s.string().optional(), meta: s.string().optional(),
  title: s.string().optional(), filename: s.string().optional(), lines: s.boolean().optional(), wrap: s.boolean().optional(),
  collapse: s.boolean().optional(), collapseAfter: s.number({ min: 1 }).optional(), complete: s.boolean().optional(),
});
function metadata(meta = ''): Record<string, string | boolean> {
  if (typeof meta !== 'string') return {};
  const result: Record<string, string | boolean> = {};
  for (const match of meta.replace(/[{}]/g, '').matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
    const value = match[2] ?? match[3] ?? match[4]; result[match[1]] = value === undefined ? true : value === 'false' ? false : value;
  }
  return result;
}
async function clipboard(code: string) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); return; } } catch {}
  const previous = document.activeElement as HTMLElement | null, input = document.createElement('textarea');
  input.value = code; input.setAttribute('aria-hidden', 'true'); input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  try { if (!document.execCommand('copy')) throw Error('Copy unavailable'); }
  finally { input.remove(); previous?.focus(); }
}
export function useCodeBlock(props: CodeBlockProps, ctx: PrismContextValue) {
  const inherited = useContext(CodeBlockHighlighterContext), backend = typeof props.highlighter === 'function' ? props.highlighter : inherited;
  const meta = useMemo(() => metadata(props.meta), [props.meta]);
  const code = typeof props.code === 'string' ? props.code : '', lang = typeof props.lang === 'string' ? props.lang : '', complete = props.complete !== false;
  const [wrap, setWrap] = useComponentState('wrap', props.wrap ?? !!meta.wrap);
  const [expanded, setExpanded] = useComponentState('expanded', false);
  const [feedback, setFeedback] = useState(''), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true), emit = useEmit();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  const stream = useMemo(() => createIncremental(lang), [lang]);
  const html = useMemo(() => {
    try { return ctx.unstyled ? escapeHTML(code) : backend ? backend(code, lang) : complete ? highlight(code, lang) : stream.update(code); }
    catch { return escapeHTML(code); }
  }, [backend, code, lang, complete, stream, ctx.unstyled]);
  const rawLines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);
  const count = code ? rawLines.length : 0, threshold = Math.max(1, Math.floor(Number.isFinite(props.collapseAfter) ? props.collapseAfter! : 20));
  const collapsible = (props.collapse ?? meta.collapse) !== false && count > threshold;
  const collapsed = collapsible && !expanded;
  return { code, lang, html, rawLines, count, threshold, collapsed, collapsible, expanded, wrap,
    complete, animate: ctx.animate, feedback, lines: props.lines ?? !!meta.lines,
    label: typeof props.filename === 'string' ? props.filename : typeof props.title === 'string' ? props.title : String(meta.filename ?? meta.title ?? (lang || 'Plain text')),
    toggleWrap: () => setWrap(value => !value), toggleCollapse: () => setExpanded(value => !value),
    async copy() {
      try { await clipboard(code); if (!mounted.current) return; setFeedback('Copied'); emit('copy', { lang, lines: count }); }
      catch { if (mounted.current) setFeedback('Copy failed'); }
      if (mounted.current) { clearTimeout(timer.current); timer.current = setTimeout(() => setFeedback(''), 1500); }
    },
  };
}
function Container(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} />; }
function Label(props: HTMLAttributes<HTMLSpanElement>) { return <span {...props} />; }
function Icon({ copy = false }: { copy?: boolean }) {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{copy ? <><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M10 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></> : <path d="M2 4h9a3 3 0 0 1 0 6H5m3-3-3 3 3 3" />}</svg>;
}
function Line({ html, ...props }: HTMLAttributes<HTMLSpanElement> & { html: string }) { return <span {...props} dangerouslySetInnerHTML={{ __html: html || '\n' }} />; }
export function CodeBlock({ node, props, complete }: PrismComponentProps<CodeBlockProps>) {
  const vm = useCodeBlock({ ...props, code: props.code ?? node.value, lang: props.lang ?? node.lang, meta: props.meta ?? node.meta, complete }, usePrism());
  const frame = useFrame({ component: 'codeblock', label: vm.label });
  const root = usePart('codeblock', 'root', vm.complete ? 'done' : 'streaming'), header = usePart('codeblock', 'header');
  const actions = usePart('codeblock', 'actions'), label = usePart('codeblock', 'label'), body = usePart('codeblock', 'body', vm.collapsed ? 'collapsed' : 'expanded');
  const copy = usePart('codeblock', 'copy', vm.feedback === 'Copied' ? 'copied' : 'idle'), wrap = usePart('codeblock', 'wrap'), collapse = usePart('codeblock', 'collapse');
  const line = usePart('codeblock', 'line'), content = usePart('codeblock', 'content'), gutter = usePart('codeblock', 'gutter'), status = usePart('codeblock', 'status'), ask = usePart('codeblock', 'ask');
  const Root = useSlot('codeblock', 'root', Container), Header = useSlot('codeblock', 'header', Container), Actions = useSlot('codeblock', 'actions', Container);
  const Body = useSlot('codeblock', 'body', Container), Title = useSlot('codeblock', 'label', Label), Copy = useSlot('codeblock', 'copy', Button);
  const Wrap = useSlot('codeblock', 'wrap', Button), Collapse = useSlot('codeblock', 'collapse', Button), Row = useSlot('codeblock', 'line', Line);
  const Gutter = useSlot('codeblock', 'gutter', Label), Status = useSlot('codeblock', 'status', Label), Ask = useSlot('codeblock', 'ask', Button);
  const htmlLines = vm.html.replace(/\n$/, '').split('\n');
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const body = pre.current?.parentElement;
    if (body && vm.collapsed) body.scrollTop = vm.complete ? 0 : body.scrollHeight;
  }, [vm.code, vm.complete, vm.collapsed]);
  return <Root {...root} role="region" aria-label={vm.label} onKeyDown={frame.rootProps.onKeyDown} data-animate={vm.animate ? undefined : 'false'}>
    <Header {...header}><Title {...label}>{vm.label}</Title><Actions {...actions}>
      <Wrap {...wrap} aria-label="Toggle line wrap" aria-pressed={vm.wrap} onClick={vm.toggleWrap}><Icon /></Wrap>
      <Ask {...ask} aria-label="Ask about this code" onClick={frame.onAsk}>?</Ask>
      <Copy {...copy} aria-label="Copy code" onClick={vm.copy}>{vm.feedback === 'Copied' ? 'Copied' : <Icon copy />}</Copy>
    </Actions></Header>
    <Body {...body} data-tail={!vm.complete && vm.collapsed ? 'true' : undefined} style={{ height: vm.collapsed ? vm.threshold * 22 + 24 : undefined, ...body.style }} data-wrap={vm.wrap ? 'true' : 'false'}><pre ref={pre}><code>{htmlLines.slice(0, vm.collapsed && vm.complete ? vm.threshold : undefined).map((html, index) => {
      const raw = vm.rawLines[index] ?? '', metadata = vm.lang === 'diff' && /^(?:---|\+\+\+|@@)/.test(raw);
      const state = metadata ? undefined : raw.startsWith('+') ? 'inserted' : raw.startsWith('-') ? 'deleted' : undefined;
      return <span key={index} {...line} data-state={state}><Gutter {...gutter} aria-hidden="true">{state ? (state === 'inserted' ? '+' : '−') : vm.lines ? index + 1 : ''}</Gutter><Row {...content} html={state ? html.replace(/^((?:<[^>]+>)*)[+-]/, '$1') : html} /></span>;
    })}</code></pre></Body>
    {vm.collapsible && <Collapse {...collapse} disabled={!vm.complete} aria-expanded={vm.expanded} onClick={vm.toggleCollapse}>{!vm.complete ? 'Streaming…' : vm.collapsed ? `Show all ${vm.count} lines` : 'Show less'}</Collapse>}
    <Status {...status} role="status" aria-live="polite">{vm.feedback}</Status>
  </Root>;
}
export const codeBlockDefinition = defineComponent({ name: 'code', schema: codeBlockSchema, component: CodeBlock,
  docs: 'Highlighted fenced code with copy, line numbers, wrapping and collapse.',
  examples: ['```ts {lines title="example.ts"}\nconst answer = 42;\n```'], syntax: 'leaf' });
registerComponent(codeBlockDefinition);
