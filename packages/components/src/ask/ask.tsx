import { componentStrings } from '../strings';
import { useContext, useId, useMemo, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { s } from '@prism-ui/schema';
import { useStrings, PrismPart, ComponentContext, defineComponent, registerComponent, useComponentState, useEmit, useFormat, usePart, usePrism, useSlot, type Format, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export type AskValue = string | number | boolean | null;
export interface AskField { id?: string; label?: string; type?: 'text' | 'number' | 'select' | 'date' | 'toggle' | 'textarea'; options?: (string | { value: string; label: string })[]; value?: AskValue; required?: boolean; hint?: string; placeholder?: string; min?: number; max?: number; step?: number; unit?: string }
const defaults = { title: 'Details', send: 'Send', edit: 'Edit', suggested: 'Suggested', required: 'Required', minimum: 'Enter at least {min}', maximum: 'Enter no more than {max}', stepMismatch: 'Use steps of {step}', invalidNumber: 'Enter a number', empty: 'Not provided', yes: 'Yes', no: 'No', loading: 'Loading fields', select: 'Select an option' };
export type AskLabels = Partial<typeof defaults>;
export interface AskProps { id?: string; title?: string; submit?: string; fields?: AskField[]; labels?: AskLabels }
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
  const strings = useStrings('ask'), labels = { ...defaults, ...props.labels, ...strings };
  const current = useMemo<Record<string, AskValue>>(() => Object.fromEntries(fields.filter(field => field.id).map(field => [field.id!, normalize(field, Object.hasOwn(values, field.id!) ? values[field.id!] : field.value)])), [fields, values]);
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
  function change(id: string, value: AskValue) { setValues(old => ({ ...old, [id]: value })); }
  function blur(id: string) { setTouched(old => ({ ...old, [id]: true })); }
  function submit() {
    if (!complete || !fields.length || fields.some(field => !field.id || !field.label || !field.type)) return;
    setTouched(Object.fromEntries(fields.map(field => [field.id!, true])));
    const invalid = fields.find(field => errors[field.id!]);
    if (invalid) { controls.current.get(invalid.id!)?.focus(); return; }
    ctx.store.batch(() => { setValues(current); setSubmitted(true); });
    emit('submit', { values: current }, sentence(props.title ?? labels.title, fields, current, (field, value) => formatted(field, value, format, labels)));
  }
  return { fields, values: current, touched, submitted, labels, errors, controls, complete, title: labels.title, submitLabel: strings.submit ?? labels.send,
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
function Box(props: HTMLAttributes<HTMLDivElement>) { return <PrismPart as="div" {...props} />; }
function Empty({ label }: { label: string }) { const root = usePart('ask', 'empty'), part = usePart('ask', 'skeleton'); return <PrismPart as="div" {...root} role="status" aria-label={label}><PrismPart as="div" {...part} /></PrismPart>; }
function Field({ field, index, vm }: { field: AskField; index: number; vm: Model }) {
  const themeStrings = useStrings('ask', componentStrings.ask);
  const unique = useId(), id = `ask-${unique}`, errorId = `${id}-error`, hintId = `${id}-hint`;
  const root = usePart('ask', 'field', vm.loading(index) ? 'loading' : undefined), label = usePart('ask', 'label', field.label ? undefined : 'loading'), required = usePart('ask', 'required'), suggested = usePart('ask', 'suggested'), control = usePart('ask', 'control'), hint = usePart('ask', 'hint'), errorPart = usePart('ask', 'error'), skeleton = usePart('ask', 'skeleton'), unit = usePart('ask', 'unit'), wrap = usePart('ask', 'inputWrap'), segments = usePart('ask', 'segments'), segment = usePart('ask', 'segment'), switchPart = usePart('ask', 'switch'), thumb = usePart('ask', 'thumb'), optionPart = usePart('ask', 'option');
  const key = field.id ?? '', value = vm.values[key] ?? null, error = vm.touched[key] ? vm.errors[key] : '';
  const attrs = { id, 'aria-required': field.required || undefined, 'aria-invalid': !!error, 'aria-describedby': [field.hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined, 'aria-labelledby': `${id}-label` };
  const options = field.options?.map(option => typeof option === 'string' ? { value: option, label: option } : option) ?? [];
  const smallSelect = field.type === 'select' && options.length > 0 && options.length <= 4;
  const ref = (element: HTMLElement | null) => { if (element) vm.controls.current.set(key, element); else vm.controls.current.delete(key); };
  const onBlur = () => vm.blur(key);
  let input: ReactNode;
  if (vm.loading(index)) input = <PrismPart as="div" {...skeleton} aria-hidden="true" />;
  else if (field.type === 'toggle') input = <PrismPart as="button" {...switchPart} {...attrs} ref={ref} type="button" role="switch" aria-checked={value === true} data-state={value === true ? 'on' : 'off'} onClick={() => vm.change(key, value !== true)} onBlur={onBlur}><PrismPart as="span" {...thumb} /></PrismPart>;
  else if (smallSelect) input = <PrismPart as="div" {...segments} {...attrs} ref={ref} role="radiogroup" tabIndex={-1} onBlur={onBlur}>{options.map((option, optionIndex) => <PrismPart as="button" {...segment} key={option.value} type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value || (value === null && optionIndex === 0) ? 0 : -1} onClick={() => vm.change(key, option.value)} onKeyDown={event => {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (optionIndex + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (optionIndex + options.length - 1) % options.length;
    if (event.key === 'Home') next = 0; if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); vm.change(key, options[next].value); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); }
  }}>{option.label}</PrismPart>)}</PrismPart>;
  else if (field.type === 'select') input = <PrismPart as="select" {...control} {...attrs} ref={ref} value={String(value ?? '')} onChange={event => vm.change(key, event.target.value || null)} onBlur={onBlur}><PrismPart as="option" {...optionPart} value="">{field.placeholder ?? vm.labels.select}</PrismPart>{options.map(option => <PrismPart as="option" {...optionPart} key={option.value} value={option.value}>{option.label}</PrismPart>)}</PrismPart>;
  else if (field.type === 'textarea') input = <PrismPart as="textarea" {...control} {...attrs} ref={ref} value={String(value ?? '')} placeholder={field.placeholder} rows={3} onChange={event => vm.change(key, event.target.value || null)} onBlur={onBlur} />;
  else input = <PrismPart as="input" {...control} {...attrs} ref={ref} type={field.type ?? 'text'} value={typeof value === 'boolean' ? String(value) : value ?? ''} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} onChange={event => vm.change(key, normalize(field, event.target.value))} onBlur={onBlur} />;
  return <PrismPart as="div" {...root} data-type={field.type} data-wide={field.type === 'text' || field.type === 'textarea' || undefined}>
    <PrismPart as="label" {...label} id={`${id}-label`} htmlFor={id}>{field.label ?? <span aria-hidden="true">{themeStrings.nbsp}</span>}{field.required && <PrismPart as="span" {...required} aria-hidden="true"> *</PrismPart>}{vm.suggested(field) && <PrismPart as="span" {...suggested}>{vm.labels.suggested}</PrismPart>}</PrismPart>
    {field.type && <PrismPart as="div" {...wrap}>{input}{field.unit && <PrismPart as="span" {...unit}>{field.unit}</PrismPart>}</PrismPart>}
    {field.hint && <PrismPart as="div" {...hint} id={hintId}>{field.hint}</PrismPart>}{error && <PrismPart as="div" {...errorPart} id={errorId} role="alert">{error}</PrismPart>}
  </PrismPart>;
}
export function Ask({ props }: PrismComponentProps<AskProps>) {
  const vm = useAsk(props, usePrism());
  const form = usePart('ask', 'form'), grid = usePart('ask', 'fields'), actions = usePart('ask', 'actions'), primary = usePart('ask', 'submit'), edit = usePart('ask', 'edit'), summary = usePart('ask', 'summary'), row = usePart('ask', 'summaryRow'), label = usePart('ask', 'summaryLabel'), value = usePart('ask', 'summaryValue');
  const Item = useSlot('ask', 'field', Field), EmptyState = useSlot('ask', 'empty', Empty), Actions = useSlot('ask', 'actions', Box), Summary = useSlot('ask', 'summary', Box);
  return <ComponentFrame component="ask" title={vm.title} state={vm.submitted ? 'submitted' : 'editing'} ask undo>
    {vm.submitted ? <Summary {...summary} aria-live="polite">{vm.fields.map((field, index) => <PrismPart as="div" {...row} key={field.id ?? index}><PrismPart as="span" {...label}>{field.label}</PrismPart><PrismPart as="span" {...value}>{vm.display(field)}</PrismPart></PrismPart>)}<Actions {...actions}><PrismPart as="button" {...edit} type="button" onClick={vm.edit}>{vm.labels.edit}</PrismPart></Actions></Summary> : <PrismPart as="form" {...form} noValidate onKeyDown={vm.onKeyDown} onSubmit={event => { event.preventDefault(); vm.submit(); }}>
      <PrismPart as="div" {...grid}>{vm.fields.length ? vm.fields.map((field, index) => <Item key={field.id ?? index} field={field} index={index} vm={vm} />) : <EmptyState label={vm.labels.loading} />}</PrismPart>
      <Actions {...actions}><PrismPart as="button" {...primary} type="submit" disabled={!vm.canSubmit}>{vm.submitLabel}</PrismPart></Actions>
    </PrismPart>}
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
export const askDefinition = defineComponent({ name: 'ask', parts: ["actions","ask","body","control","edit","empty","error","field","fields","footer","form","header","hint","inputWrap","label","option","required","root","segment","segments","skeleton","submit","suggested","summary","summaryLabel","summaryRow","summaryValue","switch","thumb","title","toolbar","undo","unit"], strings: { ...defaults, ...componentStrings.ask }, schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('reservation'),
  title: s.string().optional().describe('Form title').example('Book a table'),
  submit: s.string().optional().describe('Primary submit label').example('Book table'),
  fields: s.array(fieldSchema).describe('Only the missing details needed from the user').example([{ id: 'party', label: 'Party size', type: 'number', value: 4, required: true, min: 1, max: 20, step: 1, options: undefined, hint: undefined, placeholder: undefined, unit: undefined }]),
  labels: labelsSchema,
}), component: Ask, syntax: 'fence', docs: 'A compact form for missing details. Suggested values are editable. Submit emits every field id, with null for empty answers. Enter submits single-line inputs; Control/Command+Enter submits textareas.', examples: ['```ui:ask\n{"id":"reservation","title":"Book a table","submit":"Book table","fields":[{"id":"party","label":"Party size","type":"number","value":4,"required":true,"min":1},{"id":"date","label":"Date","type":"date"},{"id":"notes","label":"Notes","type":"textarea","placeholder":"Any preferences?"}]}\n```'],
  message(action) { if (action.type !== 'submit') return 'Tell me more about these details…'; const payload = action.payload as { values: Record<string, AskValue> }; return sentence(action.context.props.title, action.context.props.fields as AskField[] ?? [], payload.values, (_field, value) => value === null ? defaults.empty : String(value)); },
});
registerComponent(askDefinition);
