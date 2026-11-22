import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { useSpringValue, useFormat, useStrings, Icon, PrismPart, cx, defineComponent, registerComponent, useEmit, usePart, usePrism, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { setRecordPath } from '../store-record';
import { useFlip } from './flip';
import { SentContent } from '../shared/controls';

export const pickSchema = s.object({ id: s.string().optional(), question: s.string().default('Find your best fit'), criteria: s.array(s.object({ id: s.string(), label: s.string() })).default([]), weights: s.any().optional(), options: s.array(s.object({ id: s.string(), title: s.string(), subtitle: s.string().optional(), scores: s.any().optional(), pros: s.array(s.string()).default([]), cons: s.array(s.string()).default([]), tag: s.string().optional() })).default([]), choose: s.string().default('Choose'), emptyLabel: s.string().default('Options will appear here'), bestLabel: s.string().default("Best for you because it's strong on"), andLabel: s.string().default('and'), weightLabel: s.string().default('weight'), ofLabel: s.string().default('of'), topLabel: s.string().default('Top pick'), matchLabel: s.string().default('match'), chosenLabel: s.string().default('Chosen') });
export type PickProps = Infer<typeof pickSchema>;
type Weights = Record<string, number>;
const clamp = (value: unknown, fallback: number, max = 3) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function weightsFor(props: PickProps, readWeight: (id: string) => unknown): Weights {
  return Object.fromEntries(props.criteria.filter(c => c.id).map(c => [c.id, clamp(readWeight(c.id), clamp(props.weights?.[c.id], 1))]));
}
export function usePick(props: PickProps, ctx: PrismComponentProps<PickProps>) {
  props = { ...props, ...useStrings('pick') };
  const { store, animate } = usePrism(), format = useFormat(), emit = useEmit(), id = props.id ?? ctx.id;
  const saved = useStoreValue(`${id}.weights`), chosen = useStoreValue<string | undefined>(`${id}.chosen`);
  const readWeight = (criterion: string): unknown => store.get(`${id}.weights.${criterion}`);
  const weights = useMemo(() => weightsFor(props, readWeight), [props, saved, store, id]);
  useLayoutEffect(() => {
    if (!ctx.complete) return;
    store.batch(() => {
      for (const key of Object.keys(weights)) if (readWeight(key) === undefined) setRecordPath(store, `${id}.weights`, key, weights[key]);
    });
  }, [store, id, weights, ctx.complete]);
  const [focused, setFocused] = useState<string>(), chips = useRef(new Map<string, HTMLButtonElement>());
  const criteria = props.criteria.filter(c => c.id), active = criteria.some(c => c.id === focused) ? focused : criteria[0]?.id;
  const setWeight = (criterion: string, value: number) => setRecordPath(store, `${id}.weights`, criterion, clamp(value, 1));
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
  const onChoose = (option: string) => { store.set(`${id}.chosen`, option); emit('choose', { option, weights: weightsFor(props, readWeight) }); };
  const rows = ranked.map((option, index) => {
    const strongest = [...option.bars].filter(bar => bar.weight > 0).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 2).map(bar => bar.label);
    return { ...option, top: index === 0 && option.ready, chosen: chosen === option.id, rankText: format.number(index + 1), matchText: format.percent(option.match), chooseLabel: props.choose, chosenLabel: props.chosenLabel, topLabel: props.topLabel, matchLabel: props.matchLabel,
      reason: index === 0 && option.ready && strongest.length ? `${props.bestLabel} ${strongest.join(` ${props.andLabel} `)}` : undefined,
      bars: option.bars.map(bar => ({ ...bar, text: format.percent(bar.score) })), onChoose: () => onChoose(option.id) };
  });
  const listRef = useFlip(animate && ranked.every(row => row.ready));
  const parts = { criteria: usePart('pick', 'criteria'), chip: usePart('pick', 'chip'), pip: usePart('pick', 'pip'), pips: usePart('pick', 'pips'), list: usePart('pick', 'list'), empty: usePart('pick', 'empty'), live: usePart('pick', 'live') };
  return { parts, rows, listRef, setWeight, question: props.question, emptyLabel: props.emptyLabel, announcement: rows[0]?.ready ? `${props.topLabel}: ${rows[0].title}` : '',
    chips: criteria.map((c, index) => ({ ...c, weight: weights[c.id], pips: [1, 2, 3].map(n => n <= weights[c.id]), props: { ref: (element: HTMLButtonElement | null) => { if (element) chips.current.set(c.id, element); else chips.current.delete(c.id); }, type: 'button' as const, tabIndex: active === c.id ? 0 : -1, 'aria-pressed': weights[c.id] > 0, 'aria-label': `${c.label}, ${props.weightLabel} ${format.number(weights[c.id])} ${props.ofLabel} ${format.number(3)}`, onFocus: () => setFocused(c.id), onClick: () => cycle(c.id), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index) } })) };
}
type Row = ReturnType<typeof usePick>['rows'][number];
function PickItem({ row }: { row: Row }) {
  const format = useFormat(), match = useSpringValue(row.match), { unstyled } = usePrism();
  const parts = { item: usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready'), header: usePart('pick', 'card-header'), rank: usePart('pick', 'rank'), match: usePart('pick', 'match'), top: usePart('pick', 'top'), value: usePart('pick', 'value'), title: usePart('pick', 'title'), subtitle: usePart('pick', 'subtitle'), tag: usePart('pick', 'tag'), reason: usePart('pick', 'reason'), bars: usePart('pick', 'bars'), criterion: usePart('pick', 'criterion'), criterionLabel: usePart('pick', 'criterion-label'), bar: usePart('pick', 'bar'), pros: usePart('pick', 'pros'), cons: usePart('pick', 'cons'), pro: usePart('pick', 'pro'), con: usePart('pick', 'con'), actions: usePart('pick', 'actions'), choose: usePart('pick', 'choose'), check: usePart('pick', 'check') };
  const Actions = useSlot('pick', 'actions', 'div' as any);
  return <PrismPart as="article" {...parts.item} data-option={row.id} data-top={row.top || undefined} aria-busy={!row.ready}>
    <PrismPart as="div" {...parts.header}><PrismPart as="span" {...parts.rank}>#{row.rankText}</PrismPart><PrismPart as="span" {...parts.match}>{row.ready ? `${format.percent(match)} ${row.matchLabel}` : '—'}</PrismPart>{row.top && <PrismPart as="span" {...parts.top}>{row.topLabel}</PrismPart>}{row.tag && <PrismPart as="span" {...parts.tag}>{row.tag}</PrismPart>}{row.chosen && <PrismPart as="span" {...parts.check}><Icon name="check" /> {row.chosenLabel}</PrismPart>}</PrismPart>
    <PrismPart as="h4" {...parts.title}>{row.title}</PrismPart>{row.subtitle && <PrismPart as="p" {...parts.subtitle}>{row.subtitle}</PrismPart>}
    {row.reason && <PrismPart as="p" {...parts.reason}>{row.reason}</PrismPart>}
    <PrismPart as="div" {...parts.bars}>{row.bars.map(bar => <PrismPart as="div" key={bar.id} {...parts.criterion} data-state={bar.weight ? 'active' : 'off'}><PrismPart as="span" {...parts.criterionLabel}>{bar.label}</PrismPart><PrismPart as="meter" {...parts.bar} min={0} max={1} value={bar.score} style={{ ...parts.bar.style, '--prism-pick-score': bar.score } as CSSProperties} aria-label={bar.label}>{bar.text}</PrismPart><PrismPart as="span" {...parts.value}>{bar.text}</PrismPart></PrismPart>)}</PrismPart>
    {!!row.pros.length && <PrismPart as="ul" {...parts.pros}>{row.pros.map((pro, index) => <PrismPart as="li" key={index} {...parts.pro}><Icon name="check" /> {pro}</PrismPart>)}</PrismPart>}
    {!!row.cons.length && <PrismPart as="ul" {...parts.cons}>{row.cons.map((con, index) => <PrismPart as="li" key={index} {...parts.con}>– {con}</PrismPart>)}</PrismPart>}
    <Actions {...parts.actions}><PrismPart as="button" {...parts.choose} className={cx(parts.choose.className, !unstyled && 'prism-pill')} data-variant="primary" data-feedback="" data-sent={row.chosen ? '' : undefined} type="button" disabled={!row.ready || row.chosen} onClick={row.onChoose}><SentContent sent={row.chosen} receipt={row.chosenLabel}>{row.chooseLabel}</SentContent></PrismPart></Actions>
  </PrismPart>;
}
export function Pick(ctx: PrismComponentProps<PickProps>) {
  const pick = usePick(ctx.props, ctx), { parts } = pick, Item = useSlot('pick', 'item', PickItem), Empty = useSlot('pick', 'empty', 'div' as any);
  return <ComponentFrame component="pick" title={pick.question} ask undo>
    <PrismPart as="div" {...parts.criteria} slotProps={{ pick }}>{pick.chips.map(chip => <PrismPart as="button" key={chip.id} {...parts.chip} {...chip.props}>{chip.label}<PrismPart as="span" {...parts.pips} aria-hidden="true">{chip.pips.map((on, index) => <PrismPart as="span" key={index} {...parts.pip} data-state={on ? 'on' : 'off'} />)}</PrismPart></PrismPart>)}</PrismPart>
    <PrismPart as="div" {...parts.live} aria-live="polite">{pick.announcement}</PrismPart>
    <PrismPart as="div" {...parts.list} ref={pick.listRef}>{pick.rows.length ? pick.rows.map(row => <Item key={row.id} row={row} />) : <Empty {...parts.empty}>{pick.emptyLabel}</Empty>}</PrismPart>
  </ComponentFrame>;
}
export const pick = defineComponent({ name: 'pick', parts: ["actions","ask","bar","bars","body","card-header","check","chip","choose","con","cons","criteria","criterion","criterion-label","empty","footer","header","item","list","live","match","pip","pips","pro","pros","rank","reason","root","subtitle","tag","title","toolbar","top","undo","value"], strings: {}, schema: pickSchema, syntax: 'fence', component: Pick, docs: 'Rank options by weighted criterion scores (0–1). Weight chips cycle 1–2–3–0; arrow keys adjust weights or focus. Choose submits the option id and current weights.', examples: ['```ui:pick\n{"id":"plans","question":"Which plan?","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"basic","title":"Basic","scores":{"price":0.9}}]}\n```'] });
registerComponent(pick);
