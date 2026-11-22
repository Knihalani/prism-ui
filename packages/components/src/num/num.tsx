import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { s, type Infer } from '@prism-ui/schema';
import { defineComponent, registerComponent, useEmit, useFormat, useFormula, usePart, usePrism, useSlot, useStoreValue, type PrismComponentProps } from '@prism-ui/react';

const formatting = { format: s.enum(['number', 'currency', 'percent', 'compact']).default('number'), decimals: s.number({ min: 0, max: 20 }).optional(), currency: s.string().optional(), label: s.string().optional() };
export const numSchema = s.object({ ...formatting, id: s.string().optional(), value: s.number().optional(), min: s.number().optional(), max: s.number().optional(), step: s.number({ min: 0 }).default(1) });
export const calcSchema = s.object({ ...formatting, expr: s.string().optional(), errorLabel: s.string().default('—') });
export type NumProps = Infer<typeof numSchema>;
export type CalcProps = Infer<typeof calcSchema>;

function rawText(node: Node): string {
  const text = node.children?.map(rawText).join('') ?? node.value ?? '';
  return node.type === 'emphasis' ? `*${text}*` : node.type === 'strong' ? `**${text}**` : text;
}
function useNumberFormat(props: Pick<NumProps, 'format' | 'currency' | 'decimals'>) {
  const format = useFormat();
  return useMemo(() => (value: number) => format.number(value, {
    ...(props.format === 'currency' ? { style: 'currency', currency: props.currency ?? format.currencyCode } : props.format === 'percent' ? { style: 'percent' } : props.format === 'compact' ? { notation: 'compact' } : {}),
    ...(props.decimals !== undefined ? { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals } : {}),
  }), [format, props.format, props.currency, props.decimals]);
}

export function useNum(props: NumProps, ctx: PrismComponentProps<NumProps>) {
  const { store } = usePrism(), emit = useEmit(), id = props.id ?? ctx.id;
  const current = useStoreValue<unknown>(id), text = rawText(ctx.node).trim();
  const initial = props.value ?? (text ? Number(text) : NaN), ready = Number.isFinite(initial) || typeof current === 'number';
  const step = props.step > 0 ? props.step : 1, min = props.min ?? -Infinity, max = Math.max(min, props.max ?? Infinity);
  const normalize = (n: number) => Math.max(min, Math.min(max, Number((Math.round((n - (props.min ?? 0)) / step) * step + (props.min ?? 0)).toPrecision(14))));
  const value = typeof current === 'number' && Number.isFinite(current) ? current : Number.isFinite(initial) ? normalize(initial) : 0;
  const format = useNumberFormat(props), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const suppressClick = useRef(false), edit = useRef(false), previous = useRef(value), drag = useRef<{ x: number; previous: number; next: number; moved: boolean; pointer: number } | null>(null), frame = useRef<number | null>(null);
  useLayoutEffect(() => { if (store.get(id) === undefined && Number.isFinite(initial)) store.set(id, normalize(initial)); }, [store, id, initial, min, max, step]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const commit = (next: number, before: number) => { store.set(id, next); emit('change', { id, value: next, previous: before }); };
  const beginEdit = () => { if (!ready) return; previous.current = value; edit.current = true; setDraft(String(value)); setEditing(true); };
  const finishEdit = (cancel = false, text = draft) => {
    if (!edit.current) return;
    edit.current = false; setEditing(false);
    const next = text.trim() ? Number(text) : NaN;
    if (!cancel && Number.isFinite(next)) commit(normalize(next), previous.current);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!ready) return;
    if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); beginEdit(); return; }
    const delta = step * (event.shiftKey ? 10 : 1);
    const keys: Record<string, number> = { ArrowRight: value + delta, ArrowUp: value + delta, ArrowLeft: value - delta, ArrowDown: value - delta, PageUp: value + step * 10, PageDown: value - step * 10, Home: min, End: max };
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); if (Number.isFinite(keys[event.key])) commit(normalize(keys[event.key]), value); }
  };
  const stopFrame = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!ready || event.button !== 0) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, previous: value, next: value, moved: false, pointer: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current; if (!active || active.pointer !== event.pointerId) return;
    const distance = event.clientX - active.x;
    active.moved ||= Math.abs(distance) >= 3;
    if (!active.moved) return;
    active.next = normalize(active.previous + Math.round(distance / 4) * step * (event.shiftKey ? 10 : 1));
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (drag.current) store.set(id, drag.current.next); });
  };
  const endDrag = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const active = drag.current; if (!active || active.pointer !== event.pointerId) return;
    stopFrame(); drag.current = null;
    suppressClick.current = active.moved || cancel;
    if (cancel) store.set(id, active.previous);
    else if (active.moved) commit(active.next, active.previous);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return { editing, formatted: ready ? format(value) : '\u00a0', rootProps: { ...usePart('num', 'root', ready ? 'ready' : 'loading'), role: 'slider', tabIndex: ready ? 0 : -1, 'aria-label': props.label ?? id, 'aria-valuemin': props.min, 'aria-valuemax': props.max, 'aria-valuenow': value, 'aria-valuetext': format(value), 'aria-busy': !ready, onKeyDown, onPointerDown, onPointerMove, onPointerUp: (e: PointerEvent<HTMLElement>) => endDrag(e), onPointerCancel: (e: PointerEvent<HTMLElement>) => endDrag(e, true), onLostPointerCapture: (e: PointerEvent<HTMLElement>) => endDrag(e, true), onClick: () => { if (!suppressClick.current) beginEdit(); suppressClick.current = false; } },
    inputProps: { ...usePart('num', 'input'), type: 'number', role: 'spinbutton', 'aria-label': props.label ?? id, min: props.min, max: props.max, step, value: draft, autoFocus: true, onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value), onBlur: (e: React.FocusEvent<HTMLInputElement>) => finishEdit(false, e.currentTarget.value), onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finishEdit(e.key === 'Escape', e.currentTarget.value); } } } };
}

export function Num(ctx: PrismComponentProps<NumProps>) {
  const num = useNum(ctx.props, ctx), Value = useSlot('num', 'value', 'span' as any);
  return num.editing ? <input {...num.inputProps} /> : <Value {...num.rootProps}>{num.formatted}</Value>;
}

export function useCalc(props: CalcProps, ctx: PrismComponentProps<CalcProps>) {
  const { animate } = usePrism(), expr = props.expr ?? rawText(ctx.node), result = useFormula(expr), format = useNumberFormat(props);
  const [display, setDisplay] = useState(result), shown = useRef(result);
  useEffect(() => {
    if (!animate || !Number.isFinite(result) || !Number.isFinite(shown.current)) { shown.current = result; setDisplay(result); return; }
    const start = performance.now(), from = shown.current; let frame: number;
    const tick = (now: number) => { const progress = Math.min(1, (now - start) / 250); shown.current = progress === 1 ? result : from + (result - from) * (1 - (1 - progress) ** 3); setDisplay(shown.current); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [result, animate]);
  const error = !Number.isFinite(result);
  return { text: error ? props.errorLabel : format(animate && Number.isFinite(display) ? display : result), rootProps: { ...usePart('calc', 'root', error ? 'error' : 'ready'), 'aria-label': [props.label, error ? props.errorLabel : format(result)].filter(Boolean).join(': '), title: error ? expr : undefined } };
}
export function Calc(ctx: PrismComponentProps<CalcProps>) {
  const calc = useCalc(ctx.props, ctx), Value = useSlot('calc', 'value', 'span' as any);
  return <Value {...calc.rootProps}>{calc.text}</Value>;
}
export const num = defineComponent({ name: 'num', schema: numSchema, syntax: 'inline', inline: true, component: Num, docs: 'Editable shared-store number. Drag, click to type, or use arrow keys; percent values are fractions.', examples: [':num[1200]{id=rent min=0 max=5000 step=50 format=currency}'] });
export const calc = defineComponent({ name: 'calc', schema: calcSchema, syntax: 'inline', inline: true, component: Calc, docs: 'Read-only live formula over shared-store paths, with localized number formatting.', examples: [':calc[rent * 12]{format=currency}'] });
registerComponent(num);
registerComponent(calc);
