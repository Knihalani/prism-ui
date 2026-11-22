import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { s, type Infer } from '@prism-ui/schema';
import { defineComponent, registerComponent, useEmit, useFormat, usePart, usePrism, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

const itemSchema = s.object({ id: s.string(), label: s.string(), description: s.string().optional(), price: s.number({ min: 0 }).optional(), qty: s.number().default(1), min: s.number().default(0), max: s.number().optional(), step: s.number({ min: 0 }).default(1), unit: s.string().optional(), optional: s.boolean().default(false), enabled: s.boolean().default(true) });
export const estimateSchema = s.object({ id: s.string().optional(), title: s.string().default('Estimate'), currency: s.string().optional(), items: s.array(itemSchema).default([]), taxRate: s.number({ min: 0 }).default(0), discount: s.number({ min: 0, max: 1 }).default(0), submit: s.string().default('Use this estimate'), subtotalLabel: s.string().default('Subtotal'), discountLabel: s.string().default('Discount'), taxLabel: s.string().default('Tax'), totalLabel: s.string().default('Total'), emptyLabel: s.string().default('Items will appear here'), decreaseLabel: s.string().default('Decrease'), increaseLabel: s.string().default('Increase'), itemCountLabel: s.string().default('items') });
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
function useTween(value: number, animate: boolean) {
  const [display, setDisplay] = useState(value), shown = useRef(value);
  useEffect(() => {
    if (!animate) { shown.current = value; setDisplay(value); return; }
    const from = shown.current, start = performance.now(); let frame: number;
    const tick = (now: number) => { const t = Math.min(1, (now - start) / 250); shown.current = t === 1 ? value : from + (value - from) * (1 - (1 - t) ** 3); setDisplay(shown.current); if (t < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  return animate ? display : value;
}
export function useEstimate(props: EstimateProps, ctx: PrismComponentProps<EstimateProps>) {
  const { store, animate } = usePrism(), format = useFormat(), emit = useEmit(), id = props.id ?? ctx.id;
  const state = useStoreValue(`${id}.items`);
  const storedSubtotal = useStoreValue(`${id}.subtotal`), storedTotal = useStoreValue(`${id}.total`);
  const readItem = (itemId: string): ItemState | undefined => store.get(`${id}.items.${itemId}`);
  const totals = useMemo(() => calculate(props, readItem), [props, state, store, id]);
  const code = props.currency?.trim().toUpperCase();
  const currency = code && /^[A-Z]{3}$/.test(code) ? code : undefined;
  const money = (value: number) => format.currency(value, currency);
  const writeTotals = () => { const next = calculate(props, readItem); store.set(`${id}.subtotal`, next.subtotal); store.set(`${id}.total`, next.total); };
  useLayoutEffect(() => {
    store.batch(() => {
      for (const row of totals.rows) {
        if (!row.ready || !ctx.complete) continue;
        if (store.get(`${id}.items.${row.id}.qty`) === undefined) store.set(`${id}.items.${row.id}.qty`, row.qty);
        if (store.get(`${id}.items.${row.id}.enabled`) === undefined) store.set(`${id}.items.${row.id}.enabled`, row.enabled);
      }
      writeTotals();
    });
  }, [store, id, totals, storedSubtotal, storedTotal, ctx.complete]);
  const update = (item: Item, key: 'qty' | 'enabled', value: number | boolean) => store.batch(() => {
    store.set(`${id}.items.${item.id}.${key}`, key === 'qty' ? quantity(item, value as number) : value); writeTotals();
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
      decreaseProps: { type: 'button' as const, 'aria-label': `${props.decreaseLabel} ${row.label}`, disabled: !row.enabled || !row.ready || row.qty <= row.min, onClick: () => update(row, 'qty', row.qty - (row.step || 1)) },
      increaseProps: { type: 'button' as const, 'aria-label': `${props.increaseLabel} ${row.label}`, disabled: !row.enabled || !row.ready || row.qty >= (row.max ?? Infinity), onClick: () => update(row, 'qty', row.qty + (row.step || 1)) } };
  });
  const onUse = () => {
    const current = calculate(props, readItem);
    const items = current.rows.filter(row => row.enabled && row.ready).map(({ id, label, qty, price, amount }) => ({ id, label, qty, price: price!, amount }));
    emit('use', { items, total: current.total }, `${props.submit}: ${format.number(items.length)} ${props.itemCountLabel}, ${props.totalLabel.toLowerCase()} ${money(current.total)}`);
  };
  const displayedTotal = useTween(totals.total, animate);
  const parts = { list: usePart('estimate', 'list'), empty: usePart('estimate', 'empty'), summary: usePart('estimate', 'summary'), summaryRow: usePart('estimate', 'summary-row'), summaryLabel: usePart('estimate', 'summary-label'), summaryValue: usePart('estimate', 'summary-value'), total: usePart('estimate', 'total'), totalLabel: usePart('estimate', 'total-label'), totalValue: usePart('estimate', 'total-value'), live: usePart('estimate', 'live'), actions: usePart('estimate', 'actions'), submit: usePart('estimate', 'submit') };
  return { rows, parts, title: props.title, emptyLabel: props.emptyLabel, submit: props.submit, onUse, canUse: rows.length > 0 && rows.every(row => row.ready), totalText: money(displayedTotal), finalTotalText: money(totals.total), totalLabel: props.totalLabel,
    summary: [{ label: props.subtotalLabel, value: money(totals.subtotal) }, ...(props.discount ? [{ label: props.discountLabel, value: `−${money(totals.discount)}` }] : []), ...(props.taxRate ? [{ label: props.taxLabel, value: money(totals.tax) }] : [])] };
}
type Row = ReturnType<typeof useEstimate>['rows'][number];
function EstimateItem({ row }: { row: Row }) {
  const parts = { root: usePart('estimate', 'item', !row.ready ? 'loading' : row.enabled ? 'ready' : 'disabled'), checkbox: usePart('estimate', 'checkbox'), details: usePart('estimate', 'details'), label: usePart('estimate', 'label'), description: usePart('estimate', 'description'), price: usePart('estimate', 'price'), stepper: usePart('estimate', 'stepper'), decrease: usePart('estimate', 'decrease'), input: usePart('estimate', 'input'), increase: usePart('estimate', 'increase'), amount: usePart('estimate', 'amount') };
  return <div {...parts.root} aria-busy={!row.ready}>
    {row.optional && <input {...parts.checkbox} {...row.checkboxProps} />}
    <div {...parts.details}><div {...parts.label}>{row.label}</div>{row.description && <div {...parts.description}>{row.description}</div>}<div {...parts.price}>{row.priceText}</div></div>
    <div {...parts.stepper}><button {...parts.decrease} {...row.decreaseProps}>−</button><input {...parts.input} {...row.inputProps} /><button {...parts.increase} {...row.increaseProps}>+</button></div>
    <span {...parts.amount}>{row.amountText}</span>
  </div>;
}
export function Estimate(ctx: PrismComponentProps<EstimateProps>) {
  const estimate = useEstimate(ctx.props, ctx), { parts } = estimate;
  const Item = useSlot('estimate', 'item', EstimateItem), Empty = useSlot('estimate', 'empty', 'div' as any), Actions = useSlot('estimate', 'actions', 'div' as any);
  return <ComponentFrame component="estimate" title={estimate.title} undo ask actions={<Actions {...parts.actions}><button {...parts.submit} type="button" disabled={!estimate.canUse} onClick={estimate.onUse}>{estimate.submit}</button></Actions>}>
    <div {...parts.list}>{estimate.rows.length ? estimate.rows.map(row => <Item key={row.id} row={row} />) : <Empty {...parts.empty}>{estimate.emptyLabel}</Empty>}</div>
    <div {...parts.summary}>{estimate.summary.map(line => <div key={line.label} {...parts.summaryRow}><span {...parts.summaryLabel}>{line.label}</span><span {...parts.summaryValue}>{line.value}</span></div>)}
      <div {...parts.total}><span {...parts.totalLabel}>{estimate.totalLabel}</span><span {...parts.totalValue} aria-hidden="true">{estimate.totalText}</span><span {...parts.live} aria-live="polite">{estimate.finalTotalText}</span></div>
    </div>
  </ComponentFrame>;
}
export const estimate = defineComponent({ name: 'estimate', schema: estimateSchema, syntax: 'fence', component: Estimate, docs: 'Interactive itemized estimate with quantities, optional rows, discount and tax fractions. Publishes subtotal and total under its id for live formulas. Use submits enabled items and total.', examples: ['```ui:estimate\n{"id":"quote","title":"Your estimate","items":[{"id":"seats","label":"Seats","price":20,"qty":3,"unit":"seat"}],"taxRate":0.1}\n```'] });
registerComponent(estimate);
