import { componentStrings } from '../strings';
import { useEffect, useState, type HTMLAttributes } from 'react';
import { useStrings, Icon as ThemeIcon, PrismPart, defineComponent, useFormat, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { artifactSchema, type ArtifactProps } from './model';
import { useArtifact } from './use-artifact';

const labels = { react: 'React', html: 'HTML', svg: 'SVG', js: 'JavaScript', markdown: 'Markdown' };
const languages = { react: 'tsx', html: 'html', svg: 'html', js: 'js', markdown: 'markdown' };
type VM = ReturnType<typeof useArtifact>;
type Slot = { model: VM } & HTMLAttributes<HTMLDivElement>;

function Controls({ model, ...part }: Slot) {
  const themeStrings = useStrings('artifact', componentStrings.artifact);
  const button = usePart('artifact', 'button'), select = usePart('artifact', 'version'), format = useFormat();
  const updating = usePart('artifact', 'updating', model.updating ? 'active' : undefined);
  const modelVersion = model.version?.number ?? 0;
  const viewingCode = model.mode === 'source';
  const codeLabel = viewingCode ? 'Preview' : 'Code';
  const sourceDownload = model.mode !== 'preview' || (!model.enabled && model.selected.kind === 'react');
  const downloadLabel = sourceDownload ? 'Download source' : 'Download';
  return <PrismPart as="div" {...part}>
    <PrismPart as="span" {...updating} role="status">{model.updating ? themeStrings.updating : ''}</PrismPart>
    {!!model.versions.length && model.versions.length > 1 && <PrismPart as="select" {...select} aria-label={themeStrings.artifactVersion} value={modelVersion} onChange={event => model.selectVersion(Number(event.currentTarget.value))}>
      {[...model.versions].reverse().map(version => <option key={version.number} value={version.number}>{themeStrings.v}{format.number(version.number)}</option>)}
    </PrismPart>}
    {model.previous && <PrismPart as="button" {...button} type="button" aria-pressed={model.mode === 'diff'} onClick={() => model.setMode(model.mode === 'diff' ? 'preview' : 'diff')}>{themeStrings.changes}</PrismPart>}
    <PrismPart as="button" {...button} type="button" data-state={viewingCode ? 'active' : undefined} aria-label={codeLabel} title={codeLabel} onClick={() => model.setMode(viewingCode ? 'preview' : 'source')}><Icon kind={viewingCode ? 'preview' : 'code'} /></PrismPart>
    <PrismPart as="button" {...button} type="button" aria-label={themeStrings.copy} title={themeStrings.copy} onClick={() => void model.copy()}><Icon kind="copy" /></PrismPart>
    <PrismPart as="button" {...button} type="button" aria-label={downloadLabel} title={downloadLabel} onClick={() => void model.download(!sourceDownload)}><Icon kind="download" /></PrismPart>
    {model.enabled && <>
      <PrismPart as="button" {...button} type="button" aria-label={themeStrings.reloadPreview} title={themeStrings.reloadPreview} onClick={model.reload}><Icon kind="reload" /></PrismPart>
      <PrismPart as="button" {...button} type="button" aria-label={model.fullscreen ? themeStrings.exitFullscreen : themeStrings.openFullscreen} title={model.fullscreen ? themeStrings.exitFullscreen : themeStrings.openFullscreen} onClick={() => void model.toggleFullscreen()}><Icon kind={model.fullscreen ? 'close' : 'fullscreen'} /></PrismPart>
    </>}
  </PrismPart>;
}

function Icon({ kind }: { kind: 'code' | 'preview' | 'copy' | 'download' | 'reload' | 'fullscreen' | 'close' }) { return <ThemeIcon name={kind} />; }

function Empty({ model, ...part }: Slot) {
  const themeStrings = useStrings('artifact', componentStrings.artifact);
  const line = usePart('artifact', 'skeleton-line'), status = usePart('artifact', 'status');
  if (!model.enabled) return <PrismPart as="div" {...part}><PrismPart as="span" {...status}>{themeStrings.previewDisabled}</PrismPart></PrismPart>;
  return <PrismPart as="div" {...part} role="status" aria-label={themeStrings.preparingPreview}><PrismPart as="i" {...line} /><PrismPart as="i" {...line} /><PrismPart as="i" {...line} /></PrismPart>;
}
function Failure({ model, ...part }: Slot) {
  const themeStrings = useStrings('artifact', componentStrings.artifact);
  const details = usePart('artifact', 'error-message'), fix = usePart('artifact', 'fix');
  return <PrismPart as="div" {...part} role="alert">
    <strong>{themeStrings.previewCouldnTRun}</strong>
    <PrismPart as="code" {...details}>{model.error}</PrismPart>
    <PrismPart as="button" {...fix} type="button" onClick={model.fix}>{themeStrings.fixThis}</PrismPart>
  </PrismPart>;
}

function Code({ model, ...part }: Slot) {
  const themeStrings = useStrings('artifact', componentStrings.artifact);
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
  if (model.mode === 'diff' && model.diff) return <PrismPart as="div" {...part} aria-label={themeStrings.sourceChanges}>
    <PrismPart as="pre" {...codePart} tabIndex={0}>{model.diff.map(({ type, text }, i) =>
      <PrismPart as="code" key={i} {...line} data-state={type}>{type === 'insert' ? '+ ' : type === 'delete' ? '− ' : '  '}{text}{'\n'}</PrismPart>)}</PrismPart>
  </PrismPart>;
  const html = highlight?.kind === kind && highlight.source === source ? highlight.html : undefined;
  return <PrismPart as="div" {...part}><PrismPart as="pre" {...codePart} tabIndex={0} aria-label={themeStrings.artifactSource}>
    {html === undefined ? <code>{source}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
  </PrismPart></PrismPart>;
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
  return <PrismPart as="div" {...shell} tabIndex={0} aria-label={title} data-artifact-shell="" data-variant={selected.variant} data-size={selected.size}>
    <ComponentFrame component="artifact" title={title} state={!model.enabled ? 'disabled' : model.error ? 'error' : model.rendered ? 'ready' : 'pending'}
      undo ask={false} toolbar={<ControlsSlot {...controls} model={model} />}>
      <PrismPart as="div" {...preview} hidden={model.mode !== 'preview'} style={{ ...preview.style, minHeight: model.height }} aria-busy={model.updating || (model.enabled && !model.rendered && !model.error)}>
        <PrismPart as="div" {...viewport} ref={model.ref} style={{ height: model.height, ...viewport.style }} hidden={!!model.error || !model.enabled} />
        {model.error ? <ErrorSlot {...error} model={model} /> : (!model.rendered || !model.enabled) && <EmptySlot {...empty} model={model} />}
      </PrismPart>
      {model.mode !== 'preview' && <SourceSlot {...source} model={model} />}
      {model.notice && <PrismPart as="div" {...notice} role="status">{model.notice}</PrismPart>}
    </ComponentFrame>
  </PrismPart>;
}

export const artifact = defineComponent({
  feedback: true,
  name: 'artifact', parts: ["ask","body","button","code","controls","diff-line","empty","error","error-message","fix","footer","header","notice","preview","root","shell","skeleton-line","source","status","title","toolbar","undo","updating","version","viewport"], strings: componentStrings.artifact, component: Artifact, schema: artifactSchema,
  docs: 'Build any custom data view or input using a fenced artifact:html, artifact:react, artifact:svg, artifact:js or artifact:markdown block, with {title="…" height=auto id=…} after the language. Put the entire source in the fence body. Artifacts are chromeless inline by default; hover or focus reveals code, versions, fullscreen and graphic feedback. Use var(--prism-text), var(--prism-text-muted), var(--prism-surface), var(--prism-border), var(--prism-accent), var(--prism-on-accent) and the --prism-font-*, --prism-radius-*, --prism-space-* and --prism-motion-* roles, never a hard-coded page palette. The host font, color-scheme and reduced-motion preference update live. Design for 280px through wide chat columns: width:100%, min-width:0, flexible grids, wrapping text, and @container (min-width:...) queries (the document is already an inline-size container). Avoid fixed widths, viewport units and fixed-position page shells. Height auto-sizes; reserve an explicit height only when needed. React accepts one JSX/TSX module with a default component export and allowlisted imports. JS runs as a module with a #app mount point. window.prism.theme contains live CSS token values; listen to document prism:theme for canvas redraws. window.prism.state.get(path), .set(path,value), .subscribe(path,callback) use only host-granted paths; subscribe returns an unsubscribe function. window.prism.emit(type,payload) sends a structured onAction event (send is an alias). HTML scripts execute once the fence completes. Respect reduced motion and include keyboard-accessible inputs. Never request access to unrelated state or external resources.',
  examples: ['```artifact:html {title="Shipping checklist" id=shipping}\n<h1>Shipping checklist</h1><label><input type="checkbox"> Run tests</label>\n```'],
});
