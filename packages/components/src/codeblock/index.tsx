import { componentStrings, formatComponentMessage } from '../strings';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStrings, useFormat, Icon, PrismPart, cx, defineComponent, registerComponent, StreamSkeleton, useComponentState, useEmit, usePart, usePrism, type PrismContextValue, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { useFrame } from '../frame';
import { createIncremental, escapeHTML, highlight } from '../lib/highlight';

export { setHighlighter } from '../lib/highlight';
export type CodeHighlighter = (code: string, lang: string) => string;
export const CodeBlockHighlighterContext = createContext<CodeHighlighter | undefined>(undefined);
export interface CodeBlockProps {
  id?: string; code?: string; lang?: string; meta?: string; title?: string; filename?: string;
  lines?: boolean; wrap?: boolean; collapse?: boolean; collapseAfter?: number; complete?: boolean; highlighter?: CodeHighlighter;
  highlight?: string; labels?: Partial<typeof componentStrings.codeblock>;
}
export const codeBlockSchema = s.object({
  id: s.string().optional(), code: s.string().optional(), lang: s.string().optional(), meta: s.string().optional(),
  title: s.string().optional(), filename: s.string().optional(), lines: s.boolean().optional(), wrap: s.boolean().optional(),
  collapse: s.boolean().optional(), collapseAfter: s.number({ min: 1 }).optional(), complete: s.boolean().optional(),
  highlight: s.string().optional().describe('Highlighted line numbers and ranges, such as 2,5-7.'),
  labels: s.object(Object.fromEntries(Object.keys(componentStrings.codeblock).map(key => [key, s.string().optional()]))).optional(),
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
const languageLabels: Readonly<Record<string, string>> = { js: 'languageJs', ts: 'languageTs', py: 'languagePy', sh: 'languageSh' };
async function clipboard(code: string) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); return; } } catch {}
  const previous = document.activeElement as HTMLElement | null, input = document.createElement('textarea');
  input.value = code; input.setAttribute('aria-hidden', 'true'); input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  try { if (!document.execCommand('copy')) throw Error('Copy unavailable'); }
  finally { input.remove(); previous?.focus(); }
}
export function useCodeBlock(props: CodeBlockProps, ctx: PrismContextValue) {
  const strings = { ...useStrings('code', componentStrings.codeblock, props), ...useStrings('codeblock') }, format = useFormat();
  const inherited = useContext(CodeBlockHighlighterContext), backend = typeof props.highlighter === 'function' ? props.highlighter : inherited;
  const meta = useMemo(() => metadata(props.meta), [props.meta]);
  const code = typeof props.code === 'string' ? props.code : '', lang = typeof props.lang === 'string' ? props.lang : '', complete = props.complete !== false;
  const [wrap, setWrap] = useComponentState('wrap', props.wrap ?? !!meta.wrap);
  const [expanded, setExpanded] = useComponentState('expanded', false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle'), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  const collapsible = (props.collapse ?? meta.collapse) !== false && count > threshold, collapsed = collapsible && !expanded;
  const label = strings.filename ?? strings.title ?? String(meta.filename ?? meta.title ?? (lang || strings.plainText));
  const frame = useFrame({ component: 'codeblock', label });
  const parts = {
    root: usePart('codeblock', 'root'), header: usePart('codeblock', 'header'), actions: usePart('codeblock', 'actions'), label: usePart('codeblock', 'label'),
    body: usePart('codeblock', 'body', collapsed ? 'collapsed' : 'expanded'), pre: usePart('codeblock', 'pre'), code: usePart('codeblock', 'code'),
    copy: usePart('codeblock', 'copy', copyState), wrap: usePart('codeblock', 'wrap'), collapse: usePart('codeblock', 'collapse'), collapseLabel: usePart('codeblock', 'collapseLabel'),
    line: usePart('codeblock', 'line'), content: usePart('codeblock', 'content'), gutter: usePart('codeblock', 'gutter'), status: usePart('codeblock', 'status'), ask: usePart('codeblock', 'ask'), askLabel: usePart('codeblock', 'askLabel'), skeleton: usePart('codeblock', 'skeleton'),
  };
  const rows = html.replace(/\n$/, '').split('\n').slice(0, collapsed && complete ? threshold : undefined).map((html, index) => {
    const raw = rawLines[index] ?? '', metadata = lang === 'diff' && /^(?:---|\+\+\+|@@)/.test(raw);
    const state = metadata ? undefined : raw.startsWith('+') ? 'inserted' : raw.startsWith('-') ? 'deleted' : undefined;
    return { index, state, html: state ? html.replace(/^((?:<[^>]+>)*)[+-]/, '$1') : html,
      gutter: state ? state === 'inserted' ? '+' : '−' : props.lines ?? !!meta.lines ? format.number(index + 1) : '',
      highlighted: highlights.some(([start, end]) => index + 1 >= start && index + 1 <= end) };
  });
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const body = pre.current?.parentElement;
    if (body && collapsed) body.scrollTop = complete ? 0 : body.scrollHeight;
  }, [code, complete, collapsed]);
  const language = !ctx.unstyled && Object.hasOwn(languageLabels, lang) ? strings[languageLabels[lang]] : lang;
  return { code, lang, html, rawLines, highlights, count, threshold, collapsed, collapsible, expanded, wrap, copyState, strings, parts, rows, pre,
    complete, animate: ctx.animate, unstyled: ctx.unstyled, label, lines: props.lines ?? !!meta.lines,
    feedback: copyState === 'copied' ? strings.copied : copyState === 'error' ? strings.copyFailed : '',
    heading: ctx.unstyled || !lang ? label : label === lang ? language : label + ' · ' + language,
    collapseLabel: !complete ? strings.streaming : collapsed ? formatComponentMessage(strings.showAll, { count: format.number(count) }) : strings.showLess,
    bodyStyle: { '--prism-codeblock-visible-lines': collapsed ? threshold : undefined, ...parts.body.style } as CSSProperties,
    rootProps: { ...parts.root, onKeyDown: frame.rootProps.onKeyDown, 'data-state': frame.rootProps['data-state'], 'data-entering': frame.rootProps['data-entering'], 'data-animate': ctx.animate ? undefined : 'false' },
    onAsk: () => emit('ask'),
    toggleWrap: () => setWrap(value => !value), toggleCollapse: () => setExpanded(value => !value),
    async copy() {
      try { await clipboard(code); if (!mounted.current) return; setCopyState('copied'); emit('copy', { lang, lines: count }, formatComponentMessage(strings.copyMessage, { payload: JSON.stringify({ lang, lines: count }) })); }
      catch { if (mounted.current) setCopyState('error'); }
      if (mounted.current) { clearTimeout(timer.current); timer.current = setTimeout(() => setCopyState('idle'), 1500); }
    },
  };
}
export type CodeBlockModel = ReturnType<typeof useCodeBlock>;
export interface CodeBlockSlotProps { codeblock: CodeBlockModel; row?: CodeBlockModel['rows'][number]; html?: string }
export function CodeBlock({ node, props, complete }: PrismComponentProps<CodeBlockProps>) {
  const vm = useCodeBlock({ ...props, code: props.code ?? node.value, lang: props.lang ?? node.lang, meta: props.meta ?? node.meta, complete }, usePrism()), { parts, strings } = vm;
  const slotProps = { codeblock: vm } satisfies CodeBlockSlotProps;
  return <PrismPart as="div" {...vm.rootProps} slotProps={slotProps} className={cx(parts.root.className, !vm.unstyled && 'prism-materialise') || undefined} role="region" aria-label={vm.label} data-lines={vm.lines || vm.lang === 'diff' ? '' : undefined}>
    <PrismPart as="div" {...parts.header} slotProps={slotProps}>
      <PrismPart as="span" {...parts.label} slotProps={slotProps}>{vm.heading}</PrismPart>
      <PrismPart as="button" {...parts.copy} slotProps={slotProps} type="button" aria-label={strings.copyCode} title={vm.feedback || strings.copyCode} onClick={vm.copy}>{vm.copyState === 'copied' ? strings.copied : strings.copy}</PrismPart>
    </PrismPart>
    <PrismPart as="div" {...parts.body} slotProps={slotProps} tabIndex={0} data-tail={!vm.complete && vm.collapsed ? 'true' : undefined} data-streaming={!vm.complete ? '' : undefined} style={vm.bodyStyle} data-wrap={vm.wrap ? 'true' : 'false'}>
      <PrismPart as="pre" {...parts.pre} slotProps={slotProps} ref={vm.pre}><PrismPart as="code" {...parts.code} slotProps={slotProps}>
        {vm.rows.map(row => <PrismPart as="span" key={row.index} {...parts.line} slotProps={{ codeblock: vm, row } satisfies CodeBlockSlotProps} data-state={row.state} data-highlight={row.highlighted ? '' : undefined}>
          <PrismPart as="span" {...parts.gutter} slotProps={{ codeblock: vm, row } satisfies CodeBlockSlotProps} aria-hidden="true">{row.gutter}</PrismPart>
          {!vm.unstyled && !vm.code && !vm.complete
            ? <PrismPart as={StreamSkeleton} {...parts.skeleton} slotProps={slotProps} data-prism-skeleton-line="" />
            : <PrismPart as="span" {...parts.content} slotProps={{ codeblock: vm, row, html: row.html } satisfies CodeBlockSlotProps} dangerouslySetInnerHTML={{ __html: row.html || '\n' }} />}
        </PrismPart>)}
      </PrismPart></PrismPart>
    </PrismPart>
    <PrismPart as="div" {...parts.actions} slotProps={slotProps}>
      <PrismPart as="button" {...parts.wrap} slotProps={slotProps} type="button" aria-label={strings.toggleLineWrap} title={strings.toggleLineWrap} aria-pressed={vm.wrap} onClick={vm.toggleWrap}>{strings.wrapLines}</PrismPart>
      <PrismPart as="button" {...parts.ask} slotProps={slotProps} type="button" aria-label={strings.askAboutThisCode} title={strings.askAboutThisCode} onClick={vm.onAsk}><Icon name="ask" /><PrismPart as="span" {...parts.askLabel} slotProps={slotProps}>{strings.askAboutThisCode}</PrismPart></PrismPart>
      {vm.collapsible && <PrismPart as="button" {...parts.collapse} slotProps={slotProps} type="button" disabled={!vm.complete} aria-expanded={vm.expanded} aria-label={vm.collapseLabel} title={vm.collapseLabel} onClick={vm.toggleCollapse}><Icon name="chevron" /><PrismPart as="span" {...parts.collapseLabel} slotProps={slotProps}>{vm.collapseLabel}</PrismPart></PrismPart>}
    </PrismPart>
    <PrismPart as="span" {...parts.status} slotProps={slotProps} role="status" aria-live="polite">{vm.feedback}</PrismPart>
  </PrismPart>;
}
export const codeBlockDefinition = defineComponent({ name: 'code', parts: ['actions', 'ask', 'askLabel', 'body', 'pre', 'code', 'collapse', 'collapseLabel', 'content', 'copy', 'gutter', 'header', 'label', 'line', 'root', 'status', 'wrap', 'skeleton'], strings: componentStrings.codeblock, schema: codeBlockSchema, component: CodeBlock,
  docs: 'Highlighted fenced code with copy, line numbers, wrapping and collapse.',
  examples: ['\x60\x60\x60ts {lines title="example.ts"}\nconst answer = 42;\n\x60\x60\x60'], syntax: 'leaf' });
registerComponent(codeBlockDefinition);
