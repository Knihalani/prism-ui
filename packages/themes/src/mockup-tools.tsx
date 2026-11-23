import type { ReactNode } from 'react';
import { PrismPart, usePart } from '@prism-ui/react';

export function MockupToolContent({ children, label }: { children: ReactNode; label: ReactNode }) {
  const part = usePart('mockup', 'toolLabel');
  return <>{children}<PrismPart as="span" {...part} aria-hidden="true">{label}</PrismPart></>;
}

export const mockupToolCss = `
  :scope :is(.prism-mockup__ask,.prism-mockup__overflowTrigger) > svg { display:none; }
  @container (max-width:360px) {
    :scope :is(.prism-mockup__ask,.prism-mockup__overflowTrigger) > svg { display:block; }
  }
`;
