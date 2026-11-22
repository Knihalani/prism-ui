import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { cx, defineComponent, registerComponent, StreamSkeleton, useFlash, useFormat, useLocalWrite, usePart, usePresentation, usePrism, useSent, useSettled, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { ActionCheck, LinkedValue, MicroActions, referencePaths, useValueTween } from '../num/integration';
import { setRecordPath } from '../store-record';
import { useFlip } from './flip';

export const pickSchema = s.object({ id: s.string().optional(), question: s.string().default('Find your best fit'), criteria: s.array(s.object({ id: s.string(), label: s.string() })).default([]), weights: s.any().optional(), options: s.array(s.object({ id: s.string(), title: s.string(), subtitle: s.string().optional(), scores: s.any().optional(), pros: s.array(s.string()).default([]), cons: s.array(s.string()).default([]), tag: s.string().optional() })).default([]), choose: s.string().default('Choose'), emptyLabel: s.string().default('Options will appear here'), bestLabel: s.string().default('Strong on'), andLabel: s.string().default('and'), weightLabel: s.string().default('weight'), ofLabel: s.string().default('of'), topLabel: s.string().default('Top pick'), matchLabel: s.string().default('match'), chosenLabel: s.string().default('Chosen') });
export type PickProps = Infer<typeof pickSchema>;
type Weights = Record<string, number>;
const clamp = (value: unknown, fallback: number, max = 3) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function weightsFor(props: PickProps, readWeight: (id: string) => unknown): Weights {
  return Object.fromEntries(props.criteria.filter(c => c.id).map(c => [c.id, clamp(readWeight(c.id), clamp(props.weights?.[c.id], 1))]));
}
export function usePick(props: PickProps, ctx: PrismComponentProps<PickProps>) {
  const { store, animate } = usePrism(), format = useFormat(), { sent, send, reset } = useSent(), localWrite = useLocalWrite(), id = props.id ?? ctx.id;
  const saved = useStoreValue(`${id}.weights`), chosen = useStoreValue<string | undefined>(`${id}.chosen`);
  const readWeight = (criterion: string): unknown => store.get(`${id}.weights.${criterion}`);
  const weights = useMemo(() => weightsFor(props, readWeight), [props, saved, store, id]);
  const version = JSON.stringify([weights, props.options]), flash = useFlash(`${id}.weights`), paths = referencePaths(ctx.node.props);
  useEffect(reset, [version, reset]);
  useEffect(() => { if (chosen === undefined) reset(); }, [chosen, reset]);
  useLayoutEffect(() => {
    if (!ctx.complete) return;
    localWrite(() => store.batch(() => {
      for (const key of Object.keys(weights)) if (readWeight(key) === undefined) setRecordPath(store, `${id}.weights`, key, weights[key]);
    }));
  }, [store, id, weights, ctx.complete, localWrite]);
  const [focused, setFocused] = useState<string>(), chips = useRef(new Map<string, HTMLButtonElement>());
  const criteria = props.criteria.filter(c => c.id), active = criteria.some(c => c.id === focused) ? focused : criteria[0]?.id;
  const setWeight = (criterion: string, value: number) => { reset(); localWrite(() => store.batch(() => { setRecordPath(store, `${id}.weights`, criterion, clamp(value, 1)); store.set(`${id}.chosen`, undefined); })); };
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
    return props.options.filter(option => option.id).map((option, index) => {
      const ready = !!option.scores && typeof option.scores === 'object' && !Array.isArray(option.scores);
      const bars = criteria.map(c => ({ ...c, score: score(option.scores?.[c.id]), weight: weights[c.id] }));
      const match = denominator ? bars.reduce((sum, bar) => sum + bar.score * bar.weight, 0) / denominator : 0;
      return { ...option, index, ready, bars, match };
    }).sort((a, b) => Number(b.ready) - Number(a.ready) || b.match - a.match || a.index - b.index);
  }, [props.options, props.criteria, weights]);
  const onChoose = (option: string) => { localWrite(() => store.set(`${id}.chosen`, option)); send('choose', { option, weights: weightsFor(props, readWeight) }); };
  const rows = ranked.map((option, index) => {
    const strongest = [...option.bars].filter(bar => bar.weight > 0).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 2).map(bar => bar.label);
    return { ...option, animate, complete: ctx.complete, flash, paths, top: index === 0 && option.ready, chosen: chosen === option.id, sent: (sent?.payload as { option?: string } | undefined)?.option === option.id, rankText: format.number(index + 1), matchText: format.percent(option.match), chooseLabel: props.choose, chosenLabel: props.chosenLabel, topLabel: props.topLabel, matchLabel: props.matchLabel,
      reason: index === 0 && option.ready && strongest.length ? `${props.bestLabel} ${strongest.join(` ${props.andLabel} `)}` : undefined,
      bars: option.bars.map(bar => ({ ...bar, text: format.percent(bar.score) })), onChoose: () => onChoose(option.id) };
  });
  const listRef = useFlip(animate && ranked.every(row => row.ready));
  const parts = { criteria: usePart('pick', 'criteria'), chip: usePart('pick', 'chip'), pip: usePart('pick', 'pip'), pips: usePart('pick', 'pips'), list: usePart('pick', 'list'), empty: usePart('pick', 'empty'), live: usePart('pick', 'live') };
  return { parts, rows, listRef, sent, question: props.question, emptyLabel: props.emptyLabel, announcement: rows[0]?.ready ? `${props.topLabel}: ${rows[0].title}` : '',
    chips: criteria.map((c, index) => ({ ...c, weight: weights[c.id], pips: [1, 2, 3].map(n => n <= weights[c.id]), props: { ref: (element: HTMLButtonElement | null) => { if (element) chips.current.set(c.id, element); else chips.current.delete(c.id); }, type: 'button' as const, tabIndex: active === c.id ? 0 : -1, 'aria-pressed': weights[c.id] > 0, 'aria-label': `${c.label}, ${props.weightLabel} ${format.number(weights[c.id])} ${props.ofLabel} ${format.number(3)}`, onFocus: () => setFocused(c.id), onClick: () => cycle(c.id), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index) } })) };
}
type Row = ReturnType<typeof usePick>['rows'][number];
function PickItem({ row }: { row: Row }) {
  const { unstyled } = usePrism(), format = useFormat(), matchRef = useRef<HTMLSpanElement>(null);
  const match = useValueTween(row.match, row.animate && row.complete, matchRef);
  const parts = { item: usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready'), header: usePart('pick', 'card-header'), rank: usePart('pick', 'rank'), match: usePart('pick', 'match'), top: usePart('pick', 'top'), value: usePart('pick', 'value'), title: usePart('pick', 'title'), subtitle: usePart('pick', 'subtitle'), tag: usePart('pick', 'tag'), reason: usePart('pick', 'reason'), bars: usePart('pick', 'bars'), criterion: usePart('pick', 'criterion'), criterionLabel: usePart('pick', 'criterion-label'), bar: usePart('pick', 'bar'), pros: usePart('pick', 'pros'), cons: usePart('pick', 'cons'), pro: usePart('pick', 'pro'), con: usePart('pick', 'con'), actions: usePart('pick', 'actions'), choose: usePart('pick', 'choose'), check: usePart('pick', 'check') };
  const Actions = useSlot('pick', 'actions', 'div' as any);
  return <article {...parts.item} style={{ ...parts.item.style, '--pick-index': row.index } as CSSProperties} data-option={row.id} data-top={row.top || undefined} aria-busy={!row.ready}>
    <div {...parts.header}><span {...parts.rank}>#{row.rankText}</span>{row.top && <><span {...parts.top}>{row.topLabel}</span>{!row.tag && <span className="prism-pick__badge" aria-hidden="true">Best match</span>}</>}{row.tag && <span {...parts.tag}>{row.tag}</span>}{row.chosen && <span {...parts.check}>✓ {row.chosenLabel}</span>}<span {...parts.match} role="img" aria-label={row.ready ? `${row.matchText} ${row.matchLabel}` : '—'}>
      <svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" /><circle cx="28" cy="28" r="25" pathLength="100" strokeDasharray={`${row.ready ? match * 100 : 0} 100`} /></svg><span ref={matchRef} data-prism-flash={row.flash ? '' : undefined} aria-hidden="true"><LinkedValue paths={row.paths}>{row.ready ? format.percent(match) : '—'}</LinkedValue></span>
    </span></div>
    <h4 {...parts.title}>{row.title || '\u00a0'}</h4><p {...parts.subtitle}>{row.subtitle || '\u00a0'}</p>
    <p {...parts.reason}>{row.reason || '\u00a0'}</p>
    <div {...parts.bars}>{row.bars.map(bar => <div key={bar.id} {...parts.criterion} data-state={bar.weight ? 'active' : 'off'}><span {...parts.criterionLabel}>{bar.label}</span><meter {...parts.bar} min={0} max={1} value={bar.score} aria-label={bar.label}>{bar.text}</meter><span {...parts.value}>{bar.text}</span></div>)}</div>
    <ul {...parts.pros}>{row.pros.map((pro, index) => <li key={index} {...parts.pro}>✓ {pro}</li>)}</ul>
    <ul {...parts.cons}>{row.cons.map((con, index) => <li key={index} {...parts.con}>– {con}</li>)}</ul>
    <Actions {...parts.actions}><button {...parts.choose} className={cx(parts.choose.className, !unstyled && 'prism-pill')} aria-label={row.chooseLabel} data-primary={row.top} data-sent={row.sent || undefined} type="button" disabled={!row.ready} onClick={row.onChoose}>{row.sent ? <><ActionCheck /><span>Chose · {row.title}</span></> : row.chooseLabel}</button></Actions>
  </article>;
}
function PickSkeleton({ criteria }: { criteria: PickProps['criteria'] }) {
  const { unstyled } = usePrism();
  const item = usePart('pick', 'item', 'loading'), header = usePart('pick', 'card-header'), match = usePart('pick', 'match'), title = usePart('pick', 'title'), subtitle = usePart('pick', 'subtitle'), reason = usePart('pick', 'reason'), bars = usePart('pick', 'bars'), criterion = usePart('pick', 'criterion'), label = usePart('pick', 'criterion-label'), bar = usePart('pick', 'bar'), pros = usePart('pick', 'pros'), cons = usePart('pick', 'cons'), actions = usePart('pick', 'actions');
  return <StreamSkeleton as="div" style={{ display: 'contents' }}><article {...item} aria-hidden="true"><div {...header}><span {...match}><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" /></svg></span></div><h4 {...title}>&nbsp;</h4><p {...subtitle}>&nbsp;</p><p {...reason}>&nbsp;</p><div {...bars}>{criteria.map((field, index) => <div {...criterion} key={field.id ?? index}><span {...label}>&nbsp;</span><meter {...bar} value={0} /><span>&nbsp;</span></div>)}</div><ul {...pros} /><ul {...cons} /><div {...actions}><span className={unstyled ? undefined : 'prism-pill'} data-primary="false" aria-hidden="true">&nbsp;</span></div></article></StreamSkeleton>;
}
export function Pick(ctx: PrismComponentProps<PickProps>) {
  const { unstyled } = usePrism(), presentation = usePresentation(), settled = useSettled();
  const pick = usePick(ctx.props, ctx), { parts } = pick, Item = useSlot('pick', 'item', PickItem), Empty = useSlot('pick', 'empty', 'div' as any);
  return <ComponentFrame component="pick" title={pick.question} state={presentation['data-state']} ask undo>
    <MicroActions />
    <div {...parts.criteria}><span className="prism-pick__criteria-label">What matters</span>{pick.chips.map(chip => <button key={chip.id} {...parts.chip} className={cx(parts.chip.className, !unstyled && 'prism-chip')} {...chip.props}>{chip.label}<span {...parts.pips} aria-hidden="true">{chip.pips.map((on, index) => <span key={index} {...parts.pip} data-state={on ? 'on' : 'off'} />)}</span></button>)}</div>
    <div {...parts.live} aria-live="polite">{pick.announcement}</div>
    <div {...parts.list} ref={pick.listRef}>{pick.rows.map(row => <Item key={row.id} row={row} />)}{!settled && Array.from({ length: Math.max(0, 2 - pick.rows.length) }, (_, index) => <PickSkeleton key={`pending-${index}`} criteria={ctx.props.criteria} />)}{settled && !pick.rows.length && <Empty {...parts.empty}>{pick.emptyLabel}</Empty>}</div>
  </ComponentFrame>;
}
export const pick = defineComponent({ name: 'pick', schema: pickSchema, syntax: 'fence', component: Pick, docs: 'Rank options by weighted criterion scores (0–1). Weight chips cycle 1–2–3–0; arrow keys adjust weights or focus. Choose submits the option id and current weights.', examples: ['```ui:pick\n{"id":"plans","question":"Which plan?","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"basic","title":"Basic","scores":{"price":0.9}}]}\n```'] });
registerComponent(pick);
