import type { CSSProperties } from 'react';
import manrope from '../public/fonts/manrope-latin.woff2?inline';
import inter from '../public/fonts/inter-latin.woff2?inline';
import { themeFontCss } from './theme-fonts';

const css = themeFontCss +
  `@font-face{font-family:"Shell Manrope";src:url("${manrope}") format("woff2");font-weight:200 800;font-display:swap}` +
  `@font-face{font-family:"Shell Inter";src:url("${inter}") format("woff2");font-weight:100 900;font-display:swap}`;

export const artifactFontStyle = { '--prism-playground-fonts': JSON.stringify(btoa(css)) } as CSSProperties;

export const artifactFontBootstrap = `<script>
(() => {
const fonts = prism.theme['--prism-playground-fonts'];
if (fonts) {
  const style = document.getElementById('playground-artifact-fonts') || document.createElement('style');
  style.id = 'playground-artifact-fonts';
  style.textContent = atob(JSON.parse(fonts));
  document.head.append(style);
}
})();
</script>`;
