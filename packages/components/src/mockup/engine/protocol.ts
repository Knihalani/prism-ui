export interface Box { x: number; y: number; w: number; h: number }
export interface HitRect { x: number; y: number; w?: number; h?: number }
export interface Anchor { key: string; selector: string; text?: string }
export interface MockupConfig {
  mode?: 'html' | 'svg' | 'wire';
  theme?: Record<string, string>;
  interactive?: boolean;
}
export interface HitTarget { selector: string; text: string; html: string; box: Box }
export interface HitResult { target: HitTarget | null; box: Box }
export interface Envelope { ns: 'prism-mockup'; v: 1; id: string }
export type HostMessage = Envelope & (
  | { type: 'render'; html: string; done?: boolean }
  | ({ type: 'hit'; req: number } & HitRect)
  | { type: 'anchors'; anchors: Anchor[] }
  | ({ type: 'config' } & MockupConfig)
);
export type FrameMessage = Envelope & (
  | { type: 'ready' }
  | { type: 'size'; width: number; height: number }
  | ({ type: 'hit'; req: number } & HitResult)
  | { type: 'layout'; anchors: { key: string; box: Box | null }[] }
  | { type: 'error'; message: string }
);
export type MessagePayload<M> = M extends Envelope ? Omit<M, keyof Envelope> : never;
export type HostPayload = MessagePayload<HostMessage>;
export type FramePayload = MessagePayload<FrameMessage>;
