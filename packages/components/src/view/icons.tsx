const paths: Record<string, string> = {
  check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6', 'arrow-left': 'M19 12H5M11 18l-6-6 6-6', 'arrow-up': 'M12 19V5M6 11l6-6 6 6', 'arrow-down': 'M12 5v14M18 13l-6 6-6-6',
  'chevron-right': 'm9 6 6 6-6 6', 'chevron-down': 'm6 9 6 6 6-6', 'chevron-left': 'm15 6-6 6 6 6', 'chevron-up': 'm6 15 6-6 6 6',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z', heart: 'M12 20s-7-4.4-9-9.1C1.7 7.6 4 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.7 1.3-1.6 2.7-2.7 4.7-2.7 3.3 0 5.6 3.1 4.3 6.4C19 15.6 12 20 12 20z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15.5c1.8.6 3 2 3.5 4.5',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6', bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2L14.7 21h-4l-.3-2.4a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.9L4.4 9.4l2-3.4 1.9.7a7 7 0 0 1 2.1-1.2L10.7 3h4l.3 2.4a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
  dollar: 'M12 3v18M16.5 7.5C16 6 14.3 5 12 5 9.5 5 7.5 6.3 7.5 8.3c0 4.7 9 2.6 9 7.4 0 2-2 3.3-4.5 3.3-2.5 0-4.3-1.1-4.8-2.8',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3', 'trending-up': 'M3 17l6-6 4 4 8-8M15 7h6v6', 'trending-down': 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z', shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  'map-pin': 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1C10.7 20 4 13.3 4 5a1 1 0 0 1 1-1z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01', alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1', external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', download: 'M12 4v12M7 11l5 5 5-5M4 20h16', upload: 'M12 20V8M7 13l5-5 5 5M4 4h16',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z', sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z', cloud: 'M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z',
  package: 'M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10', cart: 'M3 4h2.5l2.2 11h10.6L20 7H6.4M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4', tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10 3 7 4 7.5 6S12 7 12 7zM12 7c2-4 5-3 4.5-1S12 7 12 7z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', flag: 'M5 21V4M5 4h11l-2 4 2 4H5', bookmark: 'M6 3h12v18l-6-4-6 4z', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  play: 'M7 4v16l13-8z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z', refresh: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4',
  plane: 'M10.5 13.5 3 11l1.5-1.5 8 1L17 6c1-1 2.5-1 3 0 .5.5 0 2-1 3l-4.5 4.5 1 8L14 23l-2.5-7.5', bed: 'M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  coffee: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3', briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5', layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', dot: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
};
paths.close = paths.x; paths.time = paths.clock; paths.money = paths.dollar; paths.location = paths['map-pin']; paths.warning = paths.alert; paths.delete = paths.trash; paths.pencil = paths.edit;
export const iconNames = Object.keys(paths);
export function ViewIcon({ name, className, label }: { name: string; className?: string; label?: string }) {
  const d = paths[name];
  if (!d) return null;
  return <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-icon={name}><path d={d} /></svg>;
}
