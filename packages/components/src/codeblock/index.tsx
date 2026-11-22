import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { cx, defineComponent, registerComponent, StreamSkeleton, useComponentState, useEmit, usePart, usePrism, useSlot, type PrismContextValue, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { FrameIcon, useFrame } from '../frame';
import { createIncremental, escapeHTML, highlight } from '../lib/highlight';

export { setHighlighter } from '../lib/highlight';
export type CodeHighlighter = (code: string, lang: string) => string;
export const CodeBlockHighlighterContext = createContext<CodeHighlighter | undefined>(undefined);
export interface CodeBlockProps {
  id?: string; code?: string; lang?: string; meta?: string; title?: string; filename?: string;
  lines?: boolean; wrap?: boolean; collapse?: boolean; collapseAfter?: number; complete?: boolean; highlighter?: CodeHighlighter;
  highlight?: string;
}
export const codeBlockSchema = s.object({
  id: s.string().optional(), code: s.string().optional(), lang: s.string().optional(), meta: s.string().optional(),
  title: s.string().optional(), filename: s.string().optional(), lines: s.boolean().optional(), wrap: s.boolean().optional(),
  collapse: s.boolean().optional(), collapseAfter: s.number({ min: 1 }).optional(), complete: s.boolean().optional(),
  highlight: s.string().optional().describe('Highlighted line numbers and ranges, such as 2,5-7.'),
});
function metadata(meta = ''): Record<string, string | boolean> {
  if (typeof meta !== 'string') return {};
  const result: Record<string, string | boolean> = {};
  for (const match of meta.replace(/[{}]/g, '').matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
    const value = match[2] ?? match[3] ?? match[4]; result[match[1]] = value === undefined ? true : value === 'false' ? false : value;
  }
  return result;
}
function lineRanges(value: unknown) {
  if (typeof value !== 'string') return [];
  return value.split(',').flatMap(part => {
    const range = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    return range ? [[Number(range[1]), Number(range[2] ?? range[1])]] : [];
  });
}
const languageLabels: Readonly<Record<string, string>> = { js: 'JavaScript', ts: 'TypeScript', py: 'Python', sh: 'Shell' };
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
  const highlights = useMemo(() => lineRanges(props.highlight ?? meta.highlight), [props.highlight, meta.highlight]);
  const count = code ? rawLines.length : 0, threshold = Math.max(1, Math.floor(Number.isFinite(props.collapseAfter) ? props.collapseAfter! : 20));
  const collapsible = (props.collapse ?? meta.collapse) !== false && count > threshold;
  const collapsed = collapsible && !expanded;
  return { code, lang, html, rawLines, highlights, count, threshold, collapsed, collapsible, expanded, wrap,
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
function Line({ html, ...props }: HTMLAttributes<HTMLSpanElement> & { html: string }) { return <span {...props} dangerouslySetInnerHTML={{ __html: html || '\n' }} />; }
export function CodeBlock({ node, props, complete }: PrismComponentProps<CodeBlockProps>) {
  const prism = usePrism();
  const vm = useCodeBlock({ ...props, code: props.code ?? node.value, lang: props.lang ?? node.lang, meta: props.meta ?? node.meta, complete }, prism);
  const frame = useFrame({ component: 'codeblock', label: vm.label });
  const root = usePart('codeblock', 'root'), header = usePart('codeblock', 'header');
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
  const language = !prism.unstyled && Object.hasOwn(languageLabels, vm.lang) ? languageLabels[vm.lang] : vm.lang;
  const heading = prism.unstyled || !vm.lang ? vm.label : vm.label === vm.lang ? language : `${vm.label} · ${language}`;
  return <Root {...root} className={cx(root.className, !prism.unstyled && 'prism-materialise') || undefined} role="region" aria-label={vm.label} onKeyDown={frame.rootProps.onKeyDown} data-state={frame.rootProps['data-state']} data-entering={frame.rootProps['data-entering']} data-animate={vm.animate ? undefined : 'false'} data-lines={vm.lines || vm.lang === 'diff' ? '' : undefined}>
    <Header {...header}>
      <Title {...label}>{heading}</Title>
      <Copy {...copy} aria-label="Copy code" title={vm.feedback || 'Copy code'} onClick={vm.copy}>{vm.feedback === 'Copied' ? 'Copied' : 'Copy'}</Copy>
    </Header>
    <Body {...body} data-tail={!vm.complete && vm.collapsed ? 'true' : undefined} data-streaming={!vm.complete ? '' : undefined} style={{ height: vm.collapsed ? vm.threshold * 24.7 + 25 : undefined, ...body.style }} data-wrap={vm.wrap ? 'true' : 'false'}><pre ref={pre}><code>{htmlLines.slice(0, vm.collapsed && vm.complete ? vm.threshold : undefined).map((html, index) => {
      const raw = vm.rawLines[index] ?? '', metadata = vm.lang === 'diff' && /^(?:---|\+\+\+|@@)/.test(raw);
      const state = metadata ? undefined : raw.startsWith('+') ? 'inserted' : raw.startsWith('-') ? 'deleted' : undefined;
      const highlightLine = vm.highlights.some(([start, end]) => index + 1 >= start && index + 1 <= end);
      return <span key={index} {...line} data-state={state} data-highlight={highlightLine ? '' : undefined}>
        <Gutter {...gutter} aria-hidden="true">{state ? (state === 'inserted' ? '+' : '−') : vm.lines ? index + 1 : ''}</Gutter>
        {!prism.unstyled && !vm.code && !vm.complete
          ? <StreamSkeleton as="span" className="prism-codeblock__skeleton" data-prism-skeleton-line="" />
          : <Row {...content} html={state ? html.replace(/^((?:<[^>]+>)*)[+-]/, '$1') : html} />}
      </span>;
    })}</code></pre></Body>
    <Actions {...actions}>
      <Wrap {...wrap} aria-label="Toggle line wrap" title="Toggle line wrap" aria-pressed={vm.wrap} onClick={vm.toggleWrap}>Wrap lines</Wrap>
      <Ask {...ask} aria-label="Ask about this code" title="Ask about this code" onClick={frame.onAsk}><FrameIcon name="ask" /> Ask about this code</Ask>
      {vm.collapsible && <Collapse {...collapse} disabled={!vm.complete} aria-expanded={vm.expanded} onClick={vm.toggleCollapse}>{!vm.complete ? 'Streaming…' : vm.collapsed ? `Show all ${vm.count} lines` : 'Show less'}</Collapse>}
    </Actions>
    <Status {...status} role="status" aria-live="polite">{vm.feedback}</Status>
  </Root>;
}
export const codeBlockDefinition = defineComponent({ name: 'code', schema: codeBlockSchema, component: CodeBlock,
  docs: 'Highlighted fenced code with copy, line numbers, wrapping and collapse.',
  examples: ['```ts {lines title="example.ts"}\nconst answer = 42;\n```'], syntax: 'leaf' });
registerComponent(codeBlockDefinition);
