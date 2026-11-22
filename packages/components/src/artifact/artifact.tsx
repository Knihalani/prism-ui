import { useEffect, useState, type HTMLAttributes } from 'react';
import { defineComponent, useFormat, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { artifactSchema, type ArtifactProps } from './model';
import { useArtifact } from './use-artifact';

const labels = { react: 'React', html: 'HTML', svg: 'SVG', js: 'JavaScript', markdown: 'Markdown' };
const languages = { react: 'tsx', html: 'html', svg: 'html', js: 'js', markdown: 'markdown' };
type VM = ReturnType<typeof useArtifact>;
type Slot = { model: VM } & HTMLAttributes<HTMLDivElement>;

function Controls({ model, ...part }: Slot) {
  const button = usePart('artifact', 'button'), select = usePart('artifact', 'version'), format = useFormat();
  const modelVersion = model.version?.number ?? 0;
  const viewingCode = model.mode === 'source';
  const codeLabel = viewingCode ? 'Preview' : 'Code';
  return <div {...part}>
    {!!model.versions.length && model.versions.length > 1 && <select {...select} aria-label="Artifact version" value={modelVersion} onChange={event => model.selectVersion(Number(event.currentTarget.value))}>
      {[...model.versions].reverse().map(version => <option key={version.number} value={version.number}>v{format.number(version.number)}</option>)}
    </select>}
    {model.previous && <button {...button} type="button" aria-pressed={model.mode === 'diff'} onClick={() => model.setMode(model.mode === 'diff' ? 'preview' : 'diff')}>Changes</button>}
    <button {...button} type="button" data-state={viewingCode ? 'active' : undefined} aria-label={codeLabel} title={codeLabel} onClick={() => model.setMode(viewingCode ? 'preview' : 'source')}><Icon kind={viewingCode ? 'preview' : 'code'} /></button>
    <button {...button} type="button" aria-label="Copy" title="Copy" onClick={() => void model.copy()}><Icon kind="copy" /></button>
    <button {...button} type="button" aria-label="Download" title="Download" onClick={() => model.download(model.selected.kind !== 'react')}><Icon kind="download" /></button>
    {model.enabled && <>
      <button {...button} type="button" aria-label="Reload preview" title="Reload preview" onClick={model.reload}><Icon kind="reload" /></button>
      <button {...button} type="button" aria-label={model.fullscreen ? 'Exit fullscreen' : 'Open fullscreen'} title={model.fullscreen ? 'Exit fullscreen' : 'Open fullscreen'} onClick={() => void model.toggleFullscreen()}><Icon kind={model.fullscreen ? 'close' : 'fullscreen'} /></button>
    </>}
  </div>;
}

function Icon({ kind }: { kind: 'code' | 'preview' | 'copy' | 'download' | 'reload' | 'fullscreen' | 'close' }) {
  const paths = {
    code: 'M5 4.5 1.5 8 5 11.5m6-7L14.5 8 11 11.5M9.25 3l-2.5 10',
    preview: 'M1.5 4h13v8h-13zM1.5 6.5h13',
    copy: 'M5.5 5.5h7.5v8h-7.5zM10.5 3H3v8',
    download: 'M8 2.5v7m-3-3 3 3 3-3m-8 4v3h10v-3',
    reload: 'M13.6 7a5.7 5.7 0 1 0-.6 4.2M13.7 3v4h-4',
    fullscreen: 'M6 2.5H2.5V6m7.5-3.5h3.5V6M2.5 10v3.5H6m7.5-3.5v3.5H10',
    close: 'M2.5 6H6V2.5M13.5 6H10V2.5M6 13.5V10H2.5m11 0H10v3.5',
  };
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function Empty({ model, ...part }: Slot) {
  const line = usePart('artifact', 'skeleton-line'), status = usePart('artifact', 'status');
  if (!model.enabled) return <div {...part}><span {...status}>Preview disabled</span></div>;
  return <div {...part} role="status" aria-label="Preparing preview"><i {...line} /><i {...line} /><i {...line} /></div>;
}
function Failure({ model, ...part }: Slot) {
  const details = usePart('artifact', 'error-message'), fix = usePart('artifact', 'fix');
  return <div {...part} role="alert">
    <strong>Preview couldn’t run</strong>
    <code {...details}>{model.error}</code>
    <button {...fix} type="button" onClick={model.fix}>Fix this</button>
  </div>;
}

function Code({ model, ...part }: Slot) {
  const codePart = usePart('artifact', 'code'), line = usePart('artifact', 'diff-line');
  const { kind, source } = model.selected;
  const [highlight, setHighlight] = useState<{ source: string; kind: string; html: string }>();
  useEffect(() => {
    if (model.mode !== 'source') return;
    let alive = true;
    void import('../lib/highlight').then(module => {
      if (alive) setHighlight({ source, kind, html: module.highlight(source, languages[kind]) });
    }).catch(() => {});
    return () => { alive = false; };
  }, [source, kind, model.mode]);
  if (model.mode === 'diff' && model.diff) return <div {...part} aria-label="Source changes">
    <pre {...codePart} tabIndex={0}>{model.diff.map(({ type, text }, i) =>
      <code key={i} {...line} data-state={type}>{type === 'insert' ? '+ ' : type === 'delete' ? '− ' : '  '}{text}{'\n'}</code>)}</pre>
  </div>;
  const html = highlight?.kind === kind && highlight.source === source ? highlight.html : undefined;
  return <div {...part}><pre {...codePart} tabIndex={0} aria-label="Artifact source">
    {html === undefined ? <code>{source}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
  </pre></div>;
}

export function Artifact({ props, complete }: PrismComponentProps<ArtifactProps>) {
  const model = useArtifact(props, usePrism(), complete);
  const selected = model.selected;
  const shell = usePart('artifact', 'shell'), preview = usePart('artifact', 'preview'), viewport = usePart('artifact', 'viewport');
  const controls = usePart('artifact', 'controls'), empty = usePart('artifact', 'empty');
  const error = usePart('artifact', 'error'), source = usePart('artifact', 'source'), notice = usePart('artifact', 'notice');
  const ControlsSlot = useSlot('artifact', 'controls', Controls);
  const EmptySlot = useSlot('artifact', 'empty', Empty);
  const ErrorSlot = useSlot('artifact', 'error', Failure);
  const SourceSlot = useSlot('artifact', 'source', Code);
  const title = selected.title ?? labels[selected.kind] ?? 'Artifact';
  return <div {...shell} data-artifact-shell="" data-variant={selected.variant} data-size={selected.size}>
    <ComponentFrame component="artifact" title={title} state={!model.enabled ? 'disabled' : model.error ? 'error' : model.rendered ? 'ready' : 'pending'}
      undo toolbar={<ControlsSlot {...controls} model={model} />}>
      <div {...preview} hidden={model.mode !== 'preview'} style={{ ...preview.style, minHeight: model.height }} aria-busy={model.enabled && !model.rendered && !model.error}>
        <div {...viewport} ref={model.ref} style={{ height: model.height, ...viewport.style }} hidden={!!model.error || !model.enabled} />
        {model.error ? <ErrorSlot {...error} model={model} /> : (!model.rendered || !model.enabled) && <EmptySlot {...empty} model={model} />}
      </div>
      {model.mode !== 'preview' && <SourceSlot {...source} model={model} />}
      {model.notice && <div {...notice} role="status">{model.notice}</div>}
    </ComponentFrame>
  </div>;
}

export const artifact = defineComponent({
  name: 'artifact', component: Artifact, schema: artifactSchema,
  docs: 'Write a fenced artifact:html, artifact:react, artifact:svg, artifact:js or artifact:markdown block, with {title="…" height=auto id=…} after the language. Put the source in the fence body. React accepts one JSX/TSX module with a default component export and allowlisted imports. JS runs as a module with a #app mount point. Use window.prism.state for host-granted paths and window.prism.send(type, payload) for a structured user action.',
  examples: ['```artifact:html {title="Shipping checklist" id=shipping}\n<h1>Shipping checklist</h1><label><input type="checkbox"> Run tests</label>\n```'],
});
