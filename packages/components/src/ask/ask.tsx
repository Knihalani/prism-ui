import { createElement, useId, type ElementType, type ReactNode } from 'react';
import { s } from '@prism-ui/schema';
import { Icon, PrismPart, defineComponent, registerComponent, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { type FramePart } from '../frame';
import { askStrings as defaults, askMessage, normalize, safeFields, useAsk, type AskProps, type AskField, type AskModel } from './use-ask';
export { useAsk } from './use-ask';
export type { AskProps, AskField, AskLabels, AskValue, AskModel } from './use-ask';

function Empty({ ask }: { ask: AskModel }) { const root = usePart('ask', 'empty'), part = usePart('ask', 'skeleton'); return <PrismPart as="div" {...root} slotProps={{ ask }} role="status" aria-label={ask.strings.loading}><PrismPart as="span" {...part} slotProps={{ ask }} data-prism-skeleton="" /></PrismPart>; }
function Field({ field, index, vm, inline = false }: { field: AskField; index: number; vm: AskModel; inline?: boolean }) {
  const model = { field, index, ask: vm, vm };
  const themeStrings = vm.strings;
  const unique = useId(), id = `ask-${unique}`, errorId = `${id}-error`, hintId = `${id}-hint`;
  const root = usePart('ask', 'field', vm.loading(index) ? 'loading' : undefined), label = usePart('ask', 'label', field.label ? undefined : 'loading'), required = usePart('ask', 'required'), suggested = usePart('ask', 'suggested'), control = usePart('ask', 'control'), hint = usePart('ask', 'hint'), errorPart = usePart('ask', 'error'), skeleton = usePart('ask', 'skeleton'), unit = usePart('ask', 'unit'), wrap = usePart('ask', 'inputWrap'), segments = usePart('ask', 'segments'), segment = usePart('ask', 'segment'), switchPart = usePart('ask', 'switch'), thumb = usePart('ask', 'thumb'), optionPart = usePart('ask', 'option');
  const placeholder = usePart('ask', 'placeholder');
  const key = field.id ?? '', value = vm.values[key] ?? null, error = vm.touched[key] ? vm.errors[key] : '';
  const attrs = { id, 'aria-required': field.required || undefined, 'aria-invalid': !!error, 'aria-describedby': [field.hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined, 'aria-labelledby': `${id}-label` };
  const options = field.options?.filter(option => !!option).map(option => typeof option === 'string' ? { value: option, label: option } : option) ?? [];
  const smallSelect = field.type === 'select' && options.length > 0 && options.length <= 4;
  const ref = (element: HTMLElement | null) => { if (element) vm.controls.current.set(key, element); else vm.controls.current.delete(key); };
  const onBlur = () => vm.blur(key);
  let input: ReactNode;
  if (vm.loading(index)) input = <PrismPart slotProps={model} as="span" {...skeleton} data-prism-skeleton="" aria-hidden="true" />;
  else if (field.type === 'toggle') input = <PrismPart slotProps={model} as="button" {...switchPart} {...attrs} ref={ref} type="button" role="switch" aria-checked={value === true} data-state={value === true ? 'on' : 'off'} onClick={() => vm.change(key, value !== true)} onBlur={onBlur}><PrismPart slotProps={model} as="span" {...thumb} /></PrismPart>;
  else if (smallSelect) input = <PrismPart slotProps={model} as="span" {...segments} {...attrs} ref={ref} role="radiogroup" tabIndex={-1} onBlur={onBlur}>{options.map((option, optionIndex) => <PrismPart slotProps={model} as="button" {...segment} key={option.value} type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value || (value === null && optionIndex === 0) ? 0 : -1} onClick={() => vm.change(key, option.value)} onKeyDown={event => {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (optionIndex + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (optionIndex + options.length - 1) % options.length;
    if (event.key === 'Home') next = 0; if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); vm.change(key, options[next].value); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); }
  }}>{option.label}</PrismPart>)}</PrismPart>;
  else if (field.type === 'select') input = <PrismPart slotProps={model} as="select" {...control} {...attrs} ref={ref} value={String(value ?? '')} onChange={event => vm.change(key, event.target.value || null)} onBlur={onBlur}><PrismPart slotProps={model} as="option" {...optionPart} value="">{field.placeholder ?? vm.labels.select}</PrismPart>{options.map(option => <PrismPart slotProps={model} as="option" {...optionPart} key={option.value} value={option.value}>{option.label}</PrismPart>)}</PrismPart>;
  else if (field.type === 'textarea') input = <PrismPart slotProps={model} as="textarea" {...control} {...attrs} ref={ref} value={String(value ?? '')} placeholder={field.placeholder} rows={3} onChange={event => vm.change(key, event.target.value || null)} onBlur={onBlur} />;
  else input = <PrismPart slotProps={model} as="input" {...control} {...attrs} ref={ref} type={field.type ?? 'text'} value={typeof value === 'boolean' ? String(value) : value ?? ''} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} onChange={event => vm.change(key, normalize(field, event.target.value))} onBlur={onBlur} />;
  return <PrismPart slotProps={model} as={inline ? "span" : "div"} {...root} data-inline={inline || undefined} data-suggested={vm.suggested(field) || undefined} data-type={field.type} data-wide={field.type === 'text' || field.type === 'textarea' || undefined}>
    <PrismPart slotProps={model} as="label" {...label} id={`${id}-label`} htmlFor={id} data-prism-skeleton={!field.label ? '' : undefined}>{field.label ?? <PrismPart as="span" {...placeholder} slotProps={model} aria-hidden="true">{themeStrings.nbsp}</PrismPart>}{field.required && <PrismPart slotProps={model} as="span" {...required} aria-hidden="true">{vm.strings.requiredMark}</PrismPart>}{vm.suggested(field) && <PrismPart slotProps={model} as="span" {...suggested}>{vm.labels.suggested}</PrismPart>}</PrismPart>
    {field.type && <PrismPart slotProps={model} as="span" {...wrap}>{input}{field.unit && <PrismPart slotProps={model} as="span" {...unit}>{field.unit}</PrismPart>}</PrismPart>}
    {field.hint && <PrismPart slotProps={model} as="span" {...hint} id={hintId}>{field.hint}</PrismPart>}{error && <PrismPart slotProps={model} as="span" {...errorPart} id={errorId} role="alert">{error}</PrismPart>}
  </PrismPart>;
}
function AskFramePart({ part, ask, as = 'div', ...props }: { part: FramePart; ask: AskModel; as?: ElementType; [key: string]: any }) {
  const Frame = useSlot('frame', part, undefined as any), Own = useSlot('ask', part, undefined as any);
  if (Own) return createElement(Own, { ...props, as, ask });
  if (Frame) return createElement(Frame, { ...props, as });
  return <PrismPart as={as} {...props} slotProps={{ ask }} />;
}
function AskIcon({ name, ask }: { name: 'check' | 'send' | 'undo' | 'ask'; ask: AskModel }) { return <PrismPart as={Icon} {...usePart('ask', 'icon')} name={name} slotProps={{ ask }} />; }
function AskActions({ ask }: { ask: AskModel }) {
  const actions = usePart('ask', 'actions'), primary = usePart('ask', 'submit'), edit = usePart('ask', 'edit');
  return <AskFramePart part="footer" as="footer" ask={ask} {...ask.frame.parts.footer}><PrismPart as="div" {...actions} slotProps={{ ask }}>
    {ask.submitted && <PrismPart as="button" {...edit} slotProps={{ ask }} type="button" onClick={ask.edit}>{ask.strings.edit}</PrismPart>}
    <PrismPart as="button" {...primary} slotProps={{ ask }} type={ask.submitted ? 'button' : 'submit'} disabled={ask.submitted || !ask.canSubmit} data-sent={ask.submitted || undefined}><AskIcon name={ask.submitted ? 'check' : 'send'} ask={ask} />{ask.submitted ? ask.strings.sentLabel : ask.submitLabel}</PrismPart>
  </PrismPart></AskFramePart>;
}
export function Ask({ props }: PrismComponentProps<AskProps>) {
  const ask = useAsk(props, usePrism()), { frame } = ask, model = { ask };
  const form = usePart('ask', 'form'), grid = usePart('ask', 'fields'), summary = usePart('ask', 'summary'), row = usePart('ask', 'summaryRow'), label = usePart('ask', 'summaryLabel'), value = usePart('ask', 'summaryValue');
  const sentence = usePart('ask', 'sentence'), chunk = usePart('ask', 'sentence-chunk'), text = usePart('ask', 'sentence-text'), punctuation = usePart('ask', 'sentence-punctuation');
  const renderField = (field: AskField, inline = false) => <Field key={field.id ?? ask.fields.indexOf(field)} field={field} index={ask.fields.indexOf(field)} vm={ask} inline={inline} />;
  const remaining = ask.sentence?.remaining ?? ask.fields;
  return <AskFramePart part="root" as="section" ask={ask} {...frame.rootProps} data-status={ask.submitted ? 'submitted' : 'editing'} data-prism-flash={ask.flashing ? '' : undefined}>
    <AskFramePart part="header" as="header" ask={ask} {...frame.parts.header}>
      <AskFramePart part="title" as="h3" ask={ask} {...frame.parts.title}>{ask.title}</AskFramePart>
      <AskFramePart part="toolbar" ask={ask} {...frame.parts.toolbar}>
        <AskFramePart part="undo" as="button" ask={ask} {...frame.parts.undo} type="button" disabled={!frame.canUndo} onClick={frame.onUndo} aria-label={ask.strings.undoLabel} title={ask.strings.undoLabel} aria-keyshortcuts="Control+Z Meta+Z"><AskIcon name="undo" ask={ask} /></AskFramePart>
        <AskFramePart part="ask" as="button" ask={ask} {...frame.parts.ask} type="button" onClick={ask.onAsk} aria-label={ask.strings.askLabel} title={ask.strings.askLabel}><AskIcon name="ask" ask={ask} /></AskFramePart>
      </AskFramePart>
    </AskFramePart>
    <AskFramePart part="body" ask={ask} {...frame.parts.body}>
      {ask.submitted ? <PrismPart as="div" {...summary} slotProps={model} aria-live="polite">{ask.receiptFields.map((field, index) => <PrismPart as="div" {...row} slotProps={{ ask, field }} key={field.id ?? index}><PrismPart as="span" {...label} slotProps={{ ask, field }}>{field.label}</PrismPart><PrismPart as="span" {...value} slotProps={{ ask, field }}>{ask.display(field)}</PrismPart></PrismPart>)}<AskActions ask={ask} /></PrismPart> :
      <PrismPart as="form" {...form} slotProps={model} noValidate onKeyDown={ask.onKeyDown} onSubmit={event => { event.preventDefault(); ask.submit(); }}>
        {ask.sentence && <PrismPart as="div" {...sentence} slotProps={model}>{ask.sentence.chunks.map((item, index) => <PrismPart as="span" {...text} slotProps={{ ask, field: item.field }} key={index}>{item.text}<PrismPart as="span" {...chunk} slotProps={{ ask, field: item.field }}>{item.lead && <PrismPart as="span" {...text} slotProps={{ ask, field: item.field }}>{item.lead}</PrismPart>}{renderField(item.field, true)}{item.punctuation && <PrismPart as="span" {...punctuation} slotProps={{ ask, field: item.field }}>{item.punctuation}</PrismPart>}</PrismPart></PrismPart>)}{ask.sentence.tail && <PrismPart as="span" {...text} slotProps={model}>{ask.sentence.tail}</PrismPart>}</PrismPart>}
        <PrismPart as="div" {...grid} slotProps={model}>{remaining.length ? remaining.map(field => renderField(field)) : !ask.fields.length ? <Empty ask={ask} /> : null}</PrismPart>
        <AskActions ask={ask} />
      </PrismPart>}
    </AskFramePart>
  </AskFramePart>;
}
export type AskPart = 'actions' | 'ask' | 'body' | 'control' | 'edit' | 'empty' | 'error' | 'field' | 'fields' | 'footer' | 'form' | 'header' | 'hint' | 'inputWrap' | 'label' | 'option' | 'required' | 'root' | 'segment' | 'segments' | 'skeleton' | 'submit' | 'suggested' | 'summary' | 'summaryLabel' | 'summaryRow' | 'summaryValue' | 'switch' | 'thumb' | 'title' | 'toolbar' | 'undo' | 'unit' | 'placeholder' | 'icon' | 'sentence' | 'sentence-chunk' | 'sentence-text' | 'sentence-punctuation';
type FieldPart = 'field' | 'control' | 'label' | 'required' | 'suggested' | 'inputWrap' | 'unit' | 'hint' | 'error' | 'segments' | 'segment' | 'switch' | 'thumb' | 'option' | 'placeholder';
export type AskSlotProps = { [Part in AskPart]: { ask: AskModel; field?: AskField } }
  & { [Part in FieldPart]: { ask: AskModel; field: AskField; index: number; vm: AskModel } }
  & { [Part in 'summaryRow' | 'summaryLabel' | 'summaryValue' | 'sentence-chunk' | 'sentence-punctuation']: { ask: AskModel; field: AskField } };
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
export const askDefinition = defineComponent({ name: 'ask', parts: ["actions","ask","body","control","edit","empty","error","field","fields","footer","form","header","hint","inputWrap","label","option","required","root","segment","segments","skeleton","submit","suggested","summary","summaryLabel","summaryRow","summaryValue","switch","thumb","title","toolbar","undo","unit","placeholder","icon","sentence","sentence-chunk","sentence-text","sentence-punctuation"], strings: defaults, schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('reservation'),
  title: s.string().optional().describe('Form title').example('Book a table'),
  submit: s.string().optional().describe('Primary submit label').example('Book table'),
  sentence: s.string().optional().describe('Optional mad-libs template with {fieldId} blanks; unreferenced fields appear below. Unknown, duplicate or textarea blanks fall back to the form. Use field units for attached suffixes.').example('Book for {party} on {date}.'),
  fields: s.array(fieldSchema).describe('Only the missing details needed from the user').example([{ id: 'party', label: 'Party size', type: 'number', value: 4, required: true, min: 1, max: 20, step: 1, options: undefined, hint: undefined, placeholder: undefined, unit: undefined }]),
  labels: labelsSchema,
}), component: Ask, syntax: 'fence', docs: 'A compact form for missing details. Suggested values are editable. Submit emits every field id, with null for empty answers. Enter submits single-line inputs; Control/Command+Enter submits textareas.', examples: ['```ui:ask\n{"id":"reservation","title":"Book a table","submit":"Book table","fields":[{"id":"party","label":"Party size","type":"number","value":4,"required":true,"min":1},{"id":"date","label":"Date","type":"date"},{"id":"notes","label":"Notes","type":"textarea","placeholder":"Any preferences?"}]}\n```'],
  message(action) { if (action.type !== 'submit') return defaults.askMessage; const payload = action.payload as { values?: Record<string, unknown> }; return askMessage(action.context.props.title, safeFields(action.context.props.fields), payload?.values ?? {}, (_field, value) => value === null ? defaults.empty : String(value), defaults); },
});
registerComponent(askDefinition);
