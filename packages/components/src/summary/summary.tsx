import { componentStrings } from '../strings';
import { useId, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import { useStrings, Icon, PrismPart, useComponentState, useEmit, useFormat, usePart, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface SummarySource { quote?: string; title?: string; url?: string }
export interface SummaryPoint { text: string; source?: SummarySource }
export interface SummaryAction { text: string; owner?: string; due?: string }
export interface SummaryProps { id?: string; title?: string; points?: SummaryPoint[]; actions?: SummaryAction[] }
function Point(props: HTMLAttributes<HTMLLIElement>) { return <PrismPart as="li" {...props} />; }
function Source(props: HTMLAttributes<HTMLDivElement>) { return <PrismPart as="div" {...props} />; }
function Action(props: HTMLAttributes<HTMLLIElement>) { return <PrismPart as="li" {...props} />; }
function Empty(props: HTMLAttributes<HTMLParagraphElement>) { return <PrismPart as="p" {...props} />; }
function sourceLink(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' || url.protocol === 'http:' ? { href: url.href, hostname: url.hostname } : undefined; } catch { return undefined; }
}
function ownerDetails(owner: string) {
  const words = owner.trim().split(/\s+/).filter(Boolean), initials = [words[0]?.[0], words.length > 1 ? words.at(-1)?.[0] : undefined].join('').toLocaleUpperCase();
  let hash = 0; for (const char of owner) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return { initials, hue: Math.abs(hash % 360) + 'deg' };
}
export function useSummary(props: SummaryProps, ctx: Pick<PrismComponentProps, 'complete'>) {
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
    toggleAction: (index: number) => setDone(old => ({ ...old, [index]: !old?.[index] })),
    askPoint: (index: number) => { const point = points[index]; if (point) emit('ask', { point: index, text: point.text, source: point.source }); },
    canSend: ctx.complete && actions.length > 0,
    send: () => { if (ctx.complete && actions.length) emit('send', { title: props.title, actions: actionModels.map(({ text, owner, due, done }) => ({ text, owner, due, done })) }); },
  };
}
export function Summary({ props, complete }: PrismComponentProps<SummaryProps>) {
  const themeStrings = useStrings('summary', componentStrings.summary);
  const model = useSummary(props, { complete }), { parts } = model;
  const PointSlot = useSlot('summary', 'point', Point), SourceSlot = useSlot('summary', 'source', Source), ActionSlot = useSlot('summary', 'action', Action), EmptySlot = useSlot('summary', 'empty', Empty);
  return <ComponentFrame component="summary" title={props.title ?? (complete ? 'Summary' : '')} label={props.title || 'Summary'} state={model.state} ask undo actions={<><PrismPart as="span" {...parts.progress}>{model.actions.length > 0 ? model.completed + themeStrings.of + model.actions.length + themeStrings.complete : ''}</PrismPart><PrismPart as="button" {...parts.send} type="button" disabled={!model.canSend} onClick={model.send}>{themeStrings.sendActionItems}<Icon name="send" /></PrismPart></>}>
    <PrismPart as="ul" {...parts.points} ref={model.pointListRef}>
      {model.loadingPoints && [0, 1, 2].map(index => <PrismPart as="li" {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.points.map(point => <PointSlot {...parts.point} key={point.index}>
        <PrismPart as="div" {...parts.pointRow}>
          {point.source ? <PrismPart as="button" {...parts.pointButton} type="button" id={point.buttonId} aria-expanded={point.expanded} aria-controls={point.panelId} onClick={() => model.togglePoint(point.index)} onKeyDown={model.onPointKeyDown}><PrismPart as="span" {...parts.pointText}>{point.text || (!complete ? <PrismPart as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart><PrismPart as="span" {...parts.citation}>[{point.number}]</PrismPart></PrismPart> : <PrismPart as="p" {...parts.pointText} tabIndex={0} onKeyDown={model.onPointKeyDown}>{point.text || (!complete ? <PrismPart as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart>}
          <PrismPart as="button" {...parts.pointAsk} type="button" aria-label={themeStrings.askAboutPoint + (point.index + 1)} onClick={() => model.askPoint(point.index)}>{themeStrings.askAboutThis}</PrismPart>
        </PrismPart>
        {point.source && <SourceSlot {...parts.source} id={point.panelId} role="region" aria-label={themeStrings.source + point.number} aria-labelledby={point.buttonId} aria-hidden={!point.expanded} inert={!point.expanded} data-expanded={point.expanded ? '' : undefined}>
          <PrismPart as="div" {...parts.sourceInner}><PrismPart as="blockquote" {...parts.quote}>{point.source.quote}</PrismPart><PrismPart as="div" {...parts.sourceMeta}>{point.source.title && <PrismPart as="span" {...parts.sourceTitle}>{point.source.title}</PrismPart>}{point.link && <PrismPart as="a" {...parts.sourceLink} href={point.link.href} target="_blank" rel="noopener noreferrer">{point.link.hostname}<Icon name="external" /></PrismPart>}</PrismPart></PrismPart>
        </SourceSlot>}
      </PointSlot>)}
    </PrismPart>
    {!model.loadingPoints && !model.points.length && <EmptySlot {...parts.empty}>{themeStrings.noSummaryPointsYet}</EmptySlot>}
    <PrismPart as="section" {...parts.actions} aria-label={themeStrings.actionItems}><PrismPart as="h4" {...parts.actionsTitle}>{themeStrings.actionItems}</PrismPart><PrismPart as="ul" {...parts.actionList}>
      {model.loadingActions && [0, 1].map(index => <PrismPart as="li" {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.actions.map(action => <ActionSlot {...parts.action} key={action.index} data-checked={action.done ? '' : undefined}>
        <PrismPart as="label" {...parts.actionLabel}><PrismPart as="input" {...parts.checkbox} type="checkbox" checked={action.done} onChange={() => model.toggleAction(action.index)} aria-label={action.text || 'Action item ' + (action.index + 1)} /><PrismPart as="span" {...parts.actionText}>{action.text || (!complete ? <PrismPart as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart></PrismPart>
        <PrismPart as="div" {...parts.actionMeta}>{action.owner && <PrismPart as="span" {...parts.owner}><PrismPart as="span" {...parts.avatar} aria-hidden="true" style={{ ...parts.avatar.style, '--prism-summary-owner-hue': action.ownerDetails?.hue } as CSSProperties}>{action.ownerDetails?.initials}</PrismPart>{action.owner}</PrismPart>}{action.due && <PrismPart as="time" {...parts.due} dateTime={action.dateTime} data-tone={action.overdue ? 'warning' : undefined}>{action.dueLabel}</PrismPart>}</PrismPart>
      </ActionSlot>)}
    </PrismPart>{!model.loadingActions && !model.actions.length && <EmptySlot {...parts.empty}>{themeStrings.noActionItems}</EmptySlot>}</PrismPart>
  </ComponentFrame>;
}
