import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { defineComponent, registerComponent, StreamSkeleton, useFlash, useFormat, useLocalWrite, usePart, usePresentation, usePrism, useSent, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { CheckMark, Chip, Odometer, Pill } from '../shared';
import { setRecordPath } from '../store-record';
import { useFlip } from './flip';

export const pickSchema = s.object({ id: s.string().optional(), question: s.string().default('Find your best fit'), criteria: s.array(s.object({ id: s.string(), label: s.string() })).default([]), weights: s.any().optional(), options: s.array(s.object({ id: s.string(), title: s.string(), subtitle: s.string().optional(), scores: s.any().optional(), pros: s.array(s.string()).default([]), cons: s.array(s.string()).default([]), tag: s.string().optional() })).default([]), choose: s.string().default('Choose'), emptyLabel: s.string().default('Options will appear here'), bestLabel: s.string().default("Best for you because it's strong on"), andLabel: s.string().default('and'), weightLabel: s.string().default('weight'), ofLabel: s.string().default('of'), topLabel: s.string().default('Top pick'), matchLabel: s.string().default('match'), chosenLabel: s.string().default('Chosen') });
export type PickProps = Infer<typeof pickSchema>;
type Weights = Record<string, number>;
const clamp = (value: unknown, fallback: number, max = 3) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function weightsFor(props: PickProps, readWeight: (id: string) => unknown): Weights {
  return Object.fromEntries((props.criteria ?? []).filter(c => c?.id).map(c => [c.id, clamp(readWeight(c.id), clamp(props.weights?.[c.id], 1))]));
}
export function usePick(props: PickProps, ctx: PrismComponentProps<PickProps>) {
  const { store, animate } = usePrism(), format = useFormat(), receipt = useSent(), localWrite = useLocalWrite(), id = props.id ?? ctx.id;
  const saved = useStoreValue(`${id}.weights`), chosen = useStoreValue<string | undefined>(`${id}.chosen`);
  const readWeight = (criterion: string): unknown => store.get(`${id}.weights.${criterion}`);
  const weights = useMemo(() => weightsFor(props, readWeight), [props, saved, store, id]);
  useLayoutEffect(() => {
    if (!ctx.complete) return;
    localWrite(() => store.batch(() => {
      for (const key of Object.keys(weights)) if (readWeight(key) === undefined) setRecordPath(store, `${id}.weights`, key, weights[key]);
    }));
  }, [store, id, weights, ctx.complete, localWrite]);
  const revision = JSON.stringify([weights, props.options]);
  useLayoutEffect(() => receipt.reset(), [revision, receipt.reset]);
  const [focused, setFocused] = useState<string>(), chips = useRef(new Map<string, HTMLButtonElement>());
  const dots = useRef(new Map<string, HTMLButtonElement>());
  const criteria = (props.criteria ?? []).filter(c => c?.id), active = criteria.some(c => c.id === focused) ? focused : criteria[0]?.id;
  const setWeight = (criterion: string, value: number) => { receipt.reset(); localWrite(() => setRecordPath(store, `${id}.weights`, criterion, clamp(value, 1))); };
  const cycle = (criterion: string) => { const current = weightsFor(props, readWeight); setWeight(criterion, (current[criterion] + 1) % 4); };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const criterion = criteria[index];
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cycle(criterion.id); }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setWeight(criterion.id, weights[criterion.id] + (event.key === 'ArrowUp' ? 1 : -1)); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); const next = criteria[(index + (event.key === 'ArrowRight' ? 1 : -1) + criteria.length) % criteria.length].id;
      setFocused(next); chips.current.get(next)?.focus();
    }
  };
  const ranked = useMemo(() => {
    const denominator = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    return (props.options ?? []).filter(option => option?.id).map((option, index) => {
      const ready = !!option.scores && typeof option.scores === 'object' && !Array.isArray(option.scores);
      const bars = criteria.map(c => ({ ...c, score: score(option.scores?.[c.id]), weight: weights[c.id] }));
      const match = denominator ? bars.reduce((sum, bar) => sum + bar.score * bar.weight, 0) / denominator : 0;
      return { ...option, index, ready, bars, match };
    }).sort((a, b) => Number(b.ready) - Number(a.ready) || b.match - a.match || a.index - b.index);
  }, [props.options, props.criteria, weights]);
  const onChoose = (option: string) => { localWrite(() => store.set(`${id}.chosen`, option)); receipt.send('choose', { option, weights: weightsFor(props, readWeight) }); };
  const hasWeight = Object.values(weights).some(Boolean);
  const rows = ranked.map((option, index) => {
    const strongest = [...option.bars].filter(bar => bar.weight > 0).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 2).map(bar => bar.label);
    return { ...option, top: index === 0 && option.ready && hasWeight, chosen: chosen === option.id, rankText: format.number(index + 1), matchText: format.percent(option.match), chooseLabel: props.choose, chosenLabel: props.chosenLabel, topLabel: props.topLabel, matchLabel: props.matchLabel, weightsPath: `${id}.weights`,
      scorePaths: referencePaths(ctx.node.props?.options),
      reason: index === 0 && option.ready && strongest.length ? `${props.bestLabel} ${strongest.join(` ${props.andLabel} `)}` : undefined,
      bars: option.bars.map(bar => ({ ...bar, text: format.percent(bar.score) })), onChoose: () => onChoose(option.id) };
  });
  const listRef = useFlip(animate && ranked.every(row => row.ready));
  const parts = { criteria: usePart('pick', 'criteria'), chip: usePart('pick', 'chip'), pip: usePart('pick', 'pip'), pips: usePart('pick', 'pips'), list: usePart('pick', 'list'), empty: usePart('pick', 'empty'), live: usePart('pick', 'live') };
  return { parts, rows, listRef, receipt, hasWeight, question: props.question, emptyLabel: props.emptyLabel, announcement: rows[0]?.top ? `${props.topLabel}: ${rows[0].title}` : '',
    chips: criteria.map((c, index) => ({ ...c, weight: weights[c.id], pips: [1, 2, 3].map(n => n <= weights[c.id]),
      levels: [0, 1, 2, 3].map(level => ({ level, on: level <= weights[c.id], props: {
        ref: (element: HTMLButtonElement | null) => { const key = `${c.id}:${level}`; if (element) dots.current.set(key, element); else dots.current.delete(key); },
        role: 'radio' as const, 'aria-checked': level === weights[c.id], 'aria-label': `${c.label} ${props.weightLabel} ${format.number(level)}`, tabIndex: level === weights[c.id] ? 0 : -1,
        onClick: () => setWeight(c.id, level), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
          const delta = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0;
          if (!delta && !['Home', 'End', ' ', 'Enter'].includes(event.key)) return;
          event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (level + delta + 4) % 4;
          setWeight(c.id, next); dots.current.get(`${c.id}:${next}`)?.focus();
        },
      } })),
      props: { ref: (element: HTMLButtonElement | null) => { if (element) chips.current.set(c.id, element); else chips.current.delete(c.id); }, type: 'button' as const, tabIndex: active === c.id ? 0 : -1, 'aria-pressed': weights[c.id] > 0, 'aria-label': `${c.label}, ${props.weightLabel} ${format.number(weights[c.id])} ${props.ofLabel} ${format.number(3)}`, onFocus: () => setFocused(c.id), onClick: () => cycle(c.id), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index) } })) };
}
function referencePaths(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if ('$ref' in value && typeof value.$ref === 'string') return [value.$ref];
  return [...new Set(Object.values(value).flatMap(referencePaths))];
}
type Row = ReturnType<typeof usePick>['rows'][number];
function PickItem({ row }: { row: Row }) {
  const { animate, unstyled } = usePrism(), format = useFormat();
  const flash = useFlash(row.weightsPath);
  const parts = { item: usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready'), header: usePart('pick', 'card-header'), rank: usePart('pick', 'rank'), match: usePart('pick', 'match'), top: usePart('pick', 'top'), value: usePart('pick', 'value'), title: usePart('pick', 'title'), subtitle: usePart('pick', 'subtitle'), tag: usePart('pick', 'tag'), reason: usePart('pick', 'reason'), bars: usePart('pick', 'bars'), criterion: usePart('pick', 'criterion'), criterionLabel: usePart('pick', 'criterion-label'), bar: usePart('pick', 'bar'), pros: usePart('pick', 'pros'), cons: usePart('pick', 'cons'), pro: usePart('pick', 'pro'), con: usePart('pick', 'con'), actions: usePart('pick', 'actions'), choose: usePart('pick', 'choose'), check: usePart('pick', 'check') };
  const scoreLine = usePart('pick', 'score-line'), ring = usePart('pick', 'ring'), scorePart = usePart('pick', 'score'), percent = usePart('pick', 'percent'), progress = usePart('pick', 'progress');
  const Actions = useSlot('pick', 'actions', 'div' as any);
  const choice = <>{row.chosen && (unstyled ? '✓ ' : <CheckMark />)}{row.chooseLabel}</>;
  return <article {...parts.item} data-option={row.id} data-top={row.top || undefined} aria-busy={!row.ready} aria-label={`${row.title}, ${row.matchText}${row.top ? `, ${row.topLabel}` : ''}${row.chosen ? `, ${row.chosenLabel}` : ''}`}>
    <div {...parts.header}><span {...parts.rank}>#{row.rankText}</span>{row.top && <span {...parts.top}>{row.topLabel}</span>}{row.chosen && <span {...parts.check}>✓ {row.chosenLabel}</span>}</div>
    <h4 {...parts.title}>{row.title || <StreamSkeleton as="span" data-prism-skeleton-line="" />}</h4>
    <p {...parts.subtitle}>{row.subtitle || '\u00a0'}</p>{row.tag && <span {...parts.tag}>{row.tag}</span>}
    <div {...scoreLine} data-prism-flash={flash ? '' : undefined}>
      {row.scorePaths.map(path => <LinkedSignal key={path} path={path} />)}
      <svg {...ring} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" /><circle {...progress} cx="16" cy="16" r="13" strokeDasharray="81.68" strokeDashoffset={81.68 * (1 - row.match)} /></svg>
      <span {...parts.match} aria-label={`${row.matchText} ${row.matchLabel}`}><span {...scorePart} aria-hidden="true">{row.ready ? unstyled ? format.number(Math.round(row.match * 100)) : <Odometer value={Math.round(row.match * 100)} format={format.number} animate={animate} /> : <StreamSkeleton as="span" data-prism-skeleton-line="" />}<span {...percent}>%</span></span></span>
    </div>
    <div {...parts.bars}>{row.bars.map(bar => <div key={bar.id} {...parts.criterion} data-state={bar.weight ? 'active' : 'off'}><span {...parts.criterionLabel}>{bar.label}</span><meter {...parts.bar} min={0} max={1} value={bar.score} aria-label={bar.label}>{bar.text}</meter><span {...parts.value}>{bar.text}</span></div>)}</div>
    {!!row.pros.length && <ul {...parts.pros}>{row.pros.map((pro, index) => <li key={index} {...parts.pro}><span aria-hidden="true">✓</span>{pro}</li>)}</ul>}
    {!!row.cons.length && <ul {...parts.cons}>{row.cons.map((con, index) => <li key={index} {...parts.con}><span aria-hidden="true">−</span>{con}</li>)}</ul>}
    <Actions {...parts.actions}>{unstyled ? <button {...parts.choose} type="button" disabled={!row.ready} onClick={row.onChoose}>{choice}</button> : <Pill {...parts.choose} variant="ghost" disabled={!row.ready} onClick={row.onChoose}>{choice}</Pill>}</Actions>
  </article>;
}
function LinkedSignal({ path }: { path: string }) {
  const flash = useFlash(path), part = usePart('pick', 'signal');
  return <span {...part} aria-hidden="true" data-prism-flash={flash ? '' : undefined} />;
}
function PickSkeleton() {
  const item = usePart('pick', 'item', 'loading'), title = usePart('pick', 'title'), subtitle = usePart('pick', 'subtitle'), line = usePart('pick', 'score-line'), ring = usePart('pick', 'ring'), bars = usePart('pick', 'bars');
  return <StreamSkeleton {...item}>
    <div {...title}><span data-prism-skeleton-line="" /></div><div {...subtitle}><span data-prism-skeleton-line="" /></div>
    <div {...line}><svg {...ring} viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /></svg><span data-prism-skeleton-line="" /></div>
    <div {...bars}>{[0, 1, 2].map(index => <span key={index} data-prism-skeleton-line="" />)}</div>
  </StreamSkeleton>;
}
export function Pick(ctx: PrismComponentProps<PickProps>) {
  const pick = usePick(ctx.props, ctx), { parts } = pick, Item = useSlot('pick', 'item', PickItem), Empty = useSlot('pick', 'empty', 'div' as any);
  const { unstyled } = usePrism(), presentation = usePresentation(), streaming = presentation['data-state'] === 'streaming';
  const verdict = usePart('pick', 'verdict'), verdictRow = usePart('pick', 'verdict-row'), reason = usePart('pick', 'reason'), primary = usePart('pick', 'primary'), caption = usePart('pick', 'caption'), weight = usePart('pick', 'weight'), weightLabel = usePart('pick', 'weight-label');
  const winner = pick.rows[0], sent = pick.receipt.sent;
  const payload = sent?.payload as { option?: unknown } | undefined;
  const sentTitle = pick.rows.find(row => row.id === payload?.option)?.title ?? winner?.title;
  const readyLabel = winner && pick.hasWeight ? `Go with ${winner.title}` : pick.rows.length ? 'Choose what matters' : ctx.props.choose;
  const receipt = `Set · ${sentTitle ?? ''}`;
  const controls = <div {...parts.criteria}>{pick.chips.map(chip => <div key={chip.id} {...weight}>
    <span {...weightLabel}>{chip.label}</span><div {...parts.pips} role="radiogroup" aria-label={`${chip.label} ${ctx.props.weightLabel}`}>
      {chip.levels.map(level => {
        const dot = <span {...parts.pip} data-state={level.on ? 'on' : 'off'} aria-hidden="true" />;
        return unstyled ? <button key={level.level} {...parts.chip} {...level.props} type="button" data-level={level.level}>{dot}</button> : <Chip key={level.level} {...parts.chip} {...level.props} data-level={level.level}>{dot}</Chip>;
      })}
    </div></div>)}</div>;
  return <ComponentFrame component="pick" title={pick.question} toolbar={controls} ask undo>
    <h2 {...verdict}>{winner?.ready && pick.hasWeight ? <><em>{winner.title}</em> wins.</> : !pick.hasWeight && winner ? 'A little direction goes a long way.' : streaming ? <StreamSkeleton as="span" data-prism-skeleton-line="" /> : pick.emptyLabel}</h2>
    <div {...verdictRow}><p {...reason}>{winner?.ready && pick.hasWeight ? winner.reason : pick.rows.length ? 'Give a little weight to what matters. We’ll take it from there.' : '\u00a0'}</p>
      {unstyled ? <button {...primary} type="button" disabled={!winner?.ready || !pick.hasWeight || !!sent} onClick={winner?.onChoose}>{sent ? `✓ ${receipt}` : readyLabel}</button> : <Pill {...primary} sent={!!sent} receipt={receipt} disabled={!winner?.ready || !pick.hasWeight} onClick={winner?.onChoose}>{readyLabel}<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Pill>}
    </div>
    <div {...caption}><span>How the options compare</span><span>Swipe to compare</span></div>
    <div {...parts.live} aria-live="polite">{pick.announcement}</div>
    <div {...parts.list} ref={pick.listRef} style={{ ...parts.list.style, '--prism-pick-columns': pick.rows.length || 3 } as CSSProperties}>{pick.rows.length ? pick.rows.map(row => <Item key={row.id} row={row} />) : streaming ? [0, 1, 2].map(index => <PickSkeleton key={index} />) : <Empty {...parts.empty}>{pick.emptyLabel}</Empty>}</div>
  </ComponentFrame>;
}
export const pick = defineComponent({ name: 'pick', schema: pickSchema, syntax: 'fence', component: Pick, docs: 'Rank options by weighted criterion scores (0–1). Four radio dots set each weight from 0–3; arrow keys change the level. A verdict recommends the winner; any ready option can still be chosen. Choose submits the option id and current weights.', examples: ['```ui:pick\n{"id":"plans","question":"Which plan?","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"basic","title":"Basic","scores":{"price":0.9}}]}\n```'] });
registerComponent(pick);
