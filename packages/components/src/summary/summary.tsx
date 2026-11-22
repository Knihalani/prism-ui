import { componentStrings } from '../strings';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useStrings, Icon, PrismPart, StreamSkeleton, useSent, useComponentState, useEmit, useFormat, usePart, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface SummarySource { quote?: string; title?: string; url?: string }
export interface SummaryPoint { text: string; source?: SummarySource }
export interface SummaryAction { text: string; owner?: string; due?: string }
export interface SummaryProps { id?: string; title?: string; points?: SummaryPoint[]; actions?: SummaryAction[] }
function sourceLink(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' || url.protocol === 'http:' ? { href: url.href, hostname: url.hostname } : undefined; } catch { return undefined; }
}
function ownerDetails(owner: string) {
  const words = owner.trim().split(/\s+/).filter(Boolean), initials = [words[0]?.[0], words.length > 1 ? words.at(-1)?.[0] : undefined].join('').toLocaleUpperCase();
  let hash = 0; for (const char of owner) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return { initials, hue: Math.abs(hash % 360) + 'deg' };
}
export function useSummary(props: SummaryProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const { sent, send, reset } = useSent(), strings = useStrings('summary', componentStrings.summary);
  const emit = useEmit(), format = useFormat(), prefix = useId(), pointListRef = useRef<HTMLUListElement>(null);
  const [done, setDone] = useComponentState<Record<string, boolean>>('done', {}), [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const points = props.points ?? [], actions = props.actions ?? [], state = sent ? 'sent' : ctx.complete ? 'done' : 'streaming';
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
  return { parts, sent: !!sent, strings, title: strings.title, points: pointModels, actions: actionModels, state, pointListRef, onPointKeyDown, completed: actionModels.filter(action => action.done).length,
    loadingPoints: !ctx.complete && props.points === undefined, loadingActions: !ctx.complete && props.actions === undefined,
    togglePoint: (index: number) => setExpanded(old => ({ ...old, [index]: !old[index] })),
    toggleAction: (index: number) => { reset(); setDone(old => ({ ...old, [index]: !old?.[index] })); },
    askPoint: (index: number) => { const point = points[index]; if (point) emit('ask', { point: index, text: point.text, source: point.source }, strings.askPointMessage.replace('{text}', point.text)); },
    canSend: ctx.complete && actions.length > 0 && !sent,
    send: () => { if (ctx.complete && actions.length && !sent) send('send', { title: props.title, actions: actionModels.map(({ text, owner, due, done }) => ({ text, owner, due, done })) }, strings.sendMessage.replace('{count}', format.number(actions.length)).replace('{items}', actionModels.map(action => action.text).join('; '))); },
  };
}
export type SummaryModel = ReturnType<typeof useSummary>;
export interface SummarySlotProps { summary: SummaryModel; point?: SummaryModel['points'][number]; action?: SummaryModel['actions'][number] }
export function SummarySkeleton() {
  const root = usePart('summary', 'root'), skeleton = usePart('summary', 'skeleton');
  return <StreamSkeleton {...root}>{[0, 1, 2, 3, 4].map(index => <PrismPart as="div" {...skeleton} key={index} data-prism-skeleton-line="" />)}</StreamSkeleton>;
}
export function Summary({ props, complete }: PrismComponentProps<SummaryProps>) {
  const model = useSummary(props, { complete }), { parts, strings: themeStrings } = model;
  return <ComponentFrame component="summary" title={complete ? model.title : ''} label={model.title} state={model.state} ask undo actions={<><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.progress}>{model.actions.length > 0 ? model.completed + themeStrings.of + model.actions.length + themeStrings.complete : ''}</PrismPart><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="button" {...parts.send} type="button" disabled={!model.canSend} onClick={model.send}>{model.sent ? themeStrings.sent : themeStrings.sendActionItems}<Icon name={model.sent ? "check" : "send"} /></PrismPart></>}>
    <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="ul" {...parts.points} ref={model.pointListRef}>
      {model.loadingPoints && [0, 1, 2].map(index => <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="li" {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.points.map(point => <PrismPart slotProps={{ summary: model, point } satisfies SummarySlotProps} as="li" {...parts.point} key={point.index}>
        <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="div" {...parts.pointRow}>
          {point.source ? <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="button" {...parts.pointButton} type="button" id={point.buttonId} aria-expanded={point.expanded} aria-controls={point.panelId} onClick={() => model.togglePoint(point.index)} onKeyDown={model.onPointKeyDown}><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.pointText}>{point.text || (!complete ? <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.citation}>{point.number}</PrismPart></PrismPart> : <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="p" {...parts.pointText} tabIndex={0} onKeyDown={model.onPointKeyDown}>{point.text || (!complete ? <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart>}
          <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="button" {...parts.pointAsk} type="button" aria-label={themeStrings.askAboutPoint + (point.index + 1)} title={themeStrings.askAboutThis} onClick={() => model.askPoint(point.index)}><Icon name="ask" /></PrismPart>
        </PrismPart>
        {point.source && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="div" {...parts.source} id={point.panelId} role="region" aria-label={themeStrings.source + point.number} aria-labelledby={point.buttonId} aria-hidden={!point.expanded} inert={!point.expanded} data-expanded={point.expanded ? '' : undefined}>
          <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="div" {...parts.sourceInner}><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="blockquote" {...parts.quote}>{point.source.quote}</PrismPart><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="div" {...parts.sourceMeta}>{point.source.title && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.sourceTitle}>{point.source.title}</PrismPart>}{point.link && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="a" {...parts.sourceLink} href={point.link.href} target="_blank" rel="noopener noreferrer">{point.link.hostname}<Icon name="external" /></PrismPart>}</PrismPart></PrismPart>
        </PrismPart>}
      </PrismPart>)}
    </PrismPart>
    {!model.loadingPoints && !model.points.length && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="p" {...parts.empty}>{themeStrings.noSummaryPointsYet}</PrismPart>}
    <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="section" {...parts.actions} aria-label={themeStrings.actionItems}><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="h4" {...parts.actionsTitle}>{themeStrings.actionItems}</PrismPart><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="ul" {...parts.actionList}>
      {model.loadingActions && [0, 1].map(index => <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="li" {...parts.skeleton} key={index} aria-hidden="true" />)}
      {model.actions.map(action => <PrismPart slotProps={{ summary: model, action } satisfies SummarySlotProps} as="li" {...parts.action} key={action.index} data-checked={action.done ? '' : undefined}>
        <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="label" {...parts.actionLabel}><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="input" {...parts.checkbox} type="checkbox" checked={action.done} onChange={() => model.toggleAction(action.index)} aria-label={action.text || themeStrings.actionItem + (action.index + 1)} /><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.actionText}>{action.text || (!complete ? <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.skeleton} aria-hidden="true" /> : '')}</PrismPart></PrismPart>
        <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="div" {...parts.actionMeta}>{action.owner && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.owner}><PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="span" {...parts.avatar} aria-hidden="true" style={{ ...parts.avatar.style, '--prism-summary-owner-hue': action.ownerDetails?.hue } as CSSProperties}>{action.ownerDetails?.initials}</PrismPart>{action.owner}</PrismPart>}{action.due && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="time" {...parts.due} dateTime={action.dateTime} data-tone={action.overdue ? 'warning' : undefined}>{action.dueLabel}</PrismPart>}</PrismPart>
      </PrismPart>)}
    </PrismPart>{!model.loadingActions && !model.actions.length && <PrismPart slotProps={{ summary: model } satisfies SummarySlotProps} as="p" {...parts.empty}>{themeStrings.noActionItems}</PrismPart>}</PrismPart>
  </ComponentFrame>;
}
