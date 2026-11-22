import { useEffect, useId, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import { StreamSkeleton, cx, useComponentState, useEmit, useFormat, usePart, usePrism, useSent, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame, FrameIcon } from '../frame';
import { Checkbox, CheckMark, IconButton, Odometer, Pill } from '../shared';

export interface SummarySource { quote?: string; title?: string; url?: string }
export interface SummaryPoint { text: string; source?: SummarySource }
export interface SummaryAction { text: string; owner?: string; due?: string }
export interface SummaryProps { id?: string; title?: string; headline?: string; actionsTitle?: string; points?: SummaryPoint[]; actions?: SummaryAction[] }
function Point(props: HTMLAttributes<HTMLLIElement>) { return <li {...props} />; }
function Source(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Action(props: HTMLAttributes<HTMLLIElement>) { return <li {...props} />; }
function Empty(props: HTMLAttributes<HTMLParagraphElement>) { return <p {...props} />; }
function sourceLink(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' || url.protocol === 'http:' ? { href: url.href, hostname: url.hostname } : undefined; } catch { return undefined; }
}
function ownerDetails(owner: string) {
  const words = owner.trim().split(/\s+/).filter(Boolean), initials = [words[0]?.[0], words.length > 1 ? words.at(-1)?.[0] : undefined].join('').toLocaleUpperCase();
  let hash = 0; for (const char of owner) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return { initials, hue: Math.abs(hash % 360) + 'deg' };
}
export function useSummary(props: SummaryProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const receipt = useSent(), emit = useEmit(), format = useFormat(), prefix = useId(), pointListRef = useRef<HTMLUListElement>(null);
  const [done, setDone] = useComponentState<Record<string, boolean>>('done', {}), [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const points = props.points ?? [], actions = props.actions ?? [], state = ctx.complete ? receipt.sent ? 'sent' : 'done' : 'streaming';
  const revision = JSON.stringify([props.title, props.actions, done]), previous = useRef(revision);
  useEffect(() => { if (previous.current !== revision) { previous.current = revision; receipt.reset(); } }, [revision, receipt.reset]);
  const parts = {
    headline: usePart('summary', 'headline', state), meta: usePart('summary', 'meta', state), checkboxWrap: usePart('summary', 'checkboxWrap', state),
    points: usePart('summary', 'points', state), point: usePart('summary', 'point', state), pointRow: usePart('summary', 'pointRow', state), pointButton: usePart('summary', 'pointButton', state), pointText: usePart('summary', 'pointText', state), citation: usePart('summary', 'citation', state), pointAsk: usePart('summary', 'pointAsk', state),
    source: usePart('summary', 'source', state), sourceInner: usePart('summary', 'sourceInner', state), quote: usePart('summary', 'quote', state), sourceMeta: usePart('summary', 'sourceMeta', state), sourceTitle: usePart('summary', 'sourceTitle', state), sourceLink: usePart('summary', 'sourceLink', state),
    actions: usePart('summary', 'actions', state), actionsTitle: usePart('summary', 'actionsTitle', state), actionList: usePart('summary', 'actionList', state), action: usePart('summary', 'action', state), actionLabel: usePart('summary', 'actionLabel', state), checkbox: usePart('summary', 'checkbox', state), actionText: usePart('summary', 'actionText', state), actionMeta: usePart('summary', 'actionMeta', state), owner: usePart('summary', 'owner', state), avatar: usePart('summary', 'avatar', state), due: usePart('summary', 'due', state),
    empty: usePart('summary', 'empty', state), skeleton: usePart('summary', 'skeleton', state), send: usePart('summary', 'send', state), progress: usePart('summary', 'progress', state),
  };
  let citation = 0;
  const pointModels = points.map((point, index) => ({ ...point, index, number: point.source ? ++citation : undefined, expanded: !!expanded[index], panelId: prefix + '-source-' + index, buttonId: prefix + '-point-' + index, link: sourceLink(point.source?.url) }));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const actionModels = actions.map((action, index) => {
    const date = action.due ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(action.due) ? action.due + 'T00:00:00' : action.due) : undefined;
    const validDate = date && Number.isFinite(date.getTime()) ? date : undefined;
    return { ...action, index, done: done?.[index] === true, ownerDetails: action.owner ? ownerDetails(action.owner) : undefined, dateTime: validDate?.toISOString(), dueLabel: validDate ? format.date(validDate, { month: 'short', day: 'numeric', year: 'numeric' }) : action.due, overdue: !!validDate && validDate < today };
  });
  const onPointKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const buttons = Array.from(pointListRef.current?.querySelectorAll<HTMLElement>('[data-part="pointButton"], [data-part="pointText"][tabindex]') ?? []);
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(event.currentTarget), next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return { parts, points: pointModels, actions: actionModels, state, pointListRef, onPointKeyDown, sent: !!receipt.sent, completed: actionModels.filter(action => action.done).length,
    loadingPoints: !ctx.complete && props.points === undefined, loadingActions: !ctx.complete && props.actions === undefined,
    togglePoint: (index: number) => setExpanded(old => ({ ...old, [index]: !old[index] })),
    toggleAction: (index: number) => { receipt.reset(); setDone(old => ({ ...old, [index]: !old?.[index] })); },
    askPoint: (index: number) => { const point = points[index]; if (point) emit('ask', { point: index, text: point.text, source: point.source }); },
    canSend: ctx.complete && actions.length > 0 && !receipt.sent,
    send: () => { if (ctx.complete && actions.length && !receipt.sent) receipt.send('send', { title: props.title, actions: actionModels.map(({ text, owner, due, done }) => ({ text, owner, due, done })) }); },
  };
}
export function Summary({ props, complete }: PrismComponentProps<SummaryProps>) {
  const prism = usePrism(), model = useSummary(props, { complete }), { parts } = model;
  const Button = prism.unstyled ? 'button' : Pill, Ask = prism.unstyled ? 'button' : IconButton, Check = prism.unstyled ? 'input' : Checkbox;
  const PointSlot = useSlot('summary', 'point', Point), SourceSlot = useSlot('summary', 'source', Source), ActionSlot = useSlot('summary', 'action', Action), EmptySlot = useSlot('summary', 'empty', Empty);
  return <ComponentFrame component="summary" className={!prism.unstyled && props.headline ? 'prism-summary--headline' : undefined} title={props.title ?? (complete ? 'Summary' : '')} label={props.title || 'Summary'} state={model.state} ask undo toolbar={<span {...parts.meta}>{model.points.length} point{model.points.length === 1 ? '' : 's'} · {model.actions.length} action{model.actions.length === 1 ? '' : 's'}</span>} actions={<><Button {...parts.send} type="button" disabled={!model.canSend} onClick={model.send} {...(!prism.unstyled ? { sent: model.sent, receipt: 'Sent · ' + model.actions.length + ' action item' + (model.actions.length === 1 ? '' : 's') } : {})}>{model.sent && prism.unstyled ? 'Sent · ' + model.actions.length + ' action items' : <>Send {model.actions.length} action item{model.actions.length === 1 ? '' : 's'}<span aria-hidden="true">↗</span></>}</Button><span {...parts.progress} role="status" aria-label={model.completed + ' of ' + model.actions.length + ' complete'}>{model.actions.length > 0 ? <>{prism.unstyled ? model.completed : <Odometer value={model.completed} animate={prism.animate} />} of {model.actions.length} complete</> : ''}</span></>}>
    {props.headline && <h2 {...parts.headline}>{props.headline}</h2>}
    <ul {...parts.points} ref={model.pointListRef}>
      {model.loadingPoints && [0, 1, 2].map(index => <li {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.points.map(point => <PointSlot {...parts.point} className={cx(parts.point.className, !prism.unstyled && 'prism-materialise')} style={{ ...parts.point.style, '--prism-enter-delay': Math.min(point.index, 6) * 40 + 'ms' } as CSSProperties} key={point.index}>
        <div {...parts.pointRow}>
          {point.source ? <button {...parts.pointButton} type="button" id={point.buttonId} aria-expanded={point.expanded} aria-controls={point.panelId} onClick={() => model.togglePoint(point.index)} onKeyDown={model.onPointKeyDown}><span {...parts.pointText}>{point.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</span><span {...parts.citation}>{point.number}</span></button> : <p {...parts.pointText} tabIndex={0} onKeyDown={model.onPointKeyDown}>{point.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</p>}
          <Ask {...parts.pointAsk} type="button" aria-label={'Ask about point ' + (point.index + 1)} title={'Ask about point ' + (point.index + 1)} onClick={() => model.askPoint(point.index)}><FrameIcon name="ask" /></Ask>
        </div>
        {point.source && <SourceSlot {...parts.source} id={point.panelId} role="region" aria-label={'Source ' + point.number} aria-labelledby={point.buttonId} aria-hidden={!point.expanded} inert={!point.expanded} data-expanded={point.expanded ? '' : undefined}>
          <div {...parts.sourceInner}><blockquote {...parts.quote}>{point.source.quote}</blockquote><div {...parts.sourceMeta}>{point.source.title && <><span aria-hidden="true">{String(point.number).padStart(2, '0')} · </span><span {...parts.sourceTitle}>{point.source.title}</span></>}{point.link && <a {...parts.sourceLink} href={point.link.href} target="_blank" rel="noopener noreferrer">{point.link.hostname}<span aria-hidden="true"> ↗</span></a>}</div></div>
        </SourceSlot>}
      </PointSlot>)}
    </ul>
    {!model.loadingPoints && !model.points.length && <EmptySlot {...parts.empty}>No summary points yet.</EmptySlot>}
    <section {...parts.actions} aria-label="Action items"><h4 {...parts.actionsTitle}>{props.actionsTitle ?? 'Action items'}</h4><ul {...parts.actionList}>
      {model.loadingActions && [0, 1].map(index => <li {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.actions.map(action => <ActionSlot {...parts.action} className={cx(parts.action.className, !prism.unstyled && 'prism-materialise')} key={action.index} data-checked={action.done ? '' : undefined}>
        <label {...parts.actionLabel}><span {...parts.checkboxWrap}><Check {...parts.checkbox} type="checkbox" checked={action.done} onChange={() => model.toggleAction(action.index)} aria-label={action.text || 'Action item ' + (action.index + 1)} />{!prism.unstyled && <CheckMark draw={action.done && prism.animate} />}</span><span {...parts.actionText}>{action.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</span></label>
        <div {...parts.actionMeta}>{action.owner && <span {...parts.owner} title={action.owner} aria-label={action.owner}><span {...parts.avatar} aria-hidden="true" style={{ ...parts.avatar.style, '--prism-summary-owner-hue': action.ownerDetails?.hue } as CSSProperties}>{action.ownerDetails?.initials}</span></span>}{action.due && <time {...parts.due} dateTime={action.dateTime} data-tone={action.overdue ? 'warning' : undefined}>{action.dueLabel}</time>}</div>
      </ActionSlot>)}
    </ul>{!model.loadingActions && !model.actions.length && <EmptySlot {...parts.empty}>No action items.</EmptySlot>}</section>
  </ComponentFrame>;
}
export function SummarySkeleton({ props }: PrismComponentProps<SummaryProps>) {
  const { unstyled } = usePrism(), headline = usePart('summary', 'headline'), root = usePart('summary', 'root'), header = usePart('summary', 'header'), title = usePart('summary', 'title'), actionsTitle = usePart('summary', 'actionsTitle'), line = usePart('summary', 'skeleton');
  const placeholder = (width: number, height: number, index: number) => <span {...line} data-prism-skeleton-line="" key={index} style={{ ...line.style, '--prism-skeleton-width': width + '%', '--prism-skeleton-height': height + 'px' } as CSSProperties} />;
  return <StreamSkeleton {...root} className={cx(root.className, !unstyled && props.headline && 'prism-summary--headline')}><header {...header}><h3 {...title}>{props.title}</h3></header>{props.headline && <h2 {...headline}>{props.headline}</h2>}{[85, 100, 90].map((width, index) => placeholder(width, 58, index))}<h4 {...actionsTitle}>{props.actionsTitle ?? 'Action items'}</h4>{[0, 1].map(index => placeholder(65, 48, index))}{placeholder(27, 36, 5)}</StreamSkeleton>;
}
