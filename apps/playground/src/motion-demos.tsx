import { defineRenderer, type RendererProps } from '@prism-ui/react';
import { demos, type Demo } from './catalogue';

function FeedbackPreview({ data }: RendererProps<{ title: string; metrics: { label: string; value: number }[] }>) {
  return <figure data-prism-enter="" style={{ margin: 0, padding: 'var(--prism-space-5)', border: '1px solid var(--prism-border)', borderRadius: 'var(--prism-radius-md)', background: 'var(--prism-surface)' }}>
    <figcaption style={{ fontWeight: 'var(--prism-weight-semibold)' }}>{data.title || 'Team activity'}</figcaption>
    <p style={{ color: 'var(--prism-text-muted)' }}>A responsive renderer. Mark a pin or drag a region to leave feedback.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 'var(--prism-space-4)' }}>
      {(Array.isArray(data.metrics) ? data.metrics : []).map((metric, index) => metric && <div key={index} data-prism-enter="" style={{ '--prism-motion-index': index } as import('react').CSSProperties}>
        <span style={{ color: 'var(--prism-text-muted)' }}>{metric.label || 'Metric'}</span>
        <strong style={{ display: 'block', fontSize: 'var(--prism-text-2xl)' }}>{metric.value ?? '—'}</strong>
        <svg viewBox="0 0 180 64" width="100%" height="64" aria-label="Activity trend"><path d="M0 56 30 42 60 46 90 20 120 30 150 12 180 4" fill="none" stroke="var(--prism-accent-text)" strokeWidth="3" /></svg>
      </div>)}
    </div>
  </figure>;
}

export const motionRenderers = { 'motion-feedback': defineRenderer('motion-feedback', FeedbackPreview, { feedback: true }) };
export const motionDemos: Demo[] = [...demos, {
  id: 'feedback', label: 'Adaptive renderer · graphic feedback', group: 'Create', prompt: 'Review team activity',
  source: '```ui:motion-feedback\n' + JSON.stringify({ id: '__SCOPE__-feedback', title: 'A little more momentum', metrics: [{ label: 'Projects shipped', value: 12 }, { label: 'Focus hours', value: 86 }, { label: 'Open decisions', value: 4 }] }) + '\n```',
  components: ['motion-feedback'], keywords: ['adaptive', 'renderer', 'feedback'],
}];
