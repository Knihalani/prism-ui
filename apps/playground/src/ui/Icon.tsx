import type { SVGProps } from 'react';

const paths = {
  send: 'M12 19V5m-5 5 5-5 5 5', stop: 'M7 7h10v10H7z',
  sidebar: 'M4 7h16M4 12h11M4 17h16', plus: 'M12 5v14M5 12h14',
  down: 'M12 4v16m-6-6 6 6 6-6', close: 'm6 6 12 12M6 18 18 6',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M16 8V3H3v13h5', refresh: 'M4 10a8 8 0 1 1 1 7M4 4v6h6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3',
  verdict: 'M12 3v18M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8ZM8 21h8',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9',
  chart: 'M4 4v16h16M7 14l4-5 4 3 5-7', checklist: 'm3 6 2 2 3-4M11 6h10M3 13h5m3 0h10M3 20h5m3 0h10',
  branch: 'M5 4v16m0-8h7m0 0 6-6m-6 6 6 6M15 6h3v3m-3 9h3v-3', tabs: 'M3 5h18v15H3zM3 10h18M9 5v5M15 5v5',
  check: 'm5 12 4 4L19 6', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20 15.7A8.5 8.5 0 0 1 8.3 4 8.5 8.5 0 1 0 20 15.7Z', monitor: 'M3 4h18v13H3zM8 21h8m-4-4v4',
  chat: 'M4 4h16v12H9l-5 4z', laptop: 'M5 4h14v12H5zM2 20h20l-3-4H5z',
  trip: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  deploy: 'M8 8 4 12l4 4m8-8 4 4-4 4M14 4l-4 16',
  design: 'm15 3 6 6-11 11-7 1 1-7zM13 5l6 6M4 14l6 6',
  budget: 'M4 5h16v15H4zM4 9h16M8 13h2m4 0h2m-8 4h2m4 0h2',
  research: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
};
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} />{name === 'copy' && <rect x="8" y="8" width="12" height="13" rx="2" />}{name === 'sliders' && <><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>}</svg>;
}

export function PrismGlyph(props: SVGProps<SVGSVGElement>) {
  return <svg className="prism-glyph" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M16 3 3 26h26L16 3ZM16 3v15L3 26m13-8 13 8M9.5 14.5 16 18l6.5-3.5" /></svg>;
}
