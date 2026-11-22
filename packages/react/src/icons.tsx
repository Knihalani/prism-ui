import { useContext, type ComponentType, type SVGProps } from 'react';
import { ThemeContext } from './theme';

export const iconPaths = {
  check: 'm5 12 4 4L19 6', chevron: 'm6 9 6 6 6-6', copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
  plus: 'M5 12h14M12 5v14', minus: 'M5 12h14', close: 'm6 6 12 12M6 18 18 6',
  undo: 'm9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6', redo: 'm15 5 6 6-6 6M21 11H10a6 6 0 0 0-6 6',
  send: 'M4 12h16M14 6l6 6-6 6', ask: 'M21 11a8 8 0 0 1-8 8H4l1-4a8 8 0 1 1 16-4Z',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16', preview: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', reload: 'M20 11a8 8 0 1 0-1 5M20 4v7h-7',
  fullscreen: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  desktop: 'M3 4h18v12H3zM8 21h8M12 16v5', tablet: 'M5 2h14v20H5zM11 18h2', mobile: 'M7 2h10v20H7zM11 18h2',
  pen: 'm15 4 5 5M4 16 16 4a2.1 2.1 0 0 1 3 3L7 19l-4 1z', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  pin: 'M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12ZM12 7v4M10 9h4', region: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  warning: 'm12 3 10 18H2L12 3ZM12 9v5M12 17h.01', danger: 'M12 8v5M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  sort: 'm8 4-4 4m4-4 4 4M8 4v16m8 0 4-4m-4 4-4-4M16 4v16', external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
};
export type IconName = keyof typeof iconPaths;
export type Icons = Record<IconName, ComponentType<SVGProps<SVGSVGElement>>>;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const Custom = useContext(ThemeContext).theme.icons?.[name];
  if (Custom) return <Custom aria-hidden="true" focusable="false" {...props} />;
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={iconPaths[name]} /></svg>;
}
