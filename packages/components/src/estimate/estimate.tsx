import { useLayoutEffect, useMemo, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { defineComponent, registerComponent, Icon, PrismPart, useFormat, usePart, usePrism, useSent, useSlot, useSpringValue, useStrings, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { setRecordPath } from '../store-record';

const itemSchema = s.object({ id: s.string(), label: s.string(), description: s.string().optional(), price: s.number({ min: 0 }).optional(), qty: s.number().default(1), min: s.number().default(0), max: s.number().optional(), step: s.number({ min: 0 }).default(1), unit: s.string().optional(), optional: s.boolean().default(false), enabled: s.boolean().default(true) });
export const estimateStrings = { title: 'Estimate', submit: 'Use this estimate', subtotalLabel: 'Subtotal', discountLabel: 'Discount', taxLabel: 'Tax', totalLabel: 'Total', emptyLabel: 'Items will appear here', decreaseLabel: 'Decrease', increaseLabel: 'Increase', itemCountLabel: 'items', sentLabel: 'Sent', askLabel: 'Ask about this', undoLabel: 'Undo' };
export const estimateSchema = s.object({ id: s.string().optional(), title: s.string().default(estimateStrings.title), currency: s.string().optional(), items: s.array(itemSchema).default([]), taxRate: s.number({ min: 0 }).default(0), discount: s.number({ min: 0, max: 1 }).default(0), submit: s.string().default(estimateStrings.submit), subtotalLabel: s.string().default(estimateStrings.subtotalLabel), discountLabel: s.string().default(estimateStrings.discountLabel), taxLabel: s.string().default(estimateStrings.taxLabel), totalLabel: s.string().default(estimateStrings.totalLabel), emptyLabel: s.string().default(estimateStrings.emptyLabel), decreaseLabel: s.string().default(estimateStrings.decreaseLabel), increaseLabel: s.string().default(estimateStrings.increaseLabel), itemCountLabel: s.string().default(estimateStrings.itemCountLabel), sentLabel: s.string().default(estimateStrings.sentLabel) });
export type EstimateProps = Infer<typeof estimateSchema>;
type Item = Infer<typeof itemSchema>;
type ItemState = { qty?: number; enabled?: boolean };
function quantity(item: Item, value: number) {
  const step = item.step > 0 ? item.step : 1;
  return Math.max(item.min, Math.min(Math.max(item.min, item.max ?? Infinity), Number((Math.round((value - item.min) / step) * step + item.min).toPrecision(14))));
}
function calculate(props: EstimateProps, readItem: (id: string) => ItemState | undefined) {
  const rows = props.items.filter(item => item.id).map(item => {
    const saved = readItem(item.id), qty = quantity(item, Number.isFinite(saved?.qty) ? saved!.qty! : item.qty);
    const enabled = !item.optional || (saved?.enabled ?? item.enabled), ready = item.price !== undefined;
    return { ...item, qty, enabled, ready, amount: enabled && ready ? item.price! * qty : 0 };
  });
  const subtotal = rows.reduce((sum, row) => sum + row.amount, 0), discount = subtotal * props.discount, tax = (subtotal - discount) * props.taxRate;
  return { rows, subtotal, discount, tax, total: subtotal - discount + tax };
}
export function useEstimate(props: EstimateProps, ctx: PrismComponentProps<EstimateProps>) {
  const { store, animate } = usePrism(), format = useFormat(), { send, sent, reset } = useSent(), strings = useStrings('estimate'), id = props.id ?? ctx.id;
  const state = useStoreValue(`${id}.items`);
  const storedSubtotal = useStoreValue(`${id}.subtotal`), storedTotal = useStoreValue(`${id}.total`);
  const readItem = (itemId: string): ItemState | undefined => store.get(`${id}.items.${itemId}`);
  const totals = useMemo(() => calculate(props, readItem), [props, state, store, id]);
  const code = props.currency?.trim().toUpperCase();
  const currency = code && /^[A-Z]{3}$/.test(code) ? code : undefined;
  const money = (value: number) => format.currency(value, currency);
  const writeTotals = () => { const next = calculate(props, readItem); store.set(`${id}.subtotal`, next.subtotal, { history: false }); store.set(`${id}.total`, next.total, { history: false }); };
  useLayoutEffect(() => {
    store.batch(() => {
      for (const row of totals.rows) {
        if (!row.ready || !ctx.complete) continue;
        if (store.get(`${id}.items.${row.id}.qty`) === undefined) setRecordPath(store, `${id}.items`, `${row.id}.qty`, row.qty, { history: false });
        if (store.get(`${id}.items.${row.id}.enabled`) === undefined) setRecordPath(store, `${id}.items`, `${row.id}.enabled`, row.enabled, { history: false });
      }
      writeTotals();
    });
  }, [store, id, totals, storedSubtotal, storedTotal, ctx.complete]);
  const update = (item: Item, key: 'qty' | 'enabled', value: number | boolean) => store.batch(() => {
    reset();
    setRecordPath(store, `${id}.items`, `${item.id}.${key}`, key === 'qty' ? quantity(item, value as number) : value); writeTotals();
  });
  const rows = totals.rows.map(row => {
    const setQuantity = (text: string) => { const n = text.trim() ? Number(text) : NaN; if (Number.isFinite(n)) update(row, 'qty', n); };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      const step = row.step > 0 ? row.step : 1;
      const delta: Record<string, number> = { ArrowUp: step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
      if (Object.hasOwn(delta, event.key)) { event.preventDefault(); update(row, 'qty', row.qty + delta[event.key] * (event.shiftKey ? 10 : 1)); }
    };
    return { ...row, priceText: row.ready ? money(row.price!) + (row.unit ? ` / ${row.unit}` : '') : '\u00a0', amountText: row.ready ? money(row.amount) : '\u00a0',
      checkboxProps: { type: 'checkbox', role: 'checkbox', checked: row.enabled, 'aria-label': row.label, onChange: () => update(row, 'enabled', !row.enabled) },
      inputProps: { type: 'number', role: 'spinbutton', 'aria-label': row.label, 'aria-valuenow': row.qty, min: row.min, max: row.max, step: row.step > 0 ? row.step : 1, value: row.qty, disabled: !row.enabled || !row.ready, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuantity(event.currentTarget.value), onInput: (event: React.FormEvent<HTMLInputElement>) => setQuantity(event.currentTarget.value), onKeyDown },
      decreaseProps: { type: 'button' as const, 'aria-label': `${strings.decreaseLabel} ${row.label}`, disabled: !row.enabled || !row.ready || row.qty <= row.min, onClick: () => update(row, 'qty', row.qty - (row.step || 1)) },
      increaseProps: { type: 'button' as const, 'aria-label': `${strings.increaseLabel} ${row.label}`, disabled: !row.enabled || !row.ready || row.qty >= (row.max ?? Infinity), onClick: () => update(row, 'qty', row.qty + (row.step || 1)) } };
  });
  const onUse = () => {
    const current = calculate(props, readItem);
    const items = current.rows.filter(row => row.enabled && row.ready).map(({ id, label, qty, price, amount }) => ({ id, label, qty, price: price!, amount }));
    send('use', { items, total: current.total }, `${strings.submit}: ${format.number(items.length)} ${strings.itemCountLabel}, ${strings.totalLabel.toLowerCase()} ${money(current.total)}`);
  };
  const displayedTotal = useSpringValue(totals.total);
  const parts = { list: usePart('estimate', 'list'), empty: usePart('estimate', 'empty'), summary: usePart('estimate', 'summary'), summaryRow: usePart('estimate', 'summary-row'), summaryLabel: usePart('estimate', 'summary-label'), summaryValue: usePart('estimate', 'summary-value'), total: usePart('estimate', 'total'), totalLabel: usePart('estimate', 'total-label'), totalValue: usePart('estimate', 'total-value'), live: usePart('estimate', 'live'), actions: usePart('estimate', 'actions'), submit: usePart('estimate', 'submit') };
  return { rows, parts, title: strings.title, emptyLabel: strings.emptyLabel, submit: strings.submit, sentLabel: strings.sentLabel, sent: !!sent, total: totals.total, displayedTotal, formatMoney: money, onUse, canUse: rows.length > 0 && rows.every(row => row.ready), totalText: money(displayedTotal), finalTotalText: money(totals.total), totalLabel: strings.totalLabel,
    summary: [{ label: strings.subtotalLabel, value: money(totals.subtotal) }, ...(props.discount ? [{ label: strings.discountLabel, value: `−${money(totals.discount)}` }] : []), ...(props.taxRate ? [{ label: strings.taxLabel, value: money(totals.tax) }] : [])] };
}
export type EstimateModel = ReturnType<typeof useEstimate>;
type Row = EstimateModel['rows'][number];
function EstimateItem({ row }: { row: Row }) {
  const parts = { root: usePart('estimate', 'item', !row.ready ? 'loading' : row.enabled ? 'ready' : 'disabled'), checkbox: usePart('estimate', 'checkbox'), details: usePart('estimate', 'details'), label: usePart('estimate', 'label'), description: usePart('estimate', 'description'), price: usePart('estimate', 'price'), stepper: usePart('estimate', 'stepper'), decrease: usePart('estimate', 'decrease'), input: usePart('estimate', 'input'), increase: usePart('estimate', 'increase'), amount: usePart('estimate', 'amount') };
  return <PrismPart as="div" {...parts.root} slotProps={{ row }} aria-busy={!row.ready}>
    {row.optional && <PrismPart as="input" {...parts.checkbox} {...row.checkboxProps} />}
    <PrismPart as="div" {...parts.details}><PrismPart as="div" {...parts.label}>{row.label}</PrismPart>{row.description && <PrismPart as="div" {...parts.description}>{row.description}</PrismPart>}<PrismPart as="div" {...parts.price}>{row.priceText}</PrismPart></PrismPart>
    <PrismPart as="div" {...parts.stepper}><PrismPart as="button" {...parts.decrease} {...row.decreaseProps}><Icon name="minus" /></PrismPart><PrismPart as="input" {...parts.input} {...row.inputProps} /><PrismPart as="button" {...parts.increase} {...row.increaseProps}><Icon name="plus" /></PrismPart></PrismPart>
    <PrismPart as="span" {...parts.amount}>{row.amountText}</PrismPart>
  </PrismPart>;
}
export function Estimate(ctx: PrismComponentProps<EstimateProps>) {
  const estimate = useEstimate(ctx.props, ctx), { parts } = estimate;
  const Submit = useSlot('estimate', 'submit', 'button' as any);
  return <ComponentFrame component="estimate" title={estimate.title} undo ask actions={<PrismPart as="div" {...parts.actions}><Submit {...parts.submit} type="button" data-sent={estimate.sent ? '' : undefined} disabled={!estimate.canUse || estimate.sent} onClick={estimate.onUse}>{estimate.sent ? <><Icon name="check" />{estimate.sentLabel}</> : <>{estimate.submit}<Icon name="send" /></>}</Submit></PrismPart>}>
    <PrismPart as="div" {...parts.list}>{estimate.rows.length ? estimate.rows.map(row => <EstimateItem key={row.id} row={row} />) : <PrismPart as="div" {...parts.empty}>{estimate.emptyLabel}</PrismPart>}</PrismPart>
    <PrismPart as="div" {...parts.summary}>{estimate.summary.map(line => <PrismPart as="div" key={line.label} {...parts.summaryRow}><PrismPart as="span" {...parts.summaryLabel}>{line.label}</PrismPart><PrismPart as="span" {...parts.summaryValue}>{line.value}</PrismPart></PrismPart>)}
      <PrismPart as="div" {...parts.total} slotProps={{ estimate }}><PrismPart as="span" {...parts.totalLabel}>{estimate.totalLabel}</PrismPart><PrismPart as="span" {...parts.totalValue} aria-hidden="true">{estimate.totalText}</PrismPart><PrismPart as="span" {...parts.live} aria-live="polite">{estimate.finalTotalText}</PrismPart></PrismPart>
    </PrismPart>
  </ComponentFrame>;
}
export const estimate = defineComponent({ name: 'estimate', schema: estimateSchema, syntax: 'fence', component: Estimate, parts: ['root', 'header', 'title', 'toolbar', 'body', 'footer', 'ask', 'undo', 'list', 'item', 'checkbox', 'details', 'label', 'description', 'price', 'stepper', 'decrease', 'input', 'increase', 'amount', 'empty', 'summary', 'summary-row', 'summary-label', 'summary-value', 'total', 'total-label', 'total-value', 'live', 'actions', 'submit'], strings: estimateStrings, docs: 'Interactive itemized estimate with quantities, optional rows, discount and tax fractions. Publishes subtotal and total under its id for live formulas. Use submits enabled items and total.', examples: ['```ui:estimate\n{"id":"quote","title":"Your estimate","items":[{"id":"seats","label":"Seats","price":20,"qty":3,"unit":"seat"}],"taxRate":0.1}\n```'] });
registerComponent(estimate);
