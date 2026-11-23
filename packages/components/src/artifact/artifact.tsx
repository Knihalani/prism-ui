import { useEffect, useState, type HTMLAttributes } from 'react';
import { Icon as ThemeIcon, PrismPart, defineComponent, useFormat, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { useFeedbackTarget } from '../feedback';
import { artifactSchema, type ArtifactProps } from './model';
import { useArtifact, artifactStrings } from './use-artifact';
import './artifact.css';

const languages = { react: 'tsx', html: 'html', svg: 'html', js: 'js', markdown: 'markdown' };
export type ArtifactModel = ReturnType<typeof useArtifact>;
export type ArtifactSlotProps<T extends React.ElementType = 'div'> = React.ComponentPropsWithRef<T> & { as?: T; model: ArtifactModel };
type VM = ArtifactModel;
type Slot = { model: VM } & HTMLAttributes<HTMLDivElement>;

function Controls({ model, ...part }: Slot) {
  const themeStrings = model.strings;
  const button = usePart('artifact', 'button'), select = usePart('artifact', 'version'), format = useFormat();
  const updating = usePart('artifact', 'updating', model.updating ? 'active' : undefined);
  const modelVersion = model.version?.number ?? 0;
  const viewingCode = model.mode === 'source';
  const codeLabel = viewingCode ? themeStrings.preview : themeStrings.code;
  const sourceDownload = model.mode !== 'preview' || (!model.enabled && model.selected.kind === 'react');
  const downloadLabel = sourceDownload ? themeStrings.downloadSource : themeStrings.download;
  return <PrismPart slotProps={{ model: model }} as="div" {...part}>
    <PrismPart slotProps={{ model: model }} as="span" {...updating} role="status">{model.updating ? themeStrings.updating : ''}</PrismPart>
    {!!model.versions.length && model.versions.length > 1 && <PrismPart slotProps={{ model: model }} as="select" {...select} aria-label={themeStrings.artifactVersion} value={modelVersion} onChange={event => model.selectVersion(Number(event.currentTarget.value))}>
      {[...model.versions].reverse().map(version => <option key={version.number} value={version.number}>{themeStrings.v}{format.number(version.number)}</option>)}
    </PrismPart>}
    {model.previous && <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" aria-pressed={model.mode === 'diff'} onClick={() => model.setMode(model.mode === 'diff' ? 'preview' : 'diff')}>{themeStrings.changes}</PrismPart>}
    <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" data-state={viewingCode ? 'active' : undefined} aria-label={codeLabel} title={codeLabel} onClick={() => model.setMode(viewingCode ? 'preview' : 'source')}><Icon kind={viewingCode ? 'preview' : 'code'} /></PrismPart>
    <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" aria-label={themeStrings.copy} title={themeStrings.copy} onClick={() => void model.copy()}><Icon kind="copy" /></PrismPart>
    <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" aria-label={downloadLabel} title={downloadLabel} onClick={() => void model.download(!sourceDownload)}><Icon kind="download" /></PrismPart>
    {model.enabled && <>
      <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" aria-label={themeStrings.reloadPreview} title={themeStrings.reloadPreview} onClick={model.reload}><Icon kind="reload" /></PrismPart>
      <PrismPart slotProps={{ model: model }} as="button" {...button} type="button" aria-label={model.fullscreen ? themeStrings.exitFullscreen : themeStrings.openFullscreen} title={model.fullscreen ? themeStrings.exitFullscreen : themeStrings.openFullscreen} onClick={() => void model.toggleFullscreen()}><Icon kind={model.fullscreen ? 'close' : 'fullscreen'} /></PrismPart>
    </>}
  </PrismPart>;
}

function Icon({ kind }: { kind: 'code' | 'preview' | 'copy' | 'download' | 'reload' | 'fullscreen' | 'close' }) { return <ThemeIcon name={kind} />; }

function Empty({ model, ...part }: Slot) {
  const themeStrings = model.strings;
  const line = usePart('artifact', 'skeleton-line'), status = usePart('artifact', 'status');
  if (!model.enabled) return <PrismPart slotProps={{ model: model }} as="div" {...part}><PrismPart slotProps={{ model: model }} as="span" {...status}>{themeStrings.previewDisabled}</PrismPart></PrismPart>;
  return <PrismPart slotProps={{ model: model }} as="div" {...part} role="status" aria-label={themeStrings.preparingPreview}><PrismPart slotProps={{ model: model }} as="i" {...line} /><PrismPart slotProps={{ model: model }} as="i" {...line} /><PrismPart slotProps={{ model: model }} as="i" {...line} /></PrismPart>;
}
function Failure({ model, ...part }: Slot) {
  const themeStrings = model.strings;
  const details = usePart('artifact', 'error-message'), fix = usePart('artifact', 'fix');
  return <PrismPart slotProps={{ model: model }} as="div" {...part} role="alert">
    <strong>{themeStrings.previewCouldnTRun}</strong>
    <PrismPart slotProps={{ model: model }} as="code" {...details}>{model.error}</PrismPart>
    <PrismPart slotProps={{ model: model }} as="button" {...fix} type="button" onClick={model.fix}>{themeStrings.fixThis}</PrismPart>
  </PrismPart>;
}

function Code({ model, ...part }: Slot) {
  const themeStrings = model.strings;
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
  if (model.mode === 'diff' && model.diff) return <PrismPart slotProps={{ model: model }} as="div" {...part} aria-label={themeStrings.sourceChanges}>
    <PrismPart slotProps={{ model: model }} as="pre" {...codePart} tabIndex={0}>{model.diff.map(({ type, text }, i) =>
      <PrismPart slotProps={{ model: model }} as="code" key={i} {...line} data-state={type}>{type === 'insert' ? '+ ' : type === 'delete' ? '− ' : '  '}{text}{'\n'}</PrismPart>)}</PrismPart>
  </PrismPart>;
  const html = highlight?.kind === kind && highlight.source === source ? highlight.html : undefined;
  return <PrismPart slotProps={{ model: model }} as="div" {...part}><PrismPart slotProps={{ model: model }} as="pre" {...codePart} tabIndex={0} aria-label={themeStrings.artifactSource}>
    {html === undefined ? <code>{source}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
  </PrismPart></PrismPart>;
}

export function Artifact({ props, complete }: PrismComponentProps<ArtifactProps>) {
  const model = useArtifact(props, usePrism(), complete);
  const feedbackTarget = useFeedbackTarget();
  const selected = model.selected;
  const shell = usePart('artifact', 'shell'), preview = usePart('artifact', 'preview'), viewport = usePart('artifact', 'viewport'), iframe = usePart('artifact', 'iframe');
  const controls = usePart('artifact', 'controls'), empty = usePart('artifact', 'empty');
  const error = usePart('artifact', 'error'), source = usePart('artifact', 'source'), notice = usePart('artifact', 'notice');
  const ControlsSlot = useSlot('artifact', 'controls', Controls);
  const EmptySlot = useSlot('artifact', 'empty', Empty);
  const ErrorSlot = useSlot('artifact', 'error', Failure);
  const SourceSlot = useSlot('artifact', 'source', Code);
  const title = model.title;
  return <PrismPart slotProps={{ model: model }} as="div" {...shell} tabIndex={0} aria-label={title} data-artifact-shell="" data-prism-reveal-host="" data-variant={selected.variant} data-size={selected.size}>
    <ComponentFrame slotProps={{ model: model }} component="artifact" title={title} state={model.streaming ? 'streaming' : 'ready'}
      undo toolbar={<ControlsSlot {...controls} data-prism-reveal={selected.variant === 'inline' ? '' : undefined} model={model} />}>
      <PrismPart slotProps={{ model: model }} as="div" {...preview} ref={feedbackTarget} data-feedback-target="" hidden={model.mode !== 'preview'} style={{ ...preview.style, minHeight: !model.measured || model.error || !model.enabled ? model.height : undefined }} aria-busy={model.updating || (model.enabled && !model.rendered && !model.error)}>
        <PrismPart slotProps={{ model: model }} as="div" {...viewport} ref={model.ref} data-prism-resize={model.resizing ? '' : undefined} style={{ height: model.height, ...viewport.style }} hidden={!!model.error || !model.enabled}>{model.needsFrame && <PrismPart as="iframe" {...iframe} slotProps={{ model }} ref={model.iframeRef} style={{ blockSize: viewport.style?.blockSize ?? viewport.style?.height ?? model.height, ...iframe.style }} title={model.title} sandbox="allow-scripts" referrerPolicy="no-referrer" />}</PrismPart>
        {model.error ? <ErrorSlot {...error} model={model} role="alert" /> : (!model.rendered || !model.enabled) && <EmptySlot {...empty} model={model} role={model.enabled ? 'status' : undefined} aria-label={model.enabled ? model.strings.preparingPreview : undefined} />}
      </PrismPart>
      {model.mode !== 'preview' && <SourceSlot {...source} model={model} />}
      {model.notice && <PrismPart slotProps={{ model: model }} as="div" {...notice} role="status">{model.notice}</PrismPart>}
    </ComponentFrame>
  </PrismPart>;
}

export const artifact = defineComponent({
  feedback: true,
  name: 'artifact', parts: ["ask","body","button","code","controls","diff-line","empty","error","error-message","fix","footer","header","iframe","notice","preview","root","shell","skeleton-line","source","status","title","toolbar","undo","updating","version","viewport"], strings: artifactStrings, component: Artifact, schema: artifactSchema,
  docs: 'Bespoke inline visualisations or inputs, only when no built-in fits. Use an enabled artifact fence language with {id=… title="…" height=auto}; source belongs in the body. See the Adaptive inline artifacts section from createSystemPrompt for host tokens, layout and runtime policy.',
  examples: ['```artifact:html {title="Shipping checklist" id=shipping}\n<h1>Shipping checklist</h1><label><input type="checkbox"> Run tests</label>\n```'],
});
