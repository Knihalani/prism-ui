import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useSpringValue } from '@prism-ui/react';

export function useNumberTween(result: number, enabled: boolean, root: RefObject<HTMLElement | null>) {
  const [response, setResponse] = useState(.35), last = useRef(Number.isFinite(result) ? result : 0);
  if (Number.isFinite(result)) last.current = result;
  useLayoutEffect(() => {
    const style = root.current && getComputedStyle(root.current);
    const token = style?.getPropertyValue('--prism-calc-motion-base').trim() || style?.getPropertyValue('--prism-motion-base').trim();
    if (token) setResponse(Math.max(0, parseFloat(token) * (token.endsWith('ms') ? .001 : 1)) || 0);
  }, [root, result]);
  const display = useSpringValue(last.current, { response: response || .35 });
  return enabled && response > 0 && Number.isFinite(result) ? display : result;
}
