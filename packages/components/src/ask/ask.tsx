import { useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { s } from '@prism-ui/schema';
import { ComponentContext, cx, defineComponent, registerComponent, useComponentState, useEmit, useFormat, usePart, usePrism, useSlot, type Format, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export type AskValue = string | number | boolean | null;
export interface AskField { id?: string; label?: string; type?: 'text' | 'number' | 'select' | 'date' | 'toggle' | 'textarea'; options?: (string | { value: string; label: string })[]; value?: AskValue; required?: boolean; hint?: string; placeholder?: string; min?: number; max?: number; step?: number; unit?: string }
const defaults = { title: 'Details', send: 'Send', edit: 'Edit', suggested: 'Suggested', required: 'Required', minimum: 'Enter at least {min}', maximum: 'Enter no more than {max}', stepMismatch: 'Use steps of {step}', invalidNumber: 'Enter a number', empty: 'Not provided', yes: 'Yes', no: 'No', loading: 'Loading fields', select: 'Select an option' };
export type AskLabels = Partial<typeof defaults>;
export interface AskProps { id?: string; title?: string; submit?: string; sentence?: string; fields?: AskField[]; labels?: AskLabels }
function inlineField(field: AskField) { return !field.type || ['text', 'number', 'select', 'date'].includes(field.type); }
function normalize(field: AskField, value: unknown): AskValue {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'number') { const number = typeof value === 'number' ? value : Number(value); return Number.isFinite(number) ? number : null; }
  if (field.type === 'toggle') return value === true || value === 'true';
  return String(value);
}
function formatted(field: AskField, value: AskValue, format: Format, labels: typeof defaults): string {
  if (value === null) return labels.empty;
  if (field.type === 'number' && typeof value === 'number') return `${format.number(value)}${field.unit ? ` ${field.unit}` : ''}`;
  if (field.type === 'date' && typeof value === 'string') { const date = new Date(value + 'T00:00:00'); if (Number.isFinite(date.getTime())) return format.date(date, { day: 'numeric', month: 'short', year: 'numeric' }); }
  if (field.type === 'toggle') return value ? labels.yes : labels.no;
  if (field.type === 'select') { const option = field.options?.find(option => (typeof option === 'string' ? option : option.value) === value); if (option) return typeof option === 'string' ? option : option.label; }
  return String(value);
}
function sentence(title: unknown, fields: AskField[], values: Record<string, AskValue>, display: (field: AskField, value: AskValue) => string) { return `Here are the details for "${title ?? 'Details'}": ${fields.filter(field => field.id).map(field => `${field.label ?? field.id}: ${display(field, values[field.id!] ?? null)}`).join(', ')}.`; }
export function useAsk(props: AskProps, ctx: PrismContextValue) {
  const component = useContext(ComponentContext), format = useFormat(), emit = useEmit();
  const fields = useMemo(() => { const seen = new Set<string>(); return (props.fields ?? []).filter(field => !field.id || (!seen.has(field.id) && !!seen.add(field.id))); }, [props.fields]);
  const [values, setValues] = useComponentState<Record<string, AskValue>>('values', {}), [touched, setTouched] = useComponentState<Record<string, boolean>>('touched', {}), [submitted, setSubmitted] = useComponentState('submitted', false);
  const labels = useMemo(() => ({ ...defaults, ...props.labels }), [props.labels]);
  const current = useMemo<Record<string, AskValue>>(() => Object.fromEntries(fields.filter(field => field.id).map(field => [field.id!, normalize(field, Object.hasOwn(values, field.id!) ? values[field.id!] : field.value)])), [fields, values]);
  const inline = fields.every(inlineField);
  const controls = useRef(new Map<string, HTMLElement>());
  const complete = component?.node.complete !== false;
  const errors = useMemo(() => Object.fromEntries(fields.filter(field => field.id).map(field => {
    const value = current[field.id!]; let error = '';
    if (field.required && (value === null || (typeof value === 'string' && !value.trim()))) error = labels.required;
    else if (typeof value === 'number') {
      if (field.min !== undefined && value < field.min) error = labels.minimum.replace('{min}', format.number(field.min));
      if (field.max !== undefined && value > field.max) error = labels.maximum.replace('{max}', format.number(field.max));
      if (!error && field.step !== undefined && Number.isFinite(field.step) && field.step > 0) {
        const increments = (value - (field.min ?? 0)) / field.step;
        if (Math.abs(increments - Math.round(increments)) > 1e-8) error = labels.stepMismatch.replace('{step}', format.number(field.step));
      }
    }
    return [field.id!, error];
  })), [fields, current, labels, format]);
  function change(id: string, value: AskValue) { ctx.store.batch(() => { setValues(old => ({ ...old, [id]: value })); setSubmitted(false); }); }
  function blur(id: string) { setTouched(old => ({ ...old, [id]: true })); }
  function submit() {
    if (!complete || !fields.length || fields.some(field => !field.id || !field.label || !field.type)) return;
    setTouched(Object.fromEntries(fields.map(field => [field.id!, true])));
    const invalid = fields.find(field => errors[field.id!]);
    if (invalid) { controls.current.get(invalid.id!)?.focus(); return; }
    ctx.store.batch(() => { setValues(current); setSubmitted(true); });
    emit('submit', { values: current }, sentence(props.title ?? labels.title, fields, current, (field, value) => formatted(field, value, format, labels)));
  }
  return { fields, inline, values: current, touched, submitted, labels, errors, controls, complete, title: props.title ?? labels.title, submitLabel: props.submit ?? labels.send,
    canSubmit: complete && fields.length > 0 && fields.every(field => field.id && field.label && field.type),
    suggested(field: AskField) { return field.value !== undefined && field.value !== null && !Object.hasOwn(values, field.id ?? ''); },
    loading(index: number) { return !complete && (index === fields.length - 1 || !fields[index]?.type || !fields[index]?.id); },
    change, blur, submit, edit() { setSubmitted(false); },
    display(field: AskField) { return formatted(field, current[field.id ?? ''] ?? null, format, labels); },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const element = event.target as HTMLElement;
      if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      if ((element.tagName === 'TEXTAREA' && (event.ctrlKey || event.metaKey)) || (element.tagName === 'INPUT' && !event.ctrlKey && !event.metaKey)) { event.preventDefault(); submit(); }
    },
  };
}
type Model = ReturnType<typeof useAsk>;
function Box(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Empty({ label }: { label: string }) { const root = usePart('ask', 'empty'), part = usePart('ask', 'skeleton'); return <div {...root} role="status" aria-label={label}><div {...part} /></div>; }
function Field({ field, index, vm, embedded = false }: { field: AskField; index: number; vm: Model; embedded?: boolean }) {
  const ctx = usePrism(), element = useRef<HTMLElement | null>(null), local = useRef<AskValue | undefined>(undefined);
  const [display, setDisplay] = useState<number | null>(null);
  const unique = useId(), id = `ask-${unique}`, errorId = `${id}-error`, hintId = `${id}-hint`;
  const root = usePart('ask', 'field', vm.loading(index) ? 'loading' : undefined), label = usePart('ask', 'label', field.label ? undefined : 'loading'), required = usePart('ask', 'required'), suggested = usePart('ask', 'suggested'), control = usePart('ask', 'control'), hint = usePart('ask', 'hint'), errorPart = usePart('ask', 'error'), skeleton = usePart('ask', 'skeleton'), unit = usePart('ask', 'unit'), wrap = usePart('ask', 'inputWrap'), segments = usePart('ask', 'segments'), segment = usePart('ask', 'segment'), switchPart = usePart('ask', 'switch'), thumb = usePart('ask', 'thumb'), optionPart = usePart('ask', 'option');
  const key = field.id ?? '', value = vm.values[key] ?? null, error = vm.touched[key] ? vm.errors[key] : '';
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current, changed = !Object.is(from, value), user = Object.is(local.current, value);
    previous.current = value; local.current = undefined;
    const node = element.current;
    if (!changed || user || !vm.complete || !ctx.animate || !node?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || node.closest('.prism-root[data-animate="false"]')) { setDisplay(null); return; }
    const fill = getComputedStyle(node).getPropertyValue('--prism-accent-soft').trim() || 'color-mix(in oklab, currentColor 8%, transparent)';
    const animation = node.animate([{ backgroundColor: fill, transform: 'translateY(2px)' }, { backgroundColor: 'transparent', transform: 'translateY(0)' }], { duration: 600, easing: 'ease-out' });
    animation.finished?.catch(() => {});
    let frame = 0;
    if (typeof from === 'number' && typeof value === 'number' && document.activeElement !== node && typeof requestAnimationFrame === 'function') {
      const began = performance.now(), integers = Number.isInteger(from) && Number.isInteger(value);
      setDisplay(from);
      const tick = (now: number) => {
        const progress = Math.min(1, (now - began) / 250), next = from + (value - from) * (1 - (1 - progress) ** 3);
        setDisplay(progress === 1 ? null : integers ? Math.round(next) : Number(next.toFixed(2)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => { animation.cancel(); cancelAnimationFrame(frame); };
  }, [value, vm.complete, ctx.animate]);
  function change(value: AskValue) { local.current = value; setDisplay(null); vm.change(key, value); }
  const width = Math.min(30, Math.max(field.type === 'number' ? 3 : 8, String(value ?? field.placeholder ?? field.label ?? '').length + 1));
  const attrs = { id, title: vm.suggested(field) ? vm.labels.suggested : undefined, 'aria-description': vm.suggested(field) ? vm.labels.suggested : undefined, style: { ...control.style, '--ask-width': `${width}ch` } as CSSProperties, 'aria-required': field.required || undefined, 'aria-invalid': !!error, 'aria-describedby': [field.hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined, 'aria-labelledby': `${id}-label` };
  const options = field.options?.map(option => typeof option === 'string' ? { value: option, label: option } : option) ?? [];
  const smallSelect = !vm.inline && field.type === 'select' && options.length > 0 && options.length <= 4;
  const ref = (node: HTMLElement | null) => { element.current = node; if (node) vm.controls.current.set(key, node); else vm.controls.current.delete(key); };
  const onBlur = () => vm.blur(key);
  let input: ReactNode;
  if (field.type === 'toggle') input = <button {...switchPart} className={cx(switchPart.className, !ctx.unstyled && 'prism-switch')} {...attrs} ref={ref} type="button" role="switch" aria-checked={value === true} data-state={value === true ? 'on' : 'off'} onClick={() => change(value !== true)} onBlur={onBlur}><span {...thumb} /></button>;
  else if (smallSelect) input = <div {...segments} {...attrs} ref={ref} role="radiogroup" tabIndex={-1} onBlur={onBlur}>{options.map((option, optionIndex) => <button {...segment} className={cx(segment.className, !ctx.unstyled && 'prism-chip')} key={option.value} type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value || (value === null && optionIndex === 0) ? 0 : -1} onClick={() => change(option.value)} onKeyDown={event => {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (optionIndex + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (optionIndex + options.length - 1) % options.length;
    if (event.key === 'Home') next = 0; if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); change(options[next].value); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); }
  }}>{option.label}</button>)}</div>;
  else if (field.type === 'select') input = <select {...control} {...attrs} ref={ref} value={String(value ?? '')} onChange={event => change(event.target.value || null)} onBlur={onBlur}><option {...optionPart} value="">{field.placeholder ?? vm.labels.select}</option>{options.map(option => <option {...optionPart} key={option.value} value={option.value}>{option.label}</option>)}</select>;
  else if (field.type === 'textarea') input = <textarea {...control} {...attrs} ref={ref} value={String(value ?? '')} placeholder={field.placeholder} rows={3} onChange={event => change(event.target.value || null)} onBlur={onBlur} />;
  else input = <input {...control} {...attrs} ref={ref} type={field.type ?? 'text'} value={display ?? (typeof value === 'boolean' ? String(value) : value ?? '')} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} onChange={event => change(normalize(field, event.target.value))} onBlur={onBlur} />;
  const inline = inlineField(field), Root = inline ? 'span' : 'div', Wrap = inline ? 'span' : 'div', Text = inline ? 'span' : 'div';
  return <Root {...root} style={{ ...root.style, '--ask-index': index, '--ask-width': `${field.type ? width : 4}ch` } as CSSProperties} aria-hidden={vm.loading(index) || undefined} inert={vm.loading(index) || undefined} data-embedded={embedded || undefined} data-type={field.type} data-wide={field.type === 'text' || field.type === 'textarea' || undefined}>
    <label {...label} id={`${id}-label`} htmlFor={id}>{field.label ?? <span aria-hidden="true">&nbsp;</span>}{field.required && <span {...required} aria-hidden="true" />}{vm.suggested(field) && <span {...suggested} aria-hidden="true">{vm.labels.suggested}</span>}</label>
    {(field.type || inline) && <Wrap {...wrap}>{input}{field.unit && <span {...unit}>{field.unit}</span>}{vm.loading(index) && <span {...skeleton} aria-hidden="true" />}</Wrap>}
    {field.hint && <Text {...hint} id={hintId}>{field.hint}</Text>}{error && <Text {...errorPart} id={errorId} role="alert">{error}</Text>}
  </Root>;
}
export function Ask({ props }: PrismComponentProps<AskProps>) {
  const ctx = usePrism(), vm = useAsk(props, ctx);
  const form = usePart('ask', 'form'), grid = usePart('ask', 'fields'), actions = usePart('ask', 'actions'), primary = usePart('ask', 'submit'), edit = usePart('ask', 'edit'), summary = usePart('ask', 'summary'), row = usePart('ask', 'summaryRow'), label = usePart('ask', 'summaryLabel'), value = usePart('ask', 'summaryValue');
  const Item = useSlot('ask', 'field', Field), EmptyState = useSlot('ask', 'empty', Empty), Actions = useSlot('ask', 'actions', Box), Summary = useSlot('ask', 'summary', Box);
  const flow = usePart('ask', 'sentence'), longFields = usePart('ask', 'longFields'), separator = usePart('ask', 'separator');
  const short = vm.fields.filter(inlineField), long = vm.fields.filter(field => !inlineField(field));
  const parts = props.sentence?.split(/(\{[^{}]+\})/g);
  const ids = parts?.filter(part => /^\{[^{}]+\}$/.test(part)).map(part => part.slice(1, -1)) ?? [];
  const templated = !!parts && new Set(ids).size === ids.length && ids.every(id => { const field = vm.fields.find(field => field.id === id); return field ? inlineField(field) : !vm.complete; });
  const renderField = (field: AskField, index: number, embedded = false) => <Item key={field.id ?? index} field={field} index={index} vm={vm} embedded={embedded} />;
  const sent = vm.fields.filter(field => vm.values[field.id ?? ''] !== null).slice(0, 2).map(field => vm.display(field)).join(', ');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const root = formRef.current?.closest('[data-prism="ask"][data-part="root"]');
    root?.querySelectorAll<HTMLButtonElement>('[data-part="ask"], [data-part="undo"]').forEach(button => button.classList.toggle('prism-icon-btn', !ctx.unstyled));
  }, [ctx.unstyled]);
  return <ComponentFrame component="ask" title={vm.title} state={vm.submitted ? 'sent' : 'editing'} ask undo>
    <form {...form} ref={formRef} data-layout="sentence" noValidate onKeyDown={vm.onKeyDown} onSubmit={event => { event.preventDefault(); vm.submit(); }}>
      <div {...grid}>{(short.length > 0 || templated) && <div {...flow}>{templated && parts!.map((part, index) => {
        const id = /^\{([^{}]+)\}$/.exec(part)?.[1];
        if (!id) return part;
        const fieldIndex = vm.fields.findIndex(field => field.id === id);
        return <span key={index}>{renderField(vm.fields[fieldIndex] ?? { id, label: id }, fieldIndex, true)}</span>;
      })}{short.filter(field => !templated || !ids.includes(field.id ?? '')).map((field, index) => <span key={field.id ?? vm.fields.indexOf(field)}>{(templated || index > 0) && <span {...separator} aria-hidden="true"> · </span>}{renderField(field, vm.fields.indexOf(field))}</span>)}</div>}
      {long.length > 0 && <div {...longFields}>{long.map(field => renderField(field, vm.fields.indexOf(field)))}</div>}
      {!vm.fields.length && !templated && <EmptyState label={vm.labels.loading} />}</div>
      <Actions {...actions}><button {...primary} className={cx(primary.className, !ctx.unstyled && 'prism-pill')} type="submit" aria-label={vm.submitLabel} data-sent={vm.submitted || undefined} disabled={!vm.canSubmit}>{vm.submitted ? <><svg className={ctx.unstyled ? undefined : 'prism-check'} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7" pathLength="1" /></svg><span>Sent{sent && ` · ${sent}`}</span></> : vm.submitLabel}</button>
      {vm.submitted && <button {...edit} type="button" onClick={vm.edit}>{vm.labels.edit}</button>}</Actions>
      {vm.submitted && <Summary {...summary} aria-live="polite">{vm.fields.map((field, index) => <div {...row} key={field.id ?? index}><span {...label}>{field.label}</span><span {...value}>{vm.display(field)}</span></div>)}</Summary>}
    </form>
  </ComponentFrame>;
}
const optionSchema = s.union(s.string().describe('Option value and label').example('Indoor'), s.object({ value: s.string().describe('Submitted value').example('outdoor'), label: s.string().describe('Visible option label').example('Outdoor') }).describe('Option with distinct label').example({ value: 'outdoor', label: 'Outdoor' }));
const fieldSchema = s.object({
  id: s.string().describe('Unique field identifier').example('party'),
  label: s.string().describe('Visible field label').example('Party size'),
  type: s.enum(['text', 'number', 'select', 'date', 'toggle', 'textarea']).describe('Input control type').example('number'),
  options: s.array(optionSchema).optional().describe('Select options; at most four render as segments').example(['Indoor', 'Outdoor']),
  value: s.any().optional().describe('Suggested string, number, boolean or null; can bind via $ref').example(4),
  required: s.boolean().optional().describe('Require a nonempty answer').example(true),
  hint: s.string().optional().describe('Supporting field hint').example('Include children'),
  placeholder: s.string().optional().describe('Empty input placeholder').example('e.g. 4'),
  min: s.number().optional().describe('Minimum numeric value').example(1),
  max: s.number().optional().describe('Maximum numeric value').example(20),
  step: s.number().optional().describe('Numeric increment').example(1),
  unit: s.string().optional().describe('Visible suffix for the input and summary').example('guests'),
});
const labelsSchema = s.object(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, s.string().optional().describe(`Override ${key} text; keep any {min} or {max} placeholder`).example(value)]))).optional().describe('Translated interface labels and validation messages').example(defaults);
export const askDefinition = defineComponent({ name: 'ask', schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('reservation'),
  title: s.string().optional().describe('Form title').example('Book a table'),
  sentence: s.string().optional().describe('Natural sentence with {fieldId} blanks for text, number, select or date fields; textareas render below').example('A table for {party} people.'),
  submit: s.string().optional().describe('Primary submit label').example('Book table'),
  fields: s.array(fieldSchema).describe('Only the missing details needed from the user').example([{ id: 'party', label: 'Party size', type: 'number', value: 4, required: true, min: 1, max: 20, step: 1, options: undefined, hint: undefined, placeholder: undefined, unit: undefined }]),
  labels: labelsSchema,
}), component: Ask, syntax: 'fence', docs: 'Missing details embedded in prose. Text, number, select and date fields always flow inline, with sentence {fieldId} blanks or label/value pairs. Textareas and switches render below. Suggested values are editable. Submit emits every field id, with null for empty answers; fields stay editable in the sent state. Enter submits single-line inputs; Control/Command+Enter submits textareas.', examples: ['```ui:ask\n{"id":"reservation","title":"Book a table","submit":"Book table","fields":[{"id":"party","label":"Party size","type":"number","value":4,"required":true,"min":1},{"id":"date","label":"Date","type":"date"},{"id":"notes","label":"Notes","type":"textarea","placeholder":"Any preferences?"}]}\n```'],
  message(action) { if (action.type !== 'submit') return 'Tell me more about these details…'; const payload = action.payload as { values: Record<string, AskValue> }; return sentence(action.context.props.title, action.context.props.fields as AskField[] ?? [], payload.values, (_field, value) => value === null ? defaults.empty : String(value)); },
});
registerComponent(askDefinition);
