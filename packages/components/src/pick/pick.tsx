import { createElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type FocusEvent, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { useSpringValue, useStrings, Icon, PrismPart, cx, defineComponent, registerComponent, useEmit, useFlash, useFormat, useLocalWrite, usePart, usePrism, useSent, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { useFrame, type FramePart } from '../frame';
import { interpolate } from '../interpolate';
import { setRecordPath } from '../store-record';
import { useFlip } from './flip';
import { SentContent } from '../shared/controls';

export const pickStrings = {
  question: 'Find your best fit', choose: 'Choose', emptyLabel: 'Options will appear here',
  bestLabel: "Best for you because it's strong on", andLabel: 'and', weightLabel: 'weight', ofLabel: 'of',
  topLabel: 'Top pick', matchLabel: 'match', chosenLabel: 'Chosen', sentLabel: 'Sent',
  undoLabel: 'Undo', askLabel: 'Ask about this', askMessage: 'Tell me more about these options.',
  weightDescription: '{criterion}, {weightLabel} {weight} {ofLabel} {max}',
  announcement: '{label}: {title}', rank: '#{rank}', match: '{match} {label}',
  reason: '{best} {criteria}', criteriaSeparator: ' {and} ', loadingLabel: '—',
  chooseMessage: '{choose}: {title}',
};

export const pickSchema = s.object({ id: s.string().optional(), question: s.string().default(pickStrings.question), criteria: s.array(s.object({ id: s.string(), label: s.string() })).default([]), weights: s.any().optional(), options: s.array(s.object({ id: s.string(), title: s.string(), subtitle: s.string().optional(), scores: s.any().optional(), pros: s.array(s.string()).default([]), cons: s.array(s.string()).default([]), tag: s.string().optional() })).default([]), choose: s.string().default(pickStrings.choose), emptyLabel: s.string().default(pickStrings.emptyLabel), bestLabel: s.string().default(pickStrings.bestLabel), andLabel: s.string().default(pickStrings.andLabel), weightLabel: s.string().default(pickStrings.weightLabel), ofLabel: s.string().default(pickStrings.ofLabel), topLabel: s.string().default(pickStrings.topLabel), matchLabel: s.string().default(pickStrings.matchLabel), chosenLabel: s.string().default(pickStrings.chosenLabel) });
export type PickProps = Infer<typeof pickSchema>;
type Weights = Record<string, number>;
const clamp = (value: unknown, fallback: number, max = 3) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
function weightsFor(props: PickProps, readWeight: (id: string) => unknown): Weights {
  return Object.fromEntries(props.criteria.filter(c => c.id).map(c => [c.id, clamp(readWeight(c.id), clamp(props.weights?.[c.id], 1))]));
}
export function usePick(props: PickProps, ctx: PrismComponentProps<PickProps>) {
  const strings = useStrings('pick', pickStrings);
  props = { ...props, ...strings };
  const { store, animate } = usePrism(), format = useFormat(), emit = useEmit(), { send, sent, reset } = useSent(), localWrite = useLocalWrite(), id = props.id ?? ctx.id;
  const flashing = useFlash(`${id}.weights`), { ref: listRef, measure: measureOrder } = useFlip(animate);
  useEffect(() => store.subscribe(`${id}.weights`, measureOrder), [store, id, measureOrder]);
  const frame = useFrame({ component: 'pick', title: props.question, ask: true, undo: true });
  const saved = useStoreValue(`${id}.weights`), chosen = useStoreValue<string | undefined>(`${id}.chosen`);
  const previousChoice = useRef(chosen);
  useEffect(() => { if (previousChoice.current !== chosen) reset(); previousChoice.current = chosen; }, [chosen, reset]);
  const readWeight = (criterion: string): unknown => store.get(`${id}.weights.${criterion}`);
  const weights = useMemo(() => weightsFor(props, readWeight), [props, saved, store, id]);
  const signature = JSON.stringify([weights, props.options]), previous = useRef(signature);
  useEffect(() => { if (previous.current !== signature) reset(); previous.current = signature; }, [signature, reset]);
  useLayoutEffect(() => {
    if (!ctx.complete) return;
    localWrite(() => store.batch(() => {
      for (const key of Object.keys(weights)) if (readWeight(key) === undefined) setRecordPath(store, `${id}.weights`, key, weights[key]);
    }));
  }, [store, id, weights, ctx.complete]);
  const [focused, setFocused] = useState<string>(), chips = useRef(new Map<string, HTMLButtonElement>());
  const [compact, setCompact] = useState(false), [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const expand = (option: string, toggle = false) => setExpanded(current => {
    const next = new Set(current);
    if (toggle && next.has(option)) next.delete(option); else next.add(option);
    return next;
  });
  const criteria = props.criteria.filter(c => c.id), active = criteria.some(c => c.id === focused) ? focused : criteria[0]?.id;
  const setWeight = (criterion: string, value: number) => {
    const next = clamp(value, 1);
    if (next === weightsFor(props, readWeight)[criterion]) return;
    reset();
    localWrite(() => store.batch(() => { setRecordPath(store, `${id}.weights`, criterion, next); store.set(`${id}.chosen`, undefined); }));
  };
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
  const onChoose = (option: string) => {
    previousChoice.current = option;
    localWrite(() => store.set(`${id}.chosen`, option));
    send('choose', { option, weights: weightsFor(props, readWeight) }, interpolate(strings.chooseMessage, { choose: strings.choose, title: ranked.find(row => row.id === option)?.title ?? option }));
  };
  const rows = ranked.map((option, index) => {
    const strongest = [...option.bars].filter(bar => bar.weight > 0).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 2).map(bar => bar.label);
    return { ...option, top: index === 0 && option.ready, expanded: !compact || (index === 0 && option.ready) || expanded.has(option.id), onExpand: () => expand(option.id), onToggle: () => expand(option.id, true), chosen: chosen === option.id, sent: (sent?.payload as { option?: string } | undefined)?.option === option.id, rankText: format.number(index + 1), matchText: format.percent(option.match), rankLabel: interpolate(strings.rank, { rank: format.number(index + 1) }), matchDescription: interpolate(strings.match, { match: format.percent(option.match), label: strings.matchLabel }), chooseLabel: props.choose, chosenLabel: props.chosenLabel, topLabel: props.topLabel, matchLabel: props.matchLabel,
      reason: index === 0 && option.ready && strongest.length ? interpolate(strings.reason, { best: strings.bestLabel, criteria: strongest.join(interpolate(strings.criteriaSeparator, { and: strings.andLabel })) }) : undefined,
      bars: option.bars.map(bar => ({ ...bar, text: format.percent(bar.score) })), onChoose: () => onChoose(option.id) };
  });
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setCompact(getComputedStyle(list).getPropertyValue('--prism-pick-compact').trim() === '1');
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef]);
  const parts = { criteria: usePart('pick', 'criteria'), chip: usePart('pick', 'chip'), pip: usePart('pick', 'pip'), pips: usePart('pick', 'pips'), list: usePart('pick', 'list'), empty: usePart('pick', 'empty'), live: usePart('pick', 'live') };
  return { parts, rows, listRef, setWeight, frame, strings, flashing, compact, question: props.question, emptyLabel: props.emptyLabel,
    onAsk: () => emit('ask', undefined, strings.askMessage),
    announcement: rows[0]?.ready ? interpolate(strings.announcement, { label: strings.topLabel, title: rows[0].title }) : '',
    chips: criteria.map((c, index) => ({ ...c, weight: weights[c.id], pips: [1, 2, 3].map(n => n <= weights[c.id]), props: { ref: (element: HTMLButtonElement | null) => { if (element) chips.current.set(c.id, element); else chips.current.delete(c.id); }, type: 'button' as const, tabIndex: active === c.id ? 0 : -1, 'aria-pressed': weights[c.id] > 0, 'aria-label': interpolate(strings.weightDescription, { criterion: c.label, weightLabel: strings.weightLabel, weight: format.number(weights[c.id]), ofLabel: strings.ofLabel, max: format.number(3) }), onFocus: () => setFocused(c.id), onClick: () => cycle(c.id), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index) } })) };
}
export type PickModel = ReturnType<typeof usePick>;
export type PickOption = PickModel['rows'][number];
export type PickCriterion = PickOption['bars'][number];
export type PickWeight = PickModel['chips'][number];
export const pickParts = ['root', 'header', 'title', 'toolbar', 'body', 'footer', 'ask', 'undo', 'criteria', 'chip', 'pips', 'pip', 'list', 'empty', 'live', 'item', 'card-header', 'summary', 'details', 'rank', 'match', 'top', 'tag', 'check', 'subtitle', 'reason', 'bars', 'criterion', 'criterion-label', 'bar', 'value', 'pros', 'pro', 'cons', 'con', 'actions', 'choose', 'icon'] as const;
export type PickPart = typeof pickParts[number];
type OptionPart = 'item' | 'card-header' | 'summary' | 'details' | 'rank' | 'match' | 'top' | 'tag' | 'check' | 'subtitle' | 'reason' | 'bars' | 'pros' | 'pro' | 'cons' | 'con' | 'actions' | 'choose';
export type PickSlotProps = {
  [Part in PickPart]: { pick: PickModel; option?: PickOption; row?: PickOption } &
    (Part extends OptionPart ? { option: PickOption; row: PickOption } :
      Part extends 'chip' | 'pips' ? { weight: PickWeight } :
      Part extends 'pip' ? { weight: PickWeight; level: number } :
      Part extends 'criterion' | 'criterion-label' | 'bar' | 'value' ? { option: PickOption; row: PickOption; criterion: PickCriterion } : {});
};
function PickIcon({ name, pick, option }: { name: 'check' | 'minus' | 'ask' | 'undo' | 'chevron'; pick: PickModel; option?: PickOption }) {
  return <PrismPart as={Icon} {...usePart('pick', 'icon')} name={name} slotProps={{ pick, option }} />;
}
function PickFramePart({ part, pick, as = 'div', ...props }: { part: FramePart; pick: PickModel; as?: ElementType; [key: string]: any }) {
  const Frame = useSlot('frame', part, undefined as any), Own = useSlot('pick', part, undefined as any);
  if (Own) return createElement(Own, { ...props, as, pick });
  if (Frame) return createElement(Frame, { ...props, as });
  return <PrismPart as={as} {...props} slotProps={{ pick }} />;
}
function PickItem({ row, pick }: { row: PickOption; pick: PickModel }) {
  const format = useFormat(), match = useSpringValue(row.match), { unstyled } = usePrism();
  const matchText = format.percent(match), matchDescription = interpolate(pick.strings.match, { match: matchText, label: row.matchLabel });
  const option = row, model = { pick, option, row }, detailsId = useId(), collapsible = pick.compact && !row.top;
  const summary = usePart('pick', 'summary'), details = usePart('pick', 'details');
  const parts = { item: usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready'), header: usePart('pick', 'card-header'), rank: usePart('pick', 'rank'), match: usePart('pick', 'match'), top: usePart('pick', 'top'), value: usePart('pick', 'value'), title: usePart('pick', 'title'), subtitle: usePart('pick', 'subtitle'), tag: usePart('pick', 'tag'), reason: usePart('pick', 'reason'), bars: usePart('pick', 'bars'), criterion: usePart('pick', 'criterion'), criterionLabel: usePart('pick', 'criterion-label'), bar: usePart('pick', 'bar'), pros: usePart('pick', 'pros'), cons: usePart('pick', 'cons'), pro: usePart('pick', 'pro'), con: usePart('pick', 'con'), actions: usePart('pick', 'actions'), choose: usePart('pick', 'choose'), check: usePart('pick', 'check') };
  return <PrismPart as="article" {...parts.item} slotProps={model} data-prism-enter={row.ready ? pick.frame.rootProps['data-prism-enter'] : undefined} data-option={row.id} data-top={row.top || undefined} data-expanded={row.expanded} data-flash={pick.flashing ? '' : undefined} aria-busy={!row.ready}>
    <PrismPart as="h4" {...parts.header} slotProps={model} aria-label={row.title}>
      <PrismPart as={collapsible ? 'button' : 'span'} {...summary} slotProps={model} {...(collapsible ? { type: 'button' as const } : {})} aria-expanded={collapsible ? row.expanded : undefined} aria-controls={collapsible ? detailsId : undefined} onClick={collapsible ? row.onToggle : undefined} onFocus={collapsible ? (event: FocusEvent<HTMLElement>) => { if (event.currentTarget.matches(':focus-visible')) row.onExpand(); } : undefined}>
        <PrismPart as="span" {...parts.rank} slotProps={model}>{row.rankLabel}</PrismPart>
        <PrismPart as="span" {...parts.title} slotProps={model}>{row.title}{row.tag && <PrismPart as="span" {...parts.tag} slotProps={model}>{row.tag}</PrismPart>}</PrismPart>
        <PrismPart as="span" {...parts.match} slotProps={model} aria-label={row.matchDescription} data-prism-skeleton={!row.ready ? '' : undefined}>{row.ready ? (pick.compact ? matchText : matchDescription) : pick.strings.loadingLabel}{collapsible && <PickIcon name="chevron" pick={pick} option={option} />}</PrismPart>
        {row.top && <PrismPart as="span" {...parts.top} slotProps={model}>{row.topLabel}</PrismPart>}
      </PrismPart>
    </PrismPart>
    <PrismPart as="div" {...details} slotProps={model} id={detailsId} hidden={!row.expanded}>
    {row.subtitle && <PrismPart as="p" {...parts.subtitle} slotProps={model}>{row.subtitle}</PrismPart>}
    {row.reason && <PrismPart as="p" {...parts.reason} slotProps={model}>{row.reason}</PrismPart>}
    <PrismPart as="div" {...parts.bars} slotProps={model}>{row.bars.map(criterion => <PrismPart as="div" key={criterion.id} {...parts.criterion} slotProps={{ ...model, criterion }} data-state={criterion.weight ? 'active' : 'off'}>
      <PrismPart as="span" {...parts.criterionLabel} slotProps={{ ...model, criterion }}>{criterion.label}</PrismPart>
      <PrismPart as="meter" {...parts.bar} slotProps={{ ...model, criterion }} min={0} max={1} value={criterion.score} style={{ ...parts.bar.style, '--prism-pick-score': criterion.score } as CSSProperties} aria-label={criterion.label}>{criterion.text}</PrismPart>
      <PrismPart as="span" {...parts.value} slotProps={{ ...model, criterion }} data-prism-skeleton={!row.ready ? '' : undefined}>{row.ready ? criterion.text : pick.strings.loadingLabel}</PrismPart>
    </PrismPart>)}</PrismPart>
    {!!row.pros.length && <PrismPart as="ul" {...parts.pros} slotProps={model}>{row.pros.map((pro, index) => <PrismPart as="li" key={index} {...parts.pro} slotProps={model}><PickIcon name="check" pick={pick} option={option} />{pro}</PrismPart>)}</PrismPart>}
    {!!row.cons.length && <PrismPart as="ul" {...parts.cons} slotProps={model}>{row.cons.map((con, index) => <PrismPart as="li" key={index} {...parts.con} slotProps={model}><PickIcon name="minus" pick={pick} option={option} />{con}</PrismPart>)}</PrismPart>}
    </PrismPart>
    <PrismPart as="div" {...parts.actions} slotProps={model}>{row.chosen && <PrismPart as="span" {...parts.check} slotProps={model}><PickIcon name="check" pick={pick} option={option} />{row.chosenLabel}</PrismPart>}<PrismPart as="button" {...parts.choose} slotProps={model} className={cx(parts.choose.className, !unstyled && 'prism-pill')} data-variant="primary" data-feedback="" type="button" data-sent={row.sent ? '' : undefined} disabled={!row.ready || row.sent} onFocus={row.onExpand} onClick={row.onChoose}><SentContent sent={row.sent} receipt={pick.strings.sentLabel}>{row.chooseLabel}</SentContent></PrismPart></PrismPart>
  </PrismPart>;
}
export function Pick(ctx: PrismComponentProps<PickProps>) {
  const pick = usePick(ctx.props, ctx), { parts, frame } = pick, model = { pick };
  return <PickFramePart part="root" pick={pick} as="section" {...frame.rootProps}>
    <PickFramePart part="header" pick={pick} as="header" {...frame.parts.header}>
      <PickFramePart part="title" pick={pick} as="h3" {...frame.parts.title}>{pick.question}</PickFramePart>
      <PickFramePart part="toolbar" pick={pick} {...frame.parts.toolbar}>
        <PickFramePart part="undo" pick={pick} as="button" {...frame.parts.undo} type="button" disabled={!frame.canUndo} onClick={frame.onUndo} aria-label={pick.strings.undoLabel} title={pick.strings.undoLabel} aria-keyshortcuts="Control+Z Meta+Z"><PickIcon name="undo" pick={pick} /></PickFramePart>
        <PickFramePart part="ask" pick={pick} as="button" {...frame.parts.ask} type="button" onClick={pick.onAsk} aria-label={pick.strings.askLabel} title={pick.strings.askLabel}><PickIcon name="ask" pick={pick} /></PickFramePart>
      </PickFramePart>
    </PickFramePart>
    <PickFramePart part="body" pick={pick} {...frame.parts.body}>
      <PrismPart as="div" {...parts.criteria} slotProps={model}>{pick.chips.map(weight => <PrismPart as="button" key={weight.id} {...parts.chip} {...weight.props} slotProps={{ pick, weight }}>{weight.label}<PrismPart as="span" {...parts.pips} slotProps={{ pick, weight }} aria-hidden="true">{weight.pips.map((on, index) => <PrismPart as="span" key={index} {...parts.pip} slotProps={{ pick, weight, level: index + 1 }} data-state={on ? 'on' : 'off'} />)}</PrismPart></PrismPart>)}</PrismPart>
      <PrismPart as="div" {...parts.list} ref={pick.listRef} slotProps={model}>{pick.rows.length ? pick.rows.map(option => <PickItem key={option.id} row={option} pick={pick} />) : <PrismPart as="div" {...parts.empty} slotProps={model}>{pick.emptyLabel}</PrismPart>}</PrismPart>
    </PickFramePart>
    <PickFramePart part="footer" pick={pick} as="footer" {...frame.parts.footer}><PrismPart as="div" {...parts.live} slotProps={model} aria-live={ctx.complete ? 'polite' : 'off'}>{pick.announcement}</PrismPart></PickFramePart>
  </PickFramePart>;
}
export const pick = defineComponent({ name: 'pick', parts: [...pickParts], strings: pickStrings, schema: pickSchema, syntax: 'fence', component: Pick, docs: 'Rank options by weighted criterion scores (0–1). Weight chips cycle 1–2–3–0; arrow keys adjust weights or focus. Choose submits the option id and current weights.', examples: ['```ui:pick\n{"id":"plans","question":"Which plan?","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"basic","title":"Basic","scores":{"price":0.9}}]}\n```'] });
registerComponent(pick);
