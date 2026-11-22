import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { defineComponent, registerComponent, useEmit, useFormat, usePart, usePrism, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { useFlip } from './flip';

export const pickSchema = s.object({ id: s.string().optional(), question: s.string().default('Find your best fit'), criteria: s.array(s.object({ id: s.string(), label: s.string() })).default([]), weights: s.any().optional(), options: s.array(s.object({ id: s.string(), title: s.string(), subtitle: s.string().optional(), scores: s.any().optional(), pros: s.array(s.string()).default([]), cons: s.array(s.string()).default([]), tag: s.string().optional() })).default([]), choose: s.string().default('Choose'), emptyLabel: s.string().default('Options will appear here'), bestLabel: s.string().default("Best for you because it's strong on"), andLabel: s.string().default('and'), weightLabel: s.string().default('weight'), ofLabel: s.string().default('of'), topLabel: s.string().default('Top pick'), chosenLabel: s.string().default('Chosen') });
export type PickProps = Infer<typeof pickSchema>;
type Weights = Record<string, number>;
const clamp = (value: unknown, fallback: number, max = 3) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function weightsFor(props: PickProps, saved: unknown): Weights {
  return Object.fromEntries(props.criteria.filter(c => c.id).map(c => [c.id, clamp((saved as Weights | undefined)?.[c.id], clamp(props.weights?.[c.id], 1))]));
}
export function usePick(props: PickProps, ctx: PrismComponentProps<PickProps>) {
  const { store, animate } = usePrism(), format = useFormat(), emit = useEmit(), id = props.id ?? ctx.id;
  const saved = useStoreValue<Weights | undefined>(`${id}.weights`), chosen = useStoreValue<string | undefined>(`${id}.chosen`);
  const weights = useMemo(() => weightsFor(props, saved), [props, saved]);
  useLayoutEffect(() => {
    const current = store.get(`${id}.weights`);
    if (Object.keys(weights).some(key => current?.[key] === undefined)) store.set(`${id}.weights`, { ...current, ...weights });
  }, [store, id, weights]);
  const [focused, setFocused] = useState<string>(), chips = useRef(new Map<string, HTMLButtonElement>());
  const criteria = props.criteria.filter(c => c.id), active = criteria.some(c => c.id === focused) ? focused : criteria[0]?.id;
  const setWeight = (criterion: string, value: number) => store.set(`${id}.weights.${criterion}`, clamp(value, 1));
  const cycle = (criterion: string) => { const current = weightsFor(props, store.get(`${id}.weights`)); setWeight(criterion, (current[criterion] + 1) % 4); };
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
  const onChoose = (option: string) => { store.set(`${id}.chosen`, option); emit('choose', { option, weights: weightsFor(props, store.get(`${id}.weights`)) }); };
  const rows = ranked.map((option, index) => {
    const strongest = [...option.bars].filter(bar => bar.weight > 0).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 2).map(bar => bar.label);
    return { ...option, top: index === 0 && option.ready, chosen: chosen === option.id, rankText: format.number(index + 1), matchText: format.percent(option.match), chooseLabel: props.choose, chosenLabel: props.chosenLabel,
      reason: index === 0 && option.ready && strongest.length ? `${props.bestLabel} ${strongest.join(` ${props.andLabel} `)}` : undefined,
      bars: option.bars.map(bar => ({ ...bar, text: format.percent(bar.score) })), onChoose: () => onChoose(option.id) };
  });
  const listRef = useFlip(animate && ranked.every(row => row.ready));
  const parts = { criteria: usePart('pick', 'criteria'), chip: usePart('pick', 'chip'), pip: usePart('pick', 'pip'), pips: usePart('pick', 'pips'), list: usePart('pick', 'list'), empty: usePart('pick', 'empty'), live: usePart('pick', 'live') };
  return { parts, rows, listRef, question: props.question, emptyLabel: props.emptyLabel, announcement: rows[0]?.ready ? `${props.topLabel}: ${rows[0].title}` : '',
    chips: criteria.map((c, index) => ({ ...c, weight: weights[c.id], pips: [1, 2, 3].map(n => n <= weights[c.id]), props: { ref: (element: HTMLButtonElement | null) => { if (element) chips.current.set(c.id, element); else chips.current.delete(c.id); }, type: 'button' as const, tabIndex: active === c.id ? 0 : -1, 'aria-pressed': weights[c.id] > 0, 'aria-label': `${c.label}, ${props.weightLabel} ${format.number(weights[c.id])} ${props.ofLabel} ${format.number(3)}`, onFocus: () => setFocused(c.id), onClick: () => cycle(c.id), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index) } })) };
}
type Row = ReturnType<typeof usePick>['rows'][number];
function PickItem({ row }: { row: Row }) {
  const parts = { item: usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready'), header: usePart('pick', 'card-header'), rank: usePart('pick', 'rank'), title: usePart('pick', 'title'), subtitle: usePart('pick', 'subtitle'), tag: usePart('pick', 'tag'), reason: usePart('pick', 'reason'), bars: usePart('pick', 'bars'), criterion: usePart('pick', 'criterion'), criterionLabel: usePart('pick', 'criterion-label'), bar: usePart('pick', 'bar'), pros: usePart('pick', 'pros'), cons: usePart('pick', 'cons'), pro: usePart('pick', 'pro'), con: usePart('pick', 'con'), actions: usePart('pick', 'actions'), choose: usePart('pick', 'choose'), check: usePart('pick', 'check') };
  const Actions = useSlot('pick', 'actions', 'div' as any);
  return <article {...parts.item} data-option={row.id} data-top={row.top || undefined} aria-busy={!row.ready}>
    <div {...parts.header}><span {...parts.rank}>{row.rankText} · {row.ready ? row.matchText : '—'}</span>{row.tag && <span {...parts.tag}>{row.tag}</span>}{row.chosen && <span {...parts.check}>✓ {row.chosenLabel}</span>}</div>
    <h4 {...parts.title}>{row.title}</h4>{row.subtitle && <p {...parts.subtitle}>{row.subtitle}</p>}
    {row.reason && <p {...parts.reason}>{row.reason}</p>}
    <div {...parts.bars}>{row.bars.map(bar => <div {...parts.criterion} key={bar.id} data-state={bar.weight ? 'active' : 'off'}><span {...parts.criterionLabel}>{bar.label}</span><meter {...parts.bar} min={0} max={1} value={bar.score} aria-label={bar.label}>{bar.text}</meter></div>)}</div>
    {!!row.pros.length && <ul {...parts.pros}>{row.pros.map((pro, index) => <li {...parts.pro} key={index}>✓ {pro}</li>)}</ul>}
    {!!row.cons.length && <ul {...parts.cons}>{row.cons.map((con, index) => <li {...parts.con} key={index}>– {con}</li>)}</ul>}
    <Actions {...parts.actions}><button {...parts.choose} type="button" disabled={!row.ready} onClick={row.onChoose}>{row.chooseLabel}</button></Actions>
  </article>;
}
export function Pick(ctx: PrismComponentProps<PickProps>) {
  const pick = usePick(ctx.props, ctx), { parts } = pick, Item = useSlot('pick', 'item', PickItem), Empty = useSlot('pick', 'empty', 'div' as any);
  return <ComponentFrame component="pick" title={pick.question} ask undo>
    <div {...parts.criteria}>{pick.chips.map(chip => <button {...parts.chip} {...chip.props} key={chip.id}>{chip.label}<span {...parts.pips} aria-hidden="true">{chip.pips.map((on, index) => <span {...parts.pip} data-state={on ? 'on' : 'off'} key={index} />)}</span></button>)}</div>
    <div {...parts.live} aria-live="polite">{pick.announcement}</div>
    <div {...parts.list} ref={pick.listRef}>{pick.rows.length ? pick.rows.map(row => <Item key={row.id} row={row} />) : <Empty {...parts.empty}>{pick.emptyLabel}</Empty>}</div>
  </ComponentFrame>;
}
export const pick = defineComponent({ name: 'pick', schema: pickSchema, syntax: 'fence', component: Pick, docs: 'Rank options by weighted criterion scores (0–1). Weight chips cycle 1–2–3–0; arrow keys adjust weights or focus. Choose submits the option id and current weights.', examples: ['```ui:pick\n{"id":"plans","question":"Which plan?","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"basic","title":"Basic","scores":{"price":0.9}}]}\n```'] });
registerComponent(pick);
