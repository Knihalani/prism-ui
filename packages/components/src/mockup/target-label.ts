import type { FeedbackItem } from './engine';
import type { MockupLabels } from './use-mockup';

const tags = {
  rect: 'targetShape', path: 'targetShape', circle: 'targetShape', ellipse: 'targetShape', polygon: 'targetShape', polyline: 'targetShape', line: 'targetShape',
  svg: 'targetGraphic', img: 'targetImage', image: 'targetImage', button: 'targetButton', a: 'targetLink', input: 'targetField', select: 'targetField', textarea: 'targetField',
  h1: 'targetHeading', h2: 'targetHeading', h3: 'targetHeading', h4: 'targetHeading', h5: 'targetHeading', h6: 'targetHeading',
} as const;
export function targetLabel(target: FeedbackItem['target'], labels: MockupLabels) {
  const text = target?.text?.replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 80);
  const tag = target?.html?.match(/^<\s*([\w-]+)/)?.[1].toLowerCase();
  const key = tag && Object.hasOwn(tags, tag) ? tags[tag as keyof typeof tags] : undefined;
  return key ? labels[key] : '';
}
