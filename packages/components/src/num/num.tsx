import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { compile } from '@prism-ui/state';
import { s, type Infer } from '@prism-ui/schema';
import { Icon, useStrings, PrismPart, defineComponent, registerComponent, useEmit, useFlash, useFormat, useFormula, useLocalWrite, usePart, usePresentation, usePrism, useStoreValue, type PrismComponentProps } from '@prism-ui/react';
import { interpolate } from '../interpolate';
import { useInlineReadout } from './inline-layout';
import { useNumberTween } from './use-tween';
import { Odometer } from '../shared/controls';

export const numStrings = { label: '{id}', valueLabel: '{value}', loadingLabel: '\u00a0', instructions: 'Drag to adjust, or press Enter to type. Arrow keys adjust by {step}; hold Shift for larger steps.', readoutLabel: '{label}: {value}', dragHint: 'Drag to adjust. Shift for larger steps.', changeMessage: '{label}: {value}' };
export const calcStrings = { errorLabel: '—', loadingLabel: '\u00a0', valueLabel: '{label}: {value}', numberLabel: '{value}', errorDescription: '{expression}' };

const formatting = { format: s.enum(['number', 'currency', 'percent', 'compact']).default('number'), decimals: s.number({ min: 0, max: 20 }).optional(), currency: s.string().optional(), label: s.string().optional() };
export const numSchema = s.object({ ...formatting, id: s.string().optional(), value: s.number().optional(), min: s.number().optional(), max: s.number().optional(), step: s.number({ min: 0 }).default(1) });
export const calcSchema = s.object({ ...formatting, expr: s.string().optional(), errorLabel: s.string().default(calcStrings.errorLabel) });
export type NumProps = Infer<typeof numSchema>;
export type CalcProps = Infer<typeof calcSchema>;

function rawText(node: Node): string {
  const text = node.children?.map(rawText).join('') ?? node.value ?? '';
  return node.type === 'emphasis' ? `*${text}*` : node.type === 'strong' ? `**${text}**` : text;
}
function useNumberFormat(props: Pick<NumProps, 'format' | 'currency' | 'decimals'>) {
  const format = useFormat();
  const currency = props.currency?.trim().toUpperCase();
  return useMemo(() => (value: number) => format.number(value, {
    ...(props.format === 'currency' ? { style: 'currency', currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : format.currencyCode } : props.format === 'percent' ? { style: 'percent' } : props.format === 'compact' ? { notation: 'compact' } : {}),
    ...(props.decimals !== undefined ? { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals } : {}),
  }), [format, props.format, currency, props.decimals]);
}

export function useNum(props: NumProps, ctx: PrismComponentProps<NumProps>) {
  const strings = useStrings('num', numStrings);
  const { store } = usePrism(), emit = useEmit(), localWrite = useLocalWrite(), presentation = usePresentation(), id = props.id ?? ctx.id;
  const flashing = useFlash(id), label = interpolate(strings.label, { id: props.id ?? ctx.id });
  const current = useStoreValue<unknown>(id), text = rawText(ctx.node).trim();
  const initial = props.value ?? (text ? Number(text) : NaN), ready = Number.isFinite(initial) || (typeof current === 'number' && Number.isFinite(current));
  const step = props.step > 0 ? props.step : 1, min = props.min ?? -Infinity, max = Math.max(min, props.max ?? Infinity);
  const normalize = (n: number) => Math.max(min, Math.min(max, Number((Math.round((n - (props.min ?? 0)) / step) * step + (props.min ?? 0)).toPrecision(14))));
  const value = typeof current === 'number' && Number.isFinite(current) ? current : Number.isFinite(initial) ? normalize(initial) : 0;
  const format = useNumberFormat(props), [editing, setEditing] = useState(false), [draft, setDraft] = useState(''), [scrubbing, setScrubbing] = useState(false), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  const formatted = ready ? format(value) : strings.loadingLabel, readoutVisible = ready && !editing && (scrubbing || hovered || focused), layout = useInlineReadout(readoutVisible, scrubbing ? formatted : strings.dragHint);
  const suppressClick = useRef(false), edit = useRef(false), previous = useRef(value), drag = useRef<{ x: number; y: number; touch: boolean; previous: number; next: number; moved: boolean; pointer: number } | null>(null), frame = useRef<number | null>(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => { if (!editing && returnFocus.current) { returnFocus.current = false; layout.root.current?.focus(); } }, [editing, layout.root]);
  useLayoutEffect(() => { if (store.get(id) === undefined && Number.isFinite(initial)) localWrite(() => store.set(id, normalize(initial))); }, [store, id, initial, min, max, step, localWrite]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const commit = (next: number, before: number) => { localWrite(() => store.set(id, next)); emit('change', { id, value: next, previous: before }, interpolate(strings.changeMessage, { label, value: format(next), previous: format(before) })); };
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
    drag.current = { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', previous: value, next: value, moved: false, pointer: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current; if (!active || active.pointer !== event.pointerId) return;
    const distance = event.clientX - active.x;
    if (active.touch && !active.moved && Math.abs(event.clientY - active.y) > Math.max(3, Math.abs(distance))) { drag.current = null; suppressClick.current = true; event.currentTarget.releasePointerCapture?.(event.pointerId); return; }
    active.moved ||= Math.abs(distance) >= 3;
    if (!active.moved) return;
    setScrubbing(true);
    active.next = normalize(active.previous + Math.round(distance / 4) * step * (event.shiftKey ? 10 : 1));
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (drag.current) localWrite(() => store.set(id, drag.current!.next)); });
  };
  const endDrag = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const active = drag.current; if (!active || active.pointer !== event.pointerId) return;
    stopFrame(); drag.current = null; setScrubbing(false);
    suppressClick.current = active.moved || cancel;
    if (cancel) localWrite(() => store.set(id, active.previous));
    else if (active.moved) commit(active.next, active.previous);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return { id, value, ready, editing, scrubbing, readoutVisible, flashing, strings, layout, formatted, label,
    parts: { value: usePart('num', 'value', ready ? 'ready' : 'loading'), readout: usePart('num', 'readout'), readoutValue: usePart('num', 'readout-value'), readoutHint: usePart('num', 'readout-hint'), icon: usePart('num', 'icon') },
    rootProps: { ...usePart('num', 'root'), ...presentation, ref: layout.root, onPointerEnter: () => setHovered(true), onPointerLeave: () => setHovered(false), onFocus: () => setFocused(true), onBlur: (event: FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as HTMLElement | null)) setFocused(false); }, 'data-status': !ready ? 'loading' : editing ? 'editing' : scrubbing ? 'scrubbing' : 'ready', 'data-prism-flash': flashing ? '' : undefined, role: editing ? undefined : 'slider', tabIndex: editing ? undefined : ready ? 0 : -1, 'aria-label': editing ? undefined : label, 'aria-description': interpolate(strings.instructions, { step: format(step) }), 'aria-valuemin': editing ? undefined : props.min, 'aria-valuemax': editing ? undefined : props.max, 'aria-valuenow': editing ? undefined : value, 'aria-valuetext': editing ? undefined : interpolate(strings.valueLabel, { value: format(value) }), 'aria-busy': !ready, onKeyDown: editing ? undefined : onKeyDown, onPointerDown: editing ? undefined : onPointerDown, onPointerMove: editing ? undefined : onPointerMove, onPointerUp: (e: PointerEvent<HTMLElement>) => endDrag(e), onPointerCancel: (e: PointerEvent<HTMLElement>) => endDrag(e, true), onLostPointerCapture: (e: PointerEvent<HTMLElement>) => endDrag(e, true), onClick: editing ? undefined : () => { if (!suppressClick.current) beginEdit(); suppressClick.current = false; } },
    inputProps: { ...usePart('num', 'input'), type: 'number', role: 'spinbutton', 'aria-label': label, min: props.min, max: props.max, step, value: draft, autoFocus: true, onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value), onBlur: (e: React.FocusEvent<HTMLInputElement>) => finishEdit(false, e.currentTarget.value), onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); returnFocus.current = true; finishEdit(e.key === 'Escape', e.currentTarget.value); } } } };
}

export function Num(ctx: PrismComponentProps<NumProps>) {
  const num = useNum(ctx.props, ctx), model = { num };
  const readout = interpolate(num.strings.readoutLabel, { label: num.label, value: '\ufff0' }).split('\ufff0');
  return <PrismPart as="span" {...num.rootProps} slotProps={model}>
    {num.editing ? <PrismPart as="input" {...num.inputProps} slotProps={model} /> : <PrismPart as="span" {...num.parts.value} slotProps={model} data-prism-skeleton={!num.ready ? '' : undefined}><Odometer value={num.value} format={() => num.formatted} /></PrismPart>}
    {num.readoutVisible && <PrismPart as="span" {...num.parts.readout} slotProps={model} ref={num.layout.readout} style={{ ...num.parts.readout.style, ...num.layout.style }} data-side={num.layout.below ? 'below' : 'above'} data-scrubbing={num.scrubbing || undefined} aria-hidden="true">
      <PrismPart as={Icon} {...num.parts.icon} slotProps={model} name="chevron-left" />
      {num.scrubbing ? <PrismPart as="span" {...num.parts.readoutValue} slotProps={model}>{readout.map((text, index) => <span key={index} style={{ display: 'contents' }}>{index > 0 && <span data-readout-amount="">{num.formatted}</span>}<span data-readout-label="">{text}</span></span>)}</PrismPart> : <PrismPart as="span" {...num.parts.readoutHint} slotProps={model}>{num.strings.dragHint}</PrismPart>}
      <PrismPart as={Icon} {...num.parts.icon} slotProps={model} name="chevron-right" />
    </PrismPart>}
  </PrismPart>;
}

export function useCalc(props: CalcProps, ctx: PrismComponentProps<CalcProps>) {
  const strings = useStrings('calc', calcStrings);
  const { animate, unstyled } = usePrism(), expr = props.expr ?? rawText(ctx.node), result = useFormula(expr), format = useNumberFormat(props), root = useRef<HTMLSpanElement>(null), presentation = usePresentation();
  const deps = useMemo(() => { try { return compile(expr).deps; } catch { return []; } }, [expr]);
  const flashing = useFlash(deps), display = useNumberTween(result, animate && !unstyled, root);
  const error = !Number.isFinite(result);
  const loading = error && presentation['data-state'] === 'streaming';
  const label = interpolate((strings.label ?? props.label) ? strings.valueLabel : strings.numberLabel, { label: strings.label ?? props.label ?? '', value: loading ? strings.loadingLabel : error ? strings.errorLabel : format(result) }), title = error ? interpolate(strings.errorDescription, { expression: expr }) : undefined;
  return { result, display, error, loading, expr, deps, flashing, strings, text: loading ? strings.loadingLabel : error ? strings.errorLabel : format(display),
    valueProps: { ...usePart('calc', 'value', loading ? 'loading' : error ? 'error' : 'ready'), 'aria-label': label, 'data-prism-skeleton': loading ? '' : undefined, title },
    rootProps: { ...usePart('calc', 'root'), ...presentation, ref: root, role: 'math', 'data-status': loading ? 'loading' : error ? 'error' : 'ready', 'data-prism-flash': flashing ? '' : undefined, 'aria-label': label, title } };
}
export function Calc(ctx: PrismComponentProps<CalcProps>) {
  const calc = useCalc(ctx.props, ctx), model = { calc };
  return <PrismPart as="span" {...calc.rootProps} slotProps={model}><PrismPart as="span" {...calc.valueProps} slotProps={model}>{calc.text}</PrismPart></PrismPart>;
}
export type NumModel = ReturnType<typeof useNum>;
export type CalcModel = ReturnType<typeof useCalc>;
export type NumSlotProps = { [Part in 'root' | 'value' | 'input' | 'readout' | 'readout-value' | 'readout-hint' | 'icon']: { num: NumModel } };
export type CalcSlotProps = { [Part in 'root' | 'value']: { calc: CalcModel } };
export const num = defineComponent({ name: 'num', parts: ['input', 'root', 'value', 'readout', 'readout-value', 'readout-hint', 'icon'], strings: numStrings, schema: numSchema, syntax: 'inline', inline: true, component: Num, docs: 'Editable shared-store number. Drag, click to type, or use arrow keys; percent values are fractions.', examples: [':num[1200]{id=rent min=0 max=5000 step=50 format=currency}'] });
export const calc = defineComponent({ name: 'calc', parts: ['root', 'value'], strings: calcStrings, schema: calcSchema, syntax: 'inline', inline: true, component: Calc, docs: 'Read-only live formula over shared-store paths, with localized number formatting.', examples: [':calc[rent * 12]{format=currency}'] });
registerComponent(num);
registerComponent(calc);
