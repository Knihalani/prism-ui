import { Component, type ComponentType, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Schema } from '@prism-ui/schema';
import { useComponentState, useEmit } from './hooks';
import { defineComponent, registerComponent, type ComponentDef, type PrismComponentProps } from './registry';
import type { Tokens } from './theme';

export type PartialData<T> = T extends readonly (infer U)[] ? PartialData<U>[] : T extends object ? { [K in keyof T]?: PartialData<T[K]> } : T;
export interface RendererAction { type: string; payload?: unknown; message?: string }
export interface RendererProps<T = Record<string, unknown>> {
  data: PartialData<T>; id: string; complete: boolean;
  emit(action: RendererAction): void;
  useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  tokens: Tokens;
}
export interface RendererOptions<T> { schema?: Schema<T>; prompt?: string; feedback?: boolean }
export type Renderers = Record<string, ComponentType<any> | ComponentDef>;

const tokenNames = 'bg surface surfaceRaised text textMuted textSubtle border borderStrong accent accentText onAccent positive warning danger info focus fontBody fontDisplay fontMono fontNumeric textXs textSm textBase textLg textXl text2xl text3xl weightRegular weightMedium weightSemibold weightBold radiusSm radiusMd radiusLg radiusPill space1 space2 space3 space4 space5 space6 space7 space8 elevation1 elevation2 elevation3 motionFast motionBase motionSlow motionEase motionSpring motionInstant motionEaseInOut motionEaseExit motionSpringDuration motionSpringBouncy motionSpringBouncyDuration motionStagger motionDistance motionScale motionBlur'.split(' ');
const tokens = Object.fromEntries(tokenNames.map(key => [key, `var(--prism-${key.replace(/[A-Z]|(?<=space|text|elevation)[0-9]/g, c => '-' + c.toLowerCase())})`])) as unknown as Tokens;
function useRendererState<S>(initial: S | (() => S)) { return useComponentState('state', initial); }
const adapters = new WeakMap<ComponentType<any>, ComponentType<PrismComponentProps<any>>>();
export function rendererView(View: ComponentType<any>) {
  let Adapter = adapters.get(View);
  if (!Adapter) {
    Adapter = function Renderer({ props, id, complete }: PrismComponentProps<any>) {
      const emit = useEmit();
      return <View data={props} id={id} complete={complete} emit={(action: RendererAction) => emit(action.type, action.payload, action.message)} useState={useRendererState} tokens={tokens} />;
    };
    adapters.set(View, Adapter);
  }
  return Adapter;
}
export function defineRenderer<T>(name: string, View: ComponentType<RendererProps<T>>, options: RendererOptions<T> = {}): ComponentDef {
  if (!/^[a-zA-Z][\w-]*$/.test(name)) throw Error('Invalid renderer name');
  const def = defineComponent({ name, component: rendererView(View), schema: options.schema, docs: options.prompt, feedback: options.feedback });
  registerComponent(def);
  return def;
}

export class RenderBoundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" data-prism-render-error={this.props.name}>This content couldn’t be displayed.</div> : this.props.children; }
}

export interface FeedbackSurfaceProps { children: ReactNode; targetKey?: string }
let feedbackSurface: ComponentType<FeedbackSurfaceProps> | undefined;
export function registerFeedbackSurface(surface: ComponentType<FeedbackSurfaceProps>) { feedbackSurface = surface; }
export function FeedbackSurface({ children, targetKey }: FeedbackSurfaceProps) {
  const Surface = feedbackSurface;
  return Surface ? <Surface targetKey={targetKey}>{children}</Surface> : <>{children}</>;
}
