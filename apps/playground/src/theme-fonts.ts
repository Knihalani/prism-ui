import caveat from '../public/fonts/caveat-latin.woff2?inline';
import dmSans from '../public/fonts/dm-sans-latin.woff2?inline';
import interTight from '../public/fonts/inter-tight-latin.woff2?inline';
import plexMono from '../public/fonts/ibm-plex-mono-latin.woff2?inline';

const face = (family: string, source: string, weight: string) =>
  `@font-face{font-family:"${family}";src:url("${source}") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`;

export const themeFontCss = [
  face('Caveat', caveat, '400 700'),
  face('DM Sans', dmSans, '100 1000'),
  face('Inter Tight', interTight, '100 900'),
  face('IBM Plex Mono', plexMono, '400'),
].join('');
