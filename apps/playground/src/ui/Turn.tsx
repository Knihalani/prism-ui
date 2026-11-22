import { Children, Component, cloneElement, isValidElement, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Prism, useComponentState, type Action } from '@prism-ui/react';
import type { Store } from '@prism-ui/state';
import { playgroundPlugins } from '../plugins';
import { Icon } from './Icon';

export function plainProse(source: string) {
  return source.replace(/```[\s\S]*?(?:```|$)/g, '').replace(/^\s*:{2,}[^\n]*$/gm, '').replace(/:[a-z]+\[([^\]]*)\]\{[^}]*\}/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_#>`]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
class MessageBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <p className="turn-error" role="alert">This part couldn’t render. Try regenerating the reply.</p> : this.props.children; }
}
function EstimateActions({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [sent] = useComponentState('sent', false);
  return <div {...props} data-state={sent ? 'sent' : 'ready'}>{Children.map(children, child => isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child) && child.type === 'button' ? cloneElement(child, { disabled: child.props.disabled || sent, 'aria-label': sent ? 'Estimate saved' : child.props['aria-label'] }, sent ? 'Estimate saved' : child.props.children) : child)}</div>;
}
const slots = { estimate: { actions: EstimateActions } };
export function AssistantTurn({ text, streaming, error, store, theme, animate, onAction, regenerate, last, continued }: { text: string; streaming: boolean; error?: string; store: Store; theme: 'light' | 'dark'; animate: boolean; onAction(action: Action): void; regenerate?: () => void; last: boolean; continued?: boolean }) {
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(false);
  return <article className={'assistant-turn' + (last ? ' last-turn' : '')} data-message="assistant" data-state={streaming ? 'streaming' : 'ready'} aria-label="Assistant reply" aria-busy={streaming}>
    <MessageBoundary>
      {!text && streaming ? <div className="thinking" aria-label="Thinking"><span>Thinking</span></div> : <div className="reply-content">
        <Prism source={text} done={!streaming} store={store} plugins={playgroundPlugins} mode={theme} animate={animate} onAction={onAction} slots={slots} />
      </div>}
    </MessageBoundary>
    {error && <p className="turn-error" role="alert">{error}</p>}
    {!streaming && !continued && <div className="turn-actions" aria-label="Reply actions"><button className="icon-btn" title={copied ? 'Copied' : 'Copy reply'} aria-label={copied ? 'Copied' : 'Copy reply'} onClick={async () => {
      try { await navigator.clipboard.writeText(plainProse(text)); setCopied(true); setCopyError(false); }
      catch { setCopyError(true); }
    }}><Icon name={copied ? 'check' : 'copy'} /></button>{regenerate && <button className="icon-btn" title="Regenerate reply" aria-label="Regenerate reply" onClick={regenerate}><Icon name="refresh" /></button>}{copyError && <span role="status">Copy unavailable in this browser.</span>}</div>}
  </article>;
}
