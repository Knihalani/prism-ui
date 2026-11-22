import { useId, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import { useComponentState, useEmit, usePresentation, useSent, useFormat, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface SummarySource { quote?: string; title?: string; url?: string }
export interface SummaryPoint { text: string; source?: SummarySource }
export interface SummaryAction { text: string; owner?: string; due?: string }
export interface SummaryProps { id?: string; title?: string; points?: SummaryPoint[]; actions?: SummaryAction[] }
function Point(props: HTMLAttributes<HTMLLIElement>) { return <li {...props} />; }
function Source(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Action(props: HTMLAttributes<HTMLLIElement>) { return <li {...props} />; }
function Empty(props: HTMLAttributes<HTMLParagraphElement>) { return <p {...props} />; }
export function SummarySkeleton(input: PrismComponentProps<SummaryProps>) {
  return <Summary {...input} />;
}
function sourceLink(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' || url.protocol === 'http:' ? { href: url.href, hostname: url.hostname } : undefined; } catch { return undefined; }
}
function ownerDetails(owner: string) {
  const words = owner.trim().split(/\s+/).filter(Boolean), initials = [words[0]?.[0], words.length > 1 ? words.at(-1)?.[0] : undefined].join('').toLocaleUpperCase();
  let hash = 0; for (const char of owner) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return { initials, hue: Math.abs(hash % 360) + 'deg' };
}
export function useSummary(props: SummaryProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const receipt = useSent();
  const emit = useEmit(), format = useFormat(), prefix = useId(), pointListRef = useRef<HTMLUListElement>(null);
  const [done, setDone] = useComponentState<Record<string, boolean>>('done', {}), [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const points = props.points ?? [], actions = props.actions ?? [], state = ctx.complete ? 'done' : 'streaming';
  const parts = {
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
  return { parts, points: pointModels, actions: actionModels, state, pointListRef, onPointKeyDown, completed: actionModels.filter(action => action.done).length,
    loadingPoints: !ctx.complete && props.points === undefined, loadingActions: !ctx.complete && props.actions === undefined,
    togglePoint: (index: number) => setExpanded(old => ({ ...old, [index]: !old[index] })),
    toggleAction: (index: number) => { receipt.reset(); setDone(old => ({ ...old, [index]: !old?.[index] })); },
    sent: receipt.sent,
    askPoint: (index: number) => { const point = points[index]; if (point) emit('ask', { point: index, text: point.text, source: point.source }); },
    canSend: ctx.complete && actions.length > 0,
    send: () => { if (ctx.complete && actions.length) receipt.send('send', { title: props.title, actions: actionModels.map(({ text, owner, due, done }) => ({ text, owner, due, done })) }); },
  };
}
export function Summary({ props, complete }: PrismComponentProps<SummaryProps>) {
  const presentation = usePresentation(), { unstyled } = usePrism();
  const model = useSummary(props, { complete }), { parts } = model;
  const PointSlot = useSlot('summary', 'point', Point), SourceSlot = useSlot('summary', 'source', Source), ActionSlot = useSlot('summary', 'action', Action), EmptySlot = useSlot('summary', 'empty', Empty);
  return <ComponentFrame component="summary" title={props.title ?? (complete ? 'Summary' : '')} label={props.title || 'Summary'} state={model.state} ask undo actions={<><span {...parts.progress}>{model.actions.length > 0 ? model.completed + ' of ' + model.actions.length + ' complete' : ''}</span><button {...parts.send} className={[parts.send.className, !unstyled && 'prism-pill'].filter(Boolean).join(' ')} type="button" disabled={!model.canSend} onClick={model.send}>{model.sent ? `Sent · ${model.actions.length} action items` : 'Send action items'}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={model.sent ? 'm3 8 3 3 7-7' : 'M2 8h11M9 3l5 5-5 5'} /></svg></button></>}>
    <ul {...parts.points} data-presentation={presentation['data-state']} data-entering={presentation['data-entering']} ref={model.pointListRef}>
      {model.loadingPoints && [0, 1, 2].map(index => <li {...parts.skeleton} data-prism-skeleton-line="" key={index} aria-hidden="true" />)}
      {model.points.map(point => <PointSlot {...parts.point} style={{ ...parts.point.style, '--prism-enter-delay': `${point.index * 45}ms` } as CSSProperties} key={point.index}>
        <div {...parts.pointRow}>
          {point.source ? <button {...parts.pointButton} type="button" id={point.buttonId} aria-expanded={point.expanded} aria-controls={point.panelId} onClick={() => model.togglePoint(point.index)} onKeyDown={model.onPointKeyDown}><span {...parts.pointText}>{point.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</span><span {...parts.citation} className={[parts.citation.className, !unstyled && 'prism-chip'].filter(Boolean).join(' ')}>[{point.number}]</span></button> : <p {...parts.pointText} tabIndex={0} onKeyDown={model.onPointKeyDown}>{point.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</p>}
          <button {...parts.pointAsk} className={[parts.pointAsk.className, !unstyled && 'prism-icon-btn'].filter(Boolean).join(' ')} type="button" aria-label={'Ask about point ' + (point.index + 1)} onClick={() => model.askPoint(point.index)}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 3h10v7H7l-4 3Z" /></svg></button>
        </div>
        {point.source && <SourceSlot {...parts.source} id={point.panelId} role="region" aria-label={'Source ' + point.number} aria-labelledby={point.buttonId} aria-hidden={!point.expanded} inert={!point.expanded} data-expanded={point.expanded ? '' : undefined}>
          <div {...parts.sourceInner}><blockquote {...parts.quote}>{point.source.quote}</blockquote><div {...parts.sourceMeta}>{point.source.title && <span {...parts.sourceTitle}>{point.source.title}</span>}{point.link && <a {...parts.sourceLink} href={point.link.href} target="_blank" rel="noopener noreferrer">{point.link.hostname}<span aria-hidden="true"> ↗</span></a>}</div></div>
        </SourceSlot>}
      </PointSlot>)}
    </ul>
    {!model.loadingPoints && !model.points.length && <EmptySlot {...parts.empty}>No summary points yet.</EmptySlot>}
    <section {...parts.actions} aria-label="Action items"><h4 {...parts.actionsTitle}>Action items</h4><ul {...parts.actionList}>
      {model.loadingActions && [0, 1].map(index => <li {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.actions.map(action => <ActionSlot {...parts.action} style={{ ...parts.action.style, '--prism-enter-delay': `${action.index * 45}ms` } as CSSProperties} key={action.index} data-checked={action.done ? '' : undefined}>
        <label {...parts.actionLabel}><input {...parts.checkbox} className={[parts.checkbox.className, !unstyled && 'prism-check'].filter(Boolean).join(' ')} type="checkbox" checked={action.done} onChange={() => model.toggleAction(action.index)} aria-label={action.text || 'Action item ' + (action.index + 1)} />{!unstyled && <svg className="prism-summary__tick prism-check" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="m5 9 3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}<span {...parts.actionText}>{action.text || (!complete ? <span {...parts.skeleton} aria-hidden="true" /> : '')}</span></label>
        <div {...parts.actionMeta}>{action.owner && <span {...parts.owner}><span {...parts.avatar} aria-hidden="true" style={{ ...parts.avatar.style, '--prism-summary-owner-hue': action.ownerDetails?.hue } as CSSProperties}>{action.ownerDetails?.initials}</span>{action.owner}</span>}{action.due && <time {...parts.due} dateTime={action.dateTime} data-tone={action.overdue ? 'warning' : undefined}>{action.dueLabel}</time>}</div>
      </ActionSlot>)}
    </ul>{!model.loadingActions && !model.actions.length && <EmptySlot {...parts.empty}>No action items.</EmptySlot>}</section>
  </ComponentFrame>;
}
