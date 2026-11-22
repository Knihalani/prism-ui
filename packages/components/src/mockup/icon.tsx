const paths = {
  desktop: 'M3 4h18v12H3zM8 21h8M12 16v5', tablet: 'M5 2h14v20H5zM11 18h2', mobile: 'M7 2h10v20H7zM11 18h2',
  minus: 'M5 12h14', plus: 'M5 12h14M12 5v14', fullscreen: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  source: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16', pen: 'm15 4 5 5M4 16 16 4a2.1 2.1 0 0 1 3 3L7 19l-4 1z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', pin: 'M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12ZM12 7v4M10 9h4',
  region: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', undo: 'm9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6', redo: 'm15 5 6 6-6 6M21 11H10a6 6 0 0 0-6 6',
};
export function MockupIcon({ name }: { name: keyof typeof paths }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>; }
