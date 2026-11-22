import type { SVGProps } from 'react';

const paths = {
  send: 'M8 12h8m-4-4 4 4-4 4', stop: 'M7 7h10v10H7z',
  sidebar: 'M4 4h16v16H4zM9 4v16', plus: 'M12 5v14M5 12h14',
  down: 'M12 4v16m-6-6 6 6 6-6', close: 'm6 6 12 12M6 18 18 6',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M9 9h11v11H9zM15 9V4H4v11h5', refresh: 'M20 7v5h-5M4 17v-5h5M5.4 7a7 7 0 0 1 11.5-2L20 8M4 16l3.1 3A7 7 0 0 0 18.6 17',
  check: 'm5 12 4 4L19 6', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10', monitor: 'M3 4h18v13H3zM8 21h8m-4-4v4',
  chat: 'M4 4h16v12H9l-5 4z', laptop: 'M5 4h14v12H5zM2 20h20l-3-4H5z',
  trip: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  deploy: 'M8 8 4 12l4 4m8-8 4 4-4 4M14 4l-4 16',
  design: 'm15 3 6 6-11 11-7 1 1-7zM13 5l6 6M4 14l6 6',
  budget: 'M4 5h16v15H4zM4 9h16M8 13h2m4 0h2m-8 4h2m4 0h2',
  research: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
};
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
