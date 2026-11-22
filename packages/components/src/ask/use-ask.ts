import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ComponentContext, useComponentState, useEmit, useFlash, useFormat, useLocalWrite, useSent, useSettled, useStrings, type Format, type PrismContextValue } from '@prism-ui/react';
import { useFrame } from '../frame';
import { interpolate } from '../interpolate';

export type AskValue = string | number | boolean | null;
export interface AskField { id?: string; label?: string; type?: 'text' | 'number' | 'select' | 'date' | 'toggle' | 'textarea'; options?: (string | { value: string; label: string })[]; value?: AskValue; required?: boolean; hint?: string; placeholder?: string; min?: number; max?: number; step?: number; unit?: string }
export const askStrings = { title: 'Details', send: 'Send', edit: 'Edit', sentLabel: 'Sent', editValue: 'Edit {label}: {value}', suggested: 'Suggested', required: 'Required', requiredMark: '*', minimum: 'Enter at least {min}', maximum: 'Enter no more than {max}', stepMismatch: 'Use steps of {step}', invalidNumber: 'Enter a number', empty: 'Not provided', loading: 'Loading fields', yes: 'Yes', no: 'No', select: 'Select an option', nbsp: '\u00a0', sentence: '', undoLabel: 'Undo', askLabel: 'Ask about this', askMessage: 'Tell me more about these details…', submitMessage: 'Here are the details for "{title}": {details}.', detail: '{label}: {value}', detailSeparator: ', ', numberUnit: '{value} {unit}' };
export type AskLabels = Partial<typeof askStrings>;
export interface AskProps { id?: string; title?: string; submit?: string; sentence?: string; fields?: (AskField | null)[]; labels?: AskLabels }
export function normalize(field: AskField, value: unknown): AskValue {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'number') { const number = typeof value === 'number' ? value : Number(value); return Number.isFinite(number) ? number : null; }
  if (field.type === 'toggle') return value === true || value === 'true';
  return String(value);
}
export function safeFields(value: unknown): AskField[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((field): field is AskField => !!field && typeof field === 'object' && !Array.isArray(field) && (!field.id || (!seen.has(field.id) && !!seen.add(field.id))));
}
function formatted(field: AskField, value: AskValue, format: Format, strings: Record<string, string>): string {
  if (value === null) return strings.empty;
  if (field.type === 'number' && typeof value === 'number') return field.unit ? interpolate(strings.numberUnit, { value: format.number(value), unit: field.unit }) : format.number(value);
  if (field.type === 'date' && typeof value === 'string') { const date = new Date(value + 'T00:00:00'); if (Number.isFinite(date.getTime())) return format.date(date, { day: 'numeric', month: 'short', year: 'numeric' }); }
  if (field.type === 'toggle') return value ? strings.yes : strings.no;
  if (field.type === 'select') { const option = field.options?.find(option => option && (typeof option === 'string' ? option : option.value) === value); if (option) return typeof option === 'string' ? option : option.label; }
  return String(value);
}
export function askMessage(title: unknown, fields: AskField[], values: Record<string, unknown>, display: (field: AskField, value: AskValue) => string, strings: Record<string, string>) {
  return interpolate(strings.submitMessage, { title: String(title ?? strings.title), details: fields.filter(field => field.id).map(field => interpolate(strings.detail, { label: field.label ?? field.id!, value: display(field, normalize(field, Object.hasOwn(values, field.id!) ? values[field.id!] : null)) })).join(strings.detailSeparator) });
}
function composition(template: string, fields: AskField[]) {
  const chunks: { text: string; lead: string; field: AskField; punctuation: string }[] = [], used = new Set<string>();
  let end = 0;
  for (const match of template.matchAll(/\{([^{}]+)\}([.,;:!?]*)/g)) {
    const field = fields.find(field => field.id === match[1]);
    if (!field || field.type === 'textarea' || used.has(match[1])) return undefined;
    const prefix = template.slice(end, match.index), words = /^(.*?)(\S+\s*)$/s.exec(prefix);
    chunks.push({ text: words?.[1] ?? prefix, lead: words?.[2].trim() ?? '', field, punctuation: match[2] });
    used.add(match[1]); end = match.index! + match[0].length;
  }
  return chunks.length ? { chunks, tail: template.slice(end), remaining: fields.filter(field => !used.has(field.id ?? '')) } : undefined;
}
export function useAsk(props: AskProps, ctx: PrismContextValue) {
  const component = useContext(ComponentContext), format = useFormat(), emit = useEmit(), localWrite = useLocalWrite(), { send, sent, reset } = useSent(), complete = useSettled();
  const strings = useStrings('ask', askStrings), labels = strings;
  const fields = useMemo(() => safeFields(props.fields), [props.fields]);
  const [values, setValues] = useComponentState<Record<string, AskValue>>('values', {}), [touched, setTouched] = useComponentState<Record<string, boolean>>('touched', {}), [submitted, setSubmitted] = useComponentState('submitted', false);
  useEffect(() => { if (!submitted) reset(); }, [submitted, reset]);
  const current = useMemo<Record<string, AskValue>>(() => Object.fromEntries(fields.filter(field => field.id).map(field => [field.id!, normalize(field, Object.hasOwn(values, field.id!) ? values[field.id!] : field.value)])), [fields, values]);
  const signature = JSON.stringify([fields, current]), previous = useRef(signature);
  useEffect(() => { if (previous.current !== signature) { reset(); setSubmitted(false); } previous.current = signature; }, [signature, reset]);
  const frame = useFrame({ component: 'ask', title: strings.title, ask: true, undo: true }), flashing = useFlash(`${component?.id}.values`), controls = useRef(new Map<string, HTMLElement>());
  const focus = useRef<string | undefined>(undefined);
  useLayoutEffect(() => { if (!sent && focus.current) { controls.current.get(focus.current)?.focus(); focus.current = undefined; } }, [sent]);
  const errors = Object.fromEntries(fields.filter(field => field.id).map(field => {
    const value = current[field.id!]; let error = '';
    if (field.required && (value === null || (typeof value === 'string' && !value.trim()))) error = strings.required;
    else if (typeof value === 'number') {
      if (field.min !== undefined && value < field.min) error = interpolate(strings.minimum, { min: format.number(field.min) });
      if (field.max !== undefined && value > field.max) error = interpolate(strings.maximum, { max: format.number(field.max) });
      if (!error && field.step !== undefined && Number.isFinite(field.step) && field.step > 0) { const increments = (value - (field.min ?? 0)) / field.step; if (Math.abs(increments - Math.round(increments)) > 1e-8) error = interpolate(strings.stepMismatch, { step: format.number(field.step) }); }
    }
    return [field.id!, error];
  }));
  const payload = sent?.payload as { values?: unknown } | undefined;
  const delivered = payload?.values && typeof payload.values === 'object' && !Array.isArray(payload.values) ? payload.values as Record<string, unknown> : {};
  const receiptFields = [...fields, ...Object.keys(delivered).filter(key => !fields.some(field => field.id === key)).map(key => ({ id: key, label: key, type: typeof delivered[key] === 'boolean' ? 'toggle' as const : typeof delivered[key] === 'number' ? 'number' as const : 'text' as const }))];
  const receiptValues = Object.fromEntries(receiptFields.filter(field => field.id).map(field => [field.id!, normalize(field, Object.hasOwn(delivered, field.id!) ? delivered[field.id!] : null)]));
  const sentence = composition(strings.sentence, fields);
  const sentenceRef = useRef<HTMLDivElement>(null), sentenceWidth = useRef(0);
  const [sentenceHeight, setSentenceHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!sent || !sentenceRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (Math.abs(sentenceRef.current!.getBoundingClientRect().width - sentenceWidth.current) > .5) setSentenceHeight(undefined); });
    observer.observe(sentenceRef.current);
    return () => observer.disconnect();
  }, [!!sent]);
  const canSubmit = complete && fields.length > 0 && fields.every(field => field.id && field.label && field.type);
  function change(id: string, value: AskValue) { reset(); setSubmitted(false); setValues(old => ({ ...old, [id]: value })); }
  function blur(id: string) { setTouched(old => ({ ...old, [id]: true })); if (!Object.hasOwn(values, id) && fields.find(field => field.id === id)?.value != null) setValues(old => ({ ...old, [id]: current[id] })); }
  function submit() {
    if (!canSubmit) return;
    setTouched(Object.fromEntries(fields.map(field => [field.id!, true])));
    const invalid = fields.find(field => errors[field.id!]);
    if (invalid) { controls.current.get(invalid.id!)?.focus(); return; }
    const bounds = sentenceRef.current?.getBoundingClientRect(); sentenceWidth.current = bounds?.width ?? 0; setSentenceHeight(bounds?.height);
    localWrite(() => ctx.store.batch(() => { setValues(current); setSubmitted(true); }));
    send('submit', { values: { ...current } }, askMessage(strings.title, fields, current, (field, value) => formatted(field, value, format, strings), strings));
  }
  return { fields, values: current, touched, submitted: !!sent, sent, receiptFields, receiptValues, labels, strings, errors, controls, complete, title: strings.title, submitLabel: strings.submit ?? strings.send, canSubmit, sentence, sentenceRef, sentenceHeight: sent ? sentenceHeight : undefined, frame, flashing,
    suggested(field: AskField) { return field.value !== undefined && field.value !== null && !Object.hasOwn(values, field.id ?? ''); },
    loading(index: number) { return !complete && (index === fields.length - 1 || !fields[index]?.type || !fields[index]?.id); },
    change, blur, submit, edit(id?: string) { focus.current = id ?? fields[0]?.id; setValues(receiptValues); reset(); setSubmitted(false); }, onAsk() { emit('ask', undefined, strings.askMessage); },
    display(field: AskField) { return formatted(field, (sent ? receiptValues : current)[field.id ?? ''] ?? null, format, strings); },
    onKeyDown(event: KeyboardEvent<HTMLElement>) { const element = event.target as HTMLElement; if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return; if ((element.tagName === 'TEXTAREA' && (event.ctrlKey || event.metaKey)) || (element.tagName === 'INPUT' && !event.ctrlKey && !event.metaKey)) { event.preventDefault(); submit(); } },
  };
}
export type AskModel = ReturnType<typeof useAsk>;
